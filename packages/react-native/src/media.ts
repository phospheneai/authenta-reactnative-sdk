/**
 * Capture-mode resolution and the compression each upload path needs.
 */

import { Image as ImageCompressor, Video } from 'react-native-compressor';

import { SUPPORTED_FACE_IMAGE_TYPES, getMimeType } from '@authenta/core';
import type { LocalFaceImage } from '@authenta/core';

import { VIDEO_SIZE_LIMIT_BYTES } from './theme';
import type { CaptureMode } from './types';

// ─── Capture ──────────────────────────────────────────────────────────────────

/** Picks the camera mode implied by the enabled detection checks. */
export function resolveCaptureMode(
  liveness: boolean,
  faceswap: boolean,
  similarity: boolean,
): CaptureMode {
  if (faceswap) return 'video';
  if (similarity) return 'photo';
  if (liveness) return 'both';
  return 'photo';
}

/** Normalizes a native file path into a `file://` URI. */
export function asFileUri(path: string): string {
  const trimmed = path.trim();
  const uri = trimmed.startsWith('file://') ? trimmed : `file://${trimmed}`;
  console.log('[AuthentaCapture] asFileUri raw path:', JSON.stringify(path), '-> uri:', JSON.stringify(uri));
  return uri;
}

/**
 * Compresses a recorded video when it exceeds VIDEO_SIZE_LIMIT_BYTES.
 * Falls back to the original URI if sizing or compression fails.
 */
export async function compressVideoIfNeeded(fileUri: string): Promise<string> {
  try {
    const rawPath = fileUri.replace(/^file:\/\//, '');
    const blobUtil: any = (() => { try { const m = require('react-native-blob-util'); return m?.default ?? m; } catch { return null; } })();
    if (blobUtil) {
      const stat = await blobUtil.fs.stat(rawPath);
      if (Number(stat.size) <= VIDEO_SIZE_LIMIT_BYTES) return fileUri;
    }
    return await Video.compress(fileUri, { compressionMethod: 'auto', minimumFileSizeForCompress: 0 });
  } catch {
    return fileUri;
  }
}

// ─── Face indexing images ─────────────────────────────────────────────────────

/**
 * Guarantees an image the FaceSim server accepts. JPEG/PNG/WebP pass through;
 * everything else (the photo library hands back HEIC on iOS) is transcoded.
 */
export async function prepareEnrollmentImage(
  image: { uri: string; name?: string; contentType?: string },
  index = 0,
): Promise<LocalFaceImage> {
  const name = image.name ?? `face-${index + 1}.jpg`;
  const type = (image.contentType ?? getMimeType(name)).toLowerCase();

  if (SUPPORTED_FACE_IMAGE_TYPES.includes(type as any)) {
    return { uri: image.uri, name, contentType: type };
  }

  const uri = await ImageCompressor.compress(image.uri, {
    compressionMethod: 'manual',
    maxWidth: 1600,
    quality: 0.85,
    output: 'jpg',
    returnableOutputType: 'uri',
  });
  return {
    uri,
    name: `${name.replace(/\.[^./\\]+$/, '') || `face-${index + 1}`}.jpg`,
    contentType: 'image/jpeg',
  };
}

/**
 * Compresses a photo and returns it as Base64, ready for `client.search()`.
 *
 * Same compressor the rest of the SDK uses. One pass, then send — whatever
 * comes out goes to the server as-is.
 */
export async function prepareSearchImage(uri: string): Promise<string> {
  return ImageCompressor.compress(uri, {
    compressionMethod: 'auto',
    output: 'jpg',
    returnableOutputType: 'base64',
  });
}

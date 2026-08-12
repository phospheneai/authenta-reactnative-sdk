/**
 * Capture-mode resolution and the compression each upload path needs.
 */

import { Image as ImageCompressor, Video, getFileSize } from 'react-native-compressor';

import { SUPPORTED_FACE_IMAGE_TYPES, getMimeType } from '@authenta/core';
import type { LocalFaceImage } from '@authenta/core';

import { SEARCH_IMAGE_MAX_BYTES, SEARCH_STEPS, VIDEO_SIZE_LIMIT_BYTES } from './theme';
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
 * Shrinks a photo to something the search endpoint accepts, returning the file
 * URI of the result. Two things matter here, both measured against the live API:
 *
 * **Size** — the gateway caps the JSON body at 100 KiB, so the image must fit
 * SEARCH_IMAGE_MAX_BYTES once Base64-encoded. Each rung is measured on disk and
 * the first that fits wins, so a request is never sent only to be rejected.
 *
 * **Orientation** — `manual` mode bakes the EXIF rotation into the pixels. That
 * is not cosmetic: a sideways photo either finds no face at all or matches the
 * *wrong* subject (0.33 against 0.90 for the same face). Never replace this with
 * a path that leaves rotation to the EXIF tag.
 *
 * Detail is not a concern at these sizes — the embedding model crops to 112×112
 * internally, so 560 px and 160 px score within noise of each other.
 */
export async function prepareSearchImage(uri: string): Promise<string> {
  let result = uri;

  for (const step of SEARCH_STEPS) {
    result = asFileUri(await ImageCompressor.compress(uri, {
      compressionMethod: 'manual',
      output: 'jpg',
      returnableOutputType: 'uri',
      ...step,
    }));

    // If the size cannot be read, take this result rather than shrinking blindly.
    const bytes = await getFileSize(result).then(Number).catch(() => 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes <= SEARCH_IMAGE_MAX_BYTES) {
      return result;
    }
  }

  return result;
}

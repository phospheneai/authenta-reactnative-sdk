/**
 * Local file access + presigned-URL upload.
 *
 * This is the platform-sensitive layer: Android file URIs need whitespace
 * repair, React Native cannot `fetch('file://…')`, and large files must stream
 * through react-native-blob-util instead of being buffered into a Blob. Both
 * AuthentaClient and FaceIndexClient share this module so the fixes live in
 * exactly one place.
 */

import { AuthentaError } from '../errors';
import { getMimeType } from '../utils/helpers';

// Webpack/esbuild runtime require — declared without pulling in all @types/node.
declare const __non_webpack_require__: ((id: string) => any) | undefined;
// Node.js global require — declared minimally so Metro can still follow static analysis.
declare function require(id: string): any;

export type ResolvedUploadSource = {
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  filePath?: string;
};

export function isReactNativeRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

export function normalizeLocalUri(input: string): string {
  let uri = String(input ?? '').trim();
  console.log('[AuthentaClient] normalizeLocalUri input:', JSON.stringify(input));

  // Repair common accidental whitespace that breaks Android file URIs,
  // e.g. "file:///data/user/0 /com.app/cache/foo.jpg".
  uri = uri.replace(/\s+\//g, '/');

  // Also remove accidental spaces before underscores (e.g. VisionCamera file names like "VisionCamera _123.jpg").
  uri = uri.replace(/\s+_/g, '_');

  // Ensure spaces and other characters are URI-safe.
  // Use decode->encode to avoid double-encoding.
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    try {
      uri = decodeURI(uri);
    } catch {
      // ignore
    }
    uri = encodeURI(uri);
  }

  console.log('[AuthentaClient] normalizeLocalUri output:', JSON.stringify(uri));
  return uri;
}

export function stripFileProtocol(uri: string): string {
  const path = uri.replace(/^file:\/\//, '').trim().replace(/\s+\//g, '/').replace(/\s+_/g, '_');
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

export function getReactNativeBlobUtil(): any | undefined {
  if (!isReactNativeRuntime()) return undefined;
  try {
    let mod: any;
    if (typeof __non_webpack_require__ !== 'undefined') {
      // Webpack / esbuild — runtime require so the bundler doesn't follow this.
      mod = __non_webpack_require__('react-native-blob-util');
    } else {
      // Metro — direct require so Metro registers the native dependency.
      mod = require('react-native-blob-util');
    }
    return mod?.default ?? mod;
  } catch (e) {
    console.log('[AuthentaClient] getReactNativeBlobUtil require error:', e);
    return undefined;
  }
}

/** Fetch a local URI once — derives name, type, size, and blob for upload.
 *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
 *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
export async function resolveUri(uri: string): Promise<ResolvedUploadSource> {
  const normalizedUri = normalizeLocalUri(uri);
  const name = normalizedUri.split('/').pop()?.split('?')[0] ?? 'file';
  const type = getMimeType(name);
  console.log('[AuthentaClient] resolveUri normalizedUri:', JSON.stringify(normalizedUri), 'name:', name, 'type:', type);

  if (isReactNativeRuntime() && (normalizedUri.startsWith('file://') || normalizedUri.startsWith('content://'))) {
    const blobUtil = getReactNativeBlobUtil();
    console.log('[AuthentaClient] resolveUri blobUtil available:', !!blobUtil);
    if (blobUtil?.fs?.stat && blobUtil?.wrap) {
      const filePath = normalizedUri.startsWith('file://') ? stripFileProtocol(normalizedUri) : normalizedUri;
      console.log('[AuthentaClient] resolveUri blobUtil filePath:', JSON.stringify(filePath));
      const stat = await blobUtil.fs.stat(filePath);
      const size = Number(stat?.size ?? 0);
      if (!Number.isFinite(size) || size <= 0) {
        throw new AuthentaError(`Could not determine file size for URI: ${normalizedUri}`);
      }
      return { name, type, size, filePath };
    }
  }

  // Node.js environment — XMLHttpRequest does not exist
  if (typeof XMLHttpRequest === 'undefined') {
    // Aliased so Metro's static analyser does not try to bundle 'fs'.
    const _require = require;
    // Typed as any — core does not depend on @types/node.
    const fs = _require('fs');
    const filePath = normalizedUri.replace(/^file:\/\//, '');
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type });
    return Promise.resolve({ name, type, size: buffer.byteLength, blob });
  }

  // React Native — use XHR
  console.log('[AuthentaClient] resolveUri falling back to XHR for:', JSON.stringify(normalizedUri));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = () => resolve({ name, type, size: (xhr.response as Blob).size, blob: xhr.response as Blob });
    xhr.onerror = () => {
      console.log('[AuthentaClient] resolveUri XHR error for:', JSON.stringify(normalizedUri));
      reject(new AuthentaError(`Could not read file at URI: ${normalizedUri}`));
    };
    xhr.open('GET', normalizedUri);
    xhr.send();
  });
}

/** PUT a resolved file to a presigned S3 URL, streaming from disk when possible. */
export async function putToPresignedUrl(
  uploadUrl: string,
  source: ResolvedUploadSource,
  contentType: string = source.type,
): Promise<void> {
  if (source.filePath) {
    const blobUtil = getReactNativeBlobUtil();
    if (!blobUtil?.fetch || !blobUtil?.wrap) {
      throw new AuthentaError('react-native-blob-util is required for React Native file uploads.');
    }

    const response = await blobUtil.fetch(
      'PUT',
      uploadUrl,
      { 'Content-Type': contentType },
      blobUtil.wrap(source.filePath),
    );
    const status = Number(response?.info?.()?.status ?? 0);
    if (status < 200 || status >= 300) {
      throw new AuthentaError(`S3 upload failed: HTTP ${status}`, undefined, status);
    }
    return;
  }

  if (!source.blob) {
    throw new AuthentaError('No upload body was resolved for this URI.');
  }

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: source.blob,
  });
  if (!putResponse.ok) {
    throw new AuthentaError(
      `S3 upload failed: HTTP ${putResponse.status}`,
      undefined,
      putResponse.status,
    );
  }
}

/** Read a local file as standard (padded) Base64. */
export async function readFileAsBase64(uri: string): Promise<string> {
  const normalizedUri = normalizeLocalUri(uri);

  if (isReactNativeRuntime() && (normalizedUri.startsWith('file://') || normalizedUri.startsWith('content://'))) {
    const blobUtil = getReactNativeBlobUtil();
    if (blobUtil?.fs?.readFile) {
      const filePath = normalizedUri.startsWith('file://') ? stripFileProtocol(normalizedUri) : normalizedUri;
      return blobUtil.fs.readFile(filePath, 'base64');
    }
  }

  // Node.js environment — XMLHttpRequest does not exist
  if (typeof XMLHttpRequest === 'undefined') {
    const _require = require;
    // Typed as any — core does not depend on @types/node.
    const fs = _require('fs');
    return fs.readFileSync(normalizedUri.replace(/^file:\/\//, '')).toString('base64');
  }

  // React Native without blob-util — round-trip through FileReader.
  const source = await resolveUri(normalizedUri);
  if (!source.blob) {
    throw new AuthentaError(`Could not read file at URI: ${normalizedUri}`);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new AuthentaError(`Could not read file at URI: ${normalizedUri}`));
    reader.readAsDataURL(source.blob as Blob);
  });
}

/**
 * Match Python's `base64.urlsafe_b64encode(...).decode()` output exactly:
 * URL-safe alphabet, no whitespace, and padding retained.
 */
export function toBase64Url(base64: string): string {
  const value = String(base64 ?? '')
    .replace(/^data:[^,]+,/i, '')
    .replace(/\s/g, '');

  // Reject corruption locally instead of sending an invalid query to the API.
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)) {
    throw new AuthentaError('Could not encode the selected image as Base64.', 'invalid_base64');
  }

  const unpadded = value.replace(/=+$/, '');
  if (unpadded.length % 4 === 1) {
    throw new AuthentaError('Could not encode the selected image as Base64.', 'invalid_base64');
  }

  const urlSafe = unpadded.replace(/\+/g, '-').replace(/\//g, '_');
  return urlSafe + '='.repeat((4 - (urlSafe.length % 4)) % 4);
}

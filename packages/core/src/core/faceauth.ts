/**
 * Face indexing — enrol faces, list tenants, search a face.
 *
 * Three endpoints on the same host and API key as the rest of the platform:
 *   POST /api/v1/facesim/v1/enroll     create a subject + presigned upload URLs
 *   GET  /api/v1/facesim/v1/subjects   every subject and face
 *   POST /api/v1/facesim/v1/search     rank enrolled faces against a photo
 *
 * Each function takes the client's request context and is exposed on
 * AuthentaClient as faceEnrol / faceSearch / tenants.
 */

import { ValidationError } from '../errors';
import { putToPresignedUrl, normalizeImageToJpeg } from '../internal/fileSource';
import { request, resolveUri } from '../utils/common';
import type { RequestContext } from '../utils/common';
import { getMimeType } from '../utils/helpers';
import {
  MAX_ENROLL_IMAGES,
  MAX_SEARCH_LIMIT,
  MIN_ENROLL_IMAGES,
  SUPPORTED_FACE_IMAGE_TYPES,
} from '../types/faceauth';
import type {
  EnrollResponse,
  LocalFaceImage,
  SearchResponse,
  TenantResponse,
} from '../types/faceauth';

const BASE = '/api/v1/facesim/v1';

/** Fills in name and contentType from the URI, rejecting unsupported formats. */
function describe(image: LocalFaceImage, index: number) {
  const name = (image.name ?? image.uri.split('/').pop()?.split('?')[0] ?? `face-${index + 1}.jpg`).trim();
  const contentType = (image.contentType ?? getMimeType(name)).toLowerCase();

  if (!name || name.length > 255) {
    throw new ValidationError(`Image name must be 1–255 characters — received: "${name}"`);
  }
  if (!SUPPORTED_FACE_IMAGE_TYPES.includes(contentType as any)) {
    throw new ValidationError(
      `Unsupported image type "${contentType}" for ${name}. ` +
      `Face indexing accepts ${SUPPORTED_FACE_IMAGE_TYPES.join(', ')}.`,
    );
  }
  return { name, contentType };
}

/** A local file URI, as opposed to Base64 the caller already prepared. */
const isUri = (value: string) => /^(file|content|assets-library|ph):\/\//i.test(value) || value.startsWith('/');

/** Every subject and face on the account. */
export function tenants(ctx: RequestContext): Promise<TenantResponse> {
  return request<TenantResponse>(ctx, 'GET', `${BASE}/tenant`);
}


/**
 * Enrol photos of one person: create the subject, then upload each image.
 *
 * Returns as soon as S3 has the bytes. The embeddings are generated out of
 * band — call `tenants()` later to see each face reach `processed`.
 */
export async function faceEnrol(
  ctx: RequestContext,
  images: LocalFaceImage[],
): Promise<EnrollResponse> {
  if (images.length < MIN_ENROLL_IMAGES || images.length > MAX_ENROLL_IMAGES) {
    throw new ValidationError(
      `Enrollment accepts ${MIN_ENROLL_IMAGES}–${MAX_ENROLL_IMAGES} images — received ${images.length}.`,
    );
  }

  // Read every file before creating the subject, so a bad URI fails before it
  // leaves a half-uploaded subject behind on the server.
  const described = images.map(describe);
  const sources = await Promise.all(images.map(i => resolveUri(i.uri)));

  const created = await request<EnrollResponse>(ctx, 'POST', `${BASE}/enroll`, { images: described });
  if (created.faces?.length !== sources.length) {
    throw new ValidationError(
      `Server returned ${created.faces?.length ?? 0} upload URLs for ${sources.length} images.`,
    );
  }

  // The response preserves the order of `images`. Each face's status reflects
  // its own upload outcome — one failed PUT doesn't sink the whole batch.
  for (let i = 0; i < created.faces.length; i++) {
    const face = created.faces[i];
    try {
      await putToPresignedUrl(face.upload_url, sources[i], face.headers?.['Content-Type'] ?? described[i].contentType);
      face.status = 'uploaded';
    } catch {
      face.status = 'failed';
    }
  }

  return created;
}

/** Rank enrolled faces against a photo — a local file URI or Base64. */
export async function faceSearch(
  ctx: RequestContext,
  image: string,
  { limit = MAX_SEARCH_LIMIT }: { limit?: number } = {},
): Promise<SearchResponse> {
  const raw = String(image ?? '').trim();
  if (!raw) throw new ValidationError('A query image is required to search faces.');

  // Verbose on purpose: search is the one call whose failures are hard to tell
  // apart from the client — every stage prints so a silent failure is visible.
  const url = `${ctx.baseUrl}${BASE}/search`;
  const capped = Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT);
  console.log('[faceSearch] 1/4 input:', raw.slice(0, 120), `(len ${raw.length})`);

  const jpegUri = await normalizeImageToJpeg(raw);
  console.log('[faceSearch] 2/4 jpeg:', jpegUri);

  try {
    const { size } = await resolveUri(jpegUri);
    console.log('[faceSearch]     size:', size, 'bytes');
  } catch (e) {
    console.log('[faceSearch]     size: unreadable —', (e as Error)?.message);
  }

  const form = new FormData();

  form.append(
    'image',
    {
      uri: jpegUri,
      name: 'image.jpeg',
      type: 'image/jpeg',
    } as any,
  );

  form.append('limit', String(capped));

  console.log('[faceSearch] 3/4 POST', url, `(multipart, limit ${capped})`);

  try {
    const res = await request<SearchResponse>(ctx, 'POST', `${BASE}/search`, form);
    console.log('[faceSearch] 4/4 OK —', res.count, 'match(es)');
    return res;
  } catch (err) {
    const e = err as any;
    console.log('[faceSearch] 4/4 FAILED —',
      e?.name, 'HTTP', e?.statusCode ?? '?', '|', e?.message);
    if (e?.details) console.log('[faceSearch]     details:', JSON.stringify(e.details).slice(0, 300));
    throw err;
  }
}

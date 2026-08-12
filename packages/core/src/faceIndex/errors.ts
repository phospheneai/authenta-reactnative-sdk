/**
 * FaceSim error mapping.
 *
 * The FaceSim server has its own error envelope — `{ error: { code, message } }`
 * — plus FastAPI's `{ detail: [...] }` for request-validation failures. Neither
 * matches the Authenta job API, so the codes are translated here into messages
 * that are safe to show a user.
 */

import { AuthentaError } from '../errors';

export class FaceIndexError extends AuthentaError {
  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    details?: Record<string, any>,
  ) {
    super(message, code, statusCode, details);
    this.name = 'FaceIndexError';
  }
}

/** User-facing text for the documented error codes. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  forbidden: 'This tenant is not allowed to use face indexing.',
  not_found: 'The tenant or record was not found on the face indexing server.',
  conflict: 'This upload conflicts with the current enrollment state. Start a new enrollment.',
  upload_missing: 'The uploaded image could not be found in storage. Start a new enrollment.',
  invalid_image: 'That image could not be read. Choose a JPEG, PNG, or WebP photo.',
  no_face_detected: 'No face was found in that photo. Use a clear, front-facing photo and try again.',
  storage_error: 'The face indexing storage is temporarily unavailable. Please try again.',
  configuration_error: 'The face indexing server is misconfigured. Contact your administrator.',
};

/** Reads the server's error envelope and throws the matching FaceIndexError. */
export async function throwFaceIndexError(response: Response): Promise<never> {
  const status = response.status;
  let data: any;

  // Oversized POST bodies may be rejected by the proxy before the API and
  // therefore carry HTML rather than the normal error envelope.
  if (status === 413) {
    throw new FaceIndexError(
      'The search image is larger than the face indexing server accepts.',
      'image_too_large',
      status,
    );
  }

  try {
    data = await response.json();
  } catch {
    throw new FaceIndexError(
      `Face indexing request failed: HTTP ${status}`,
      status >= 500 ? 'server_error' : 'request_failed',
      status,
    );
  }

  // FastAPI request validation — { detail: [{ msg, loc }] }
  if (Array.isArray(data?.detail)) {
    const detail = data.detail
      .map((d: any) => `${(d?.loc ?? []).join('.')}: ${d?.msg ?? 'invalid'}`)
      .join('; ');
    throw new FaceIndexError(
      `The face indexing server rejected the request (${detail}).`,
      'validation_error',
      status,
      data,
    );
  }

  const code: string = data?.error?.code ?? data?.code ?? 'unknown';
  const apiMessage: string = data?.error?.message ?? data?.message ?? response.statusText ?? 'Unknown error';

  throw new FaceIndexError(
    FRIENDLY_MESSAGES[code] ?? apiMessage,
    code,
    status,
    { ...data, apiMessage },
  );
}

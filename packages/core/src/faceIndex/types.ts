/**
 * FaceSim (face indexing) API contract.
 *
 * This is a standalone service: its own host, its own tenant model, and no
 * authentication header. It shares nothing with the Authenta job API beyond
 * local file handling.
 */

/** Content types the FaceSim server accepts for enrollment and search. */
export const SUPPORTED_FACE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type FaceImageContentType = typeof SUPPORTED_FACE_IMAGE_TYPES[number];

/** Enrollment accepts between 1 and 10 images per subject. */
export const MIN_ENROLL_IMAGES = 1;
export const MAX_ENROLL_IMAGES = 10;

/** Search returns at most 50 ranked faces. */
export const MAX_SEARCH_LIMIT = 50;

export type FaceStatus = 'pending' | 'uploaded' | 'processing' | 'processed' | 'failed' | (string & {});

/** A face has settled once it can no longer change. */
export const TERMINAL_FACE_STATUSES: FaceStatus[] = ['processed', 'failed'];

export interface FaceIndexClientConfig {
  /** Base URL of the FaceSim server, e.g. 'http://192.168.1.20:8000'. */
  baseUrl: string;
  /** Tenant UUID. The server scopes every operation to this tenant. */
  tenantId: string;
  /** Per-request timeout in ms. Default 30000. */
  timeoutMs?: number;
}

// ─── POST /v1/enroll ──────────────────────────────────────────────────────────

export interface EnrollImageDescriptor {
  name: string;
  contentType: FaceImageContentType | string;
}

export interface EnrollFaceUpload {
  face_id: string;
  status: FaceStatus;
  upload_url: string;
  headers: Record<string, string>;
}

export interface EnrollResponse {
  subject_id: string;
  status: FaceStatus;
  faces: EnrollFaceUpload[];
  expires_at: string;
}

// ─── GET /v1/tenant ───────────────────────────────────────────────────────────

export interface TenantFace {
  face_id: string;
  name: string;
  status: FaceStatus;
  embedding: number[] | null;
  image_url: string;
  error: string | null;
}

export interface TenantSubject {
  subject_id: string;
  faces: TenantFace[];
}

export interface TenantResponse {
  tenant_id: string;
  subjects: TenantSubject[];
}

// ─── GET /v1/search ───────────────────────────────────────────────────────────

export interface SearchMatch {
  rank: number;
  subject_id: string;
  face_id: string;
  name: string;
  image_url: string;
  similarity_score: number;
}

export interface SearchResponse {
  tenant_id: string;
  count: number;
  results: SearchMatch[];
}

// ─── Local inputs ─────────────────────────────────────────────────────────────

/** A locally-picked image queued for enrollment. */
export interface LocalFaceImage {
  /** file:// or content:// URI. */
  uri: string;
  /** File name sent to the API. Derived from the URI when omitted. */
  name?: string;
  /** MIME type. Derived from the file extension when omitted. */
  contentType?: string;
}

export interface EnrollmentPollingOptions {
  /** ms between /v1/tenant polls. Default 2000. */
  interval?: number;
  /** ms before giving up. Default 120000. */
  timeout?: number;
}

/** Outcome of enroll → upload → poll. */
export interface EnrollmentResult {
  subject_id: string;
  faces: TenantFace[];
  /** Faces whose embedding was stored and which are now searchable. */
  processedCount: number;
  /** Faces the server could not embed — inspect each face's `error`. */
  failedCount: number;
}


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

// ─── POST /api/v1/facesim/enroll ──────────────────────────────────────────────

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

// ─── GET /api/v1/facesim/subjects ─────────────────────────────────────────────

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

// ─── POST /api/v1/facesim/search ──────────────────────────────────────────────

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

export interface LocalFaceImage {
  uri: string;
  name?: string;
  contentType?: string;
}

export interface EnrollmentPollingOptions {
  interval?: number;
  timeout?: number;
}

export interface EnrollmentResult {
  subject_id: string;
  faces: TenantFace[];
  processedCount: number;
  failedCount: number;
}

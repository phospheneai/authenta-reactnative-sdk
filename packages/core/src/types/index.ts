export type TaskTypeId = '1' | '4' | '8' | '9' | (string & {});

export const TASK_TYPE = {
  AI_IMAGE_DETECTION:    '1',
  FACESWAP_DETECTION:    '4',
  FACE_INTELLIGENCE:     '8',
  FACE_EMBEDDINGS:       '9',
} as const;

export type JobStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'ERROR';

// React Native file descriptor — matches output from image/document pickers
export interface FileInfo {
  uri: string;   // file:// URI
  name: string;  // original filename
  type: string;  // MIME type e.g. "image/jpeg"
  size: number;  // file size in bytes
}

// Per-slot input descriptor sent in POST /api/v1/jobs body
export interface JobInput {
  slotName: string;      // e.g. "original", "reference"
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

// Optional parameters for taskTypeId "8" (face-intelligence)
export interface JobParameters {
  isFaceswapCheck?: boolean;
  isLivenessCheck?: boolean;
  isSimilarityCheck?: boolean;
}

// Face-intelligence check options (used by uploadAndPoll / convenience methods)
export interface FIOptions {
  isFaceswapCheck?: boolean;    // video only
  isLivenessCheck?: boolean;
  isSimilarityCheck?: boolean;  // image only — requires referenceImage
  referenceImage?: string;      // file URI of the reference image
}

export interface PollingOptions {
  interval?: number; // ms between polls, default 5000
  timeout?: number;  // ms total timeout, default 600000
}

// Options for uploadAndPoll() — FI fields are validated and used only when taskTypeId is "8"
export interface RunOptions extends FIOptions, PollingOptions {
  autoPolling?: boolean; // default true — wait for result before returning
}

// POST /api/v1/jobs response — contains per-slot upload URLs
export interface JobSlotUpload {
  slotName: string;
  uploadUrl: string;
}

export interface CreateJobResponse {
  id: string;
  status: JobStatus;
  taskTypeId: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  inputs: JobSlotUpload[];
}

// GET /api/v1/jobs/{id} response
export interface JobRecord {
  id: string;
  status: JobStatus;
  taskTypeId: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  srcURL?: string;
  resultURL?: string;
}

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface ListJobsResponse {
  items: JobRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// Detection result fetched from resultURL
export interface DetectionResult {
  resultType?: string;
  isDeepFake?: string | boolean;
  RealConfidencePercent?: string | number;
  isLiveness?: string | boolean;
  isSimilar?: string | boolean;
  similarityScore?: string | number;
  identityPredictions?: IdentityPrediction[];
  boundingBoxes?: BoundingBoxesMap;
  faceVector?: number[];
  [key: string]: any;
}

export interface IdentityPrediction {
  identityId: number;
  isDeepFake: boolean;
}

export type BoundingBoxCoords = [number, number, number, number];

export interface FrameBoundingBox {
  [frameId: string]: BoundingBoxCoords;
}

export interface IdentityBoundingBox {
  boundingBox: FrameBoundingBox;
  class: 'real' | 'fake';
  confidence: number;
}

export interface BoundingBoxesMap {
  [identityId: string]: IdentityBoundingBox;
}

// Returned by uploadAndPoll() after polling completes
export interface ProcessedJob extends JobRecord {
  result?: DetectionResult;
}

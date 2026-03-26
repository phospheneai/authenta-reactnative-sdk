// Supported model types (extensible with string & {})
export type ModelType = 'DF-1' | 'AC-1' | 'FI-1' | (string & {});

export type MediaStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'ERROR';

// React Native file descriptor — matches output from image/document pickers
export interface FileInfo {
  uri: string;   // file:// URI
  name: string;  // original filename
  type: string;  // MIME type e.g. "image/jpeg"
  size: number;  // file size in bytes
}

// FI-1 model options
export interface FIOptions {
  isSingleFace?: boolean;
  faceswapCheck?: boolean;       // video only
  livenessCheck?: boolean;
  faceSimilarityCheck?: boolean; // image only — requires referenceImage
  referenceImage?: string;       // file URI of the reference image
}

export interface PollingOptions {
  interval?: number; // ms between polls, default 5000
  timeout?: number;  // ms total timeout, default 600000
}

// Options for faceIntelligence() — FI-1 fields are validated and used only when modelType is "FI-1"
export interface RunOptions extends FIOptions, PollingOptions {
  autoPolling?: boolean; // default true — wait for result before returning
}

// POST /api/media response
export interface CreateMediaResponse {
  mid: string;
  name: string;
  status: MediaStatus;
  modelType: string;
  contentType: string;
  size: number;
  createdAt: string;
  uploadUrl: string;
  referenceUploadUrl?: string;
}

// GET /api/media/{mid} response
export interface MediaRecord {
  mid: string;
  name: string;
  status: MediaStatus;
  modelType: string;
  contentType: string;
  size: number;
  createdAt: string;
  srcURL?: string;
  resultURL?: string;
}

export interface ListMediaParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface ListMediaResponse {
  items: MediaRecord[];
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

// Returned by process() and faceIntelligence() after polling completes
export interface ProcessedMedia extends MediaRecord {
  result?: DetectionResult;
}

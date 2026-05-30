// Supported model types (extensible with string & {})
export type ModelType = 'DF-1' | 'AC-1' | 'FI-1' | (string & {});

export type MediaStatus =
  | 'completed' | 'queued' | 'pending' | 'processing' | 'processed' | 'failed' | 'error' | 'initiated'
  | 'COMPLETED' | 'QUEUED' | 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'ERROR'
  | (string & {});

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

// Options for uploadAndPoll() — FI-1 fields are validated and used only when modelType is "FI-1"
export interface RunOptions extends FIOptions, PollingOptions {
  autoPolling?: boolean; // default true — wait for result before returning
  /** Override the MIME type detected from the file extension (e.g. 'video/mp4' when VisionCamera omits the extension). */
  contentType?: string;
}

// POST /api/v1/jobs response
export interface CreateMediaResponse {
  job: {
    id: string;
    tenantId: string;
    taskTypeId: string;
    status: string;
    cost: number;
    createdAt: string;
    updatedAt: string;
    result: unknown | null;
  };

  inputs: UploadInput[];
}

export interface UploadInput {
  slotName: "original" | "reference";
  uploadUrl: string;
  uploadUrlExpiresAt: string;
}



export interface ListMediaParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface ListMediaResponse {
  items: ProcessedMedia[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// Detection result fetched from resultURL
export interface DetectionResult {
  resultType?: string;
  isDeepFake?: string | boolean;
  RealConfidencePercent?: string | number;
  isSpoof?: string | boolean;
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

export interface Artifact {
  id: string;
  kind: "input" | "result";
  slotName: string | null;
  status: MediaStatus;
  contentType: string;

  metadata: Record<string, any>;

  downloadUrl: string;
  createdAt: string;
}

export interface InputSlot {
  name: string;
  mimes: string[];
}

export interface TaskType {
  id: string;
  slug: string;
  displayName: string;
  description: string;

  inputSlots: InputSlot[];

  status: string;
  createdAt: string;
  updatedAt: string;
}


// Returned by uploadAndPoll() after polling completes
export interface ProcessedMedia {
  id: string;
  tenantId: string;
  taskTypeId: string;
  status: MediaStatus;
  cost: number;
  createdAt: string;
  updatedAt: string;
  result: DetectionResult | null;
  artifacts: Artifact[];
  taskType: TaskType;

}


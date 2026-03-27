export type ModelType = 'DF-1' | 'AC-1' | 'FI-1' | (string & {});
export type MediaStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'ERROR';
export interface FileInfo {
    uri: string;
    name: string;
    type: string;
    size: number;
}
export interface FIOptions {
    isSingleFace?: boolean;
    faceswapCheck?: boolean;
    livenessCheck?: boolean;
    faceSimilarityCheck?: boolean;
    referenceImage?: string;
}
export interface PollingOptions {
    interval?: number;
    timeout?: number;
}
export interface RunOptions extends FIOptions, PollingOptions {
    autoPolling?: boolean;
}
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
export interface ProcessedMedia extends MediaRecord {
    result?: DetectionResult;
}

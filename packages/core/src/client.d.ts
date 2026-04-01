import { ModelType, FIOptions, PollingOptions, RunOptions, CreateMediaResponse, MediaRecord, ListMediaParams, ListMediaResponse, DetectionResult, ProcessedMedia } from './types';
export interface AuthentaClientConfig {
    baseUrl?: string;
    clientId: string;
    clientSecret: string;
}
export declare class AuthentaClient {
    private readonly baseUrl;
    private readonly clientId;
    private readonly clientSecret;
    constructor({ baseUrl, clientId, clientSecret, }: AuthentaClientConfig);
    private get authHeaders();
    private request;
    private throwApiError;
    /** Fetch a local URI once — derives name, type, size, and blob for upload.
     *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
     *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
    private resolveUri;
    private uploadToS3;
    createMedia(params: {
        name: string;
        contentType: string;
        size: number;
        modelType: ModelType;
        metadata?: Record<string, any>;
    }): Promise<CreateMediaResponse>;
    getMedia(mid: string): Promise<MediaRecord>;
    listMedia(params?: ListMediaParams): Promise<ListMediaResponse>;
    deleteMedia(mid: string): Promise<void>;
    /**
     * Two-step upload: derives file info from the URI, creates a media record,
     * then PUTs the file blob to S3. Works for all model types.
     * Pass `fiOptions` only when modelType is "FI-1".
     */
    upload(uri: string, modelType: ModelType, fiOptions?: FIOptions): Promise<CreateMediaResponse>;
    pollResult(mid: string, { interval, timeout }?: PollingOptions): Promise<MediaRecord>;
    getResult(media: MediaRecord): Promise<DetectionResult>;
    /**
     * Upload a file URI and process it with the given model.
     * The SDK automatically derives the file name, type, and size from the URI.
     *
     * - For all models: uploads, polls until complete, and fetches the result.
     * - For FI-1: pass any face-check flags; unset flags default to false.
     * - Set `autoPolling: false` to return immediately after upload.
     *
     * @example DF-1 / AC-1
     *   const result = await client.uploadAndPoll('file:///path/to/video.mp4', 'DF-1');
     *
     * @example FI-1 liveness
     *   const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', 'FI-1', { livenessCheck: true });
     *
     * @example FI-1 faceswap (video only)
     *   const result = await client.uploadAndPoll('file:///path/to/video.mp4', 'FI-1', { faceswapCheck: true });
     *
     * @example FI-1 similarity
     *   const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', 'FI-1', {
     *     faceSimilarityCheck: true,
     *     referenceImage: 'file:///path/to/id-photo.jpg',
     *   });
     */
    uploadAndPoll(uri: string, modelType: ModelType, { autoPolling, interval, timeout, isSingleFace, faceswapCheck, livenessCheck, faceSimilarityCheck, referenceImage, }?: RunOptions): Promise<ProcessedMedia>;
}

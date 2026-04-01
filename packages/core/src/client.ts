import {
  ModelType,
  FIOptions,
  PollingOptions,
  RunOptions,
  CreateMediaResponse,
  MediaRecord,
  ListMediaParams,
  ListMediaResponse,
  DetectionResult,
  ProcessedMedia,
} from './types';
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  QuotaExceededError,
  InsufficientCreditsError,
  ValidationError,
  ServerError,
} from './errors';
import { getMimeType, isImage, isVideo } from './utils/helpers';

const TERMINAL_STATUSES = new Set(['PROCESSED', 'FAILED', 'ERROR']);

export interface AuthentaClientConfig {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
}

export class AuthentaClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor({
    baseUrl = 'https://platform.authenta.ai',
    clientId,
    clientSecret,
  }: AuthentaClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private get authHeaders(): Record<string, string> {
    return {
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    queryParams?: Record<string, any>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const qs = Object.entries(queryParams)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      method,
      headers: this.authHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      await this.throwApiError(response);
    }

    const text = await response.text();
    if (!text.trim()) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ValidationError(
        'Expected JSON but received non-JSON response',
        undefined,
        response.status,
        { body: text.slice(0, 200) },
      );
    }
  }

  private async throwApiError(response: Response): Promise<never> {
    const status = response.status;
    let data: any;

    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      if (status >= 500) throw new ServerError(text || 'Server error', undefined, status);
      throw new ValidationError(text || 'Client error', undefined, status);
    }

    const code: string = data?.code ?? 'unknown';
    const message: string = data?.message ?? response.statusText ?? 'Unknown error';

    if (code === 'IAM001') throw new AuthenticationError(message, status, data);
    if (code === 'IAM002') throw new AuthorizationError(message, status, data);
    if (code === 'AA001') throw new QuotaExceededError(message, status, data);
    if (code === 'U007') throw new InsufficientCreditsError(message, status, data);
    if (status >= 500) throw new ServerError(message, code, status, data);
    if (status >= 400) throw new ValidationError(message, code, status, data);
    throw new AuthentaError(message, code, status, data);
  }

  /** Fetch a local URI once — derives name, type, size, and blob for upload.
   *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
   *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
  private resolveUri(uri: string): Promise<{ name: string; type: string; size: number; blob: Blob }> {
    const name = uri.split('/').pop()?.split('?')[0] ?? 'file';
    const type = getMimeType(name);

    // Node.js environment — XMLHttpRequest does not exist
    if (typeof XMLHttpRequest === 'undefined') {
      // Use aliased require so Metro's static analyser does not try to bundle 'fs'
      const _require = require;
      const fs = _require('fs') as typeof import('fs');
      const filePath = uri.replace(/^file:\/\//, '');
      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer], { type });
      return Promise.resolve({ name, type, size: buffer.byteLength, blob });
    }

    // React Native — use XHR
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      xhr.onload = () => resolve({ name, type, size: (xhr.response as Blob).size, blob: xhr.response as Blob });
      xhr.onerror = () => reject(new AuthentaError(`Could not read file at URI: ${uri}`));
      xhr.open('GET', uri);
      xhr.send();
    });
  }

  private async uploadToS3(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!putResponse.ok) {
      throw new AuthentaError(
        `S3 upload failed: HTTP ${putResponse.status}`,
        undefined,
        putResponse.status,
      );
    }
  }

  // ─── Core media CRUD ───────────────────────────────────────────────────────

  async createMedia(params: {
    name: string;
    contentType: string;
    size: number;
    modelType: ModelType;
    metadata?: Record<string, any>;
  }): Promise<CreateMediaResponse> {
    return this.request<CreateMediaResponse>('POST', '/api/media', params);
  }

  async getMedia(mid: string): Promise<MediaRecord> {
    return this.request<MediaRecord>('GET', `/api/media/${mid}`);
  }

  async listMedia(params?: ListMediaParams): Promise<ListMediaResponse> {
    return this.request<ListMediaResponse>('GET', '/api/media', undefined, params);
  }

  async deleteMedia(mid: string): Promise<void> {
    await this.request<void>('DELETE', `/api/media/${mid}`);
  }

  // ─── Upload (common for all models) ───────────────────────────────────────

  /**
   * Two-step upload: derives file info from the URI, creates a media record,
   * then PUTs the file blob to S3. Works for all model types.
   * Pass `fiOptions` only when modelType is "FI-1".
   */
  async upload(uri: string, modelType: ModelType, fiOptions?: FIOptions): Promise<CreateMediaResponse> {
    const { name, type, size, blob } = await this.resolveUri(uri);

    const payload: Parameters<typeof this.createMedia>[0] = {
      name,
      contentType: type,
      size,
      modelType,
    };

    if (modelType.toUpperCase() === 'FI-1' && fiOptions) {
      const {
        isSingleFace = true,
        faceswapCheck = false,
        livenessCheck = false,
        faceSimilarityCheck = false,
      } = fiOptions;
      payload.metadata = { isSingleFace, faceswapCheck, livenessCheck, faceSimilarityCheck };
    }

    const media = await this.createMedia(payload);
    await this.uploadToS3(media.uploadUrl, blob, type);

    if (modelType.toUpperCase() === 'FI-1' && fiOptions?.faceSimilarityCheck) {
      if (!fiOptions.referenceImage) {
        throw new ValidationError('referenceImage is required when faceSimilarityCheck is true');
      }
      if (!media.referenceUploadUrl) {
        throw new AuthentaError('No referenceUploadUrl returned from server');
      }
      const { blob: refBlob, type: refType } = await this.resolveUri(fiOptions.referenceImage);
      await this.uploadToS3(media.referenceUploadUrl, refBlob, refType);
    }

    return media;
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  async pollResult(
    mid: string,
    { interval = 5000, timeout = 600_000 }: PollingOptions = {},
  ): Promise<MediaRecord> {
    const deadline = Date.now() + timeout;

    while (true) {
      const media = await this.getMedia(mid);
      if (TERMINAL_STATUSES.has(media.status.toUpperCase())) return media;

      if (Date.now() >= deadline) {
        throw new AuthentaError(
          `Timed out waiting for media ${mid} — last status: ${media.status}`,
        );
      }

      await new Promise<void>(resolve => setTimeout(resolve, interval));
    }
  }

  // ─── Result ────────────────────────────────────────────────────────────────

  async getResult(media: MediaRecord): Promise<DetectionResult> {
    if (!media.resultURL) {
      throw new ValidationError(
        'media has no resultURL — ensure processing is complete (status=PROCESSED)',
      );
    }
    const response = await fetch(media.resultURL);
    if (!response.ok) {
      throw new AuthentaError(
        `Failed to fetch resultURL: HTTP ${response.status}`,
        undefined,
        response.status,
      );
    }
    return response.json() as Promise<DetectionResult>;
  }

  // ─── High-level: one function for all models ──────────────────────────────

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
  async uploadAndPoll(
    uri: string,
    modelType: ModelType,
    {
      autoPolling = true,
      interval,
      timeout,
      isSingleFace = true,
      faceswapCheck = false,
      livenessCheck = false,
      faceSimilarityCheck = false,
      referenceImage,
    }: RunOptions = {},
  ): Promise<ProcessedMedia> {
    const isFI = modelType.toUpperCase() === 'FI-1';

    if (isFI) {
      const type = getMimeType(uri.split('/').pop() ?? '');
      if (isImage(type) && faceswapCheck) {
        throw new ValidationError('faceswapCheck cannot be true for image files');
      }
      if (isVideo(type) && faceSimilarityCheck) {
        throw new ValidationError('faceSimilarityCheck cannot be true for video files');
      }
      if (faceSimilarityCheck && !referenceImage) {
        throw new ValidationError('referenceImage is required when faceSimilarityCheck is true');
      }
    }

    const fiOptions: FIOptions | undefined = isFI
      ? { isSingleFace, faceswapCheck, livenessCheck, faceSimilarityCheck, referenceImage }
      : undefined;

    const meta = await this.upload(uri, modelType, fiOptions);
    if (!autoPolling) return meta as ProcessedMedia;

    const media = await this.pollResult(meta.mid, { interval, timeout });
    const result = media.resultURL ? await this.getResult(media) : undefined;
    return { ...media, result };
  }
}

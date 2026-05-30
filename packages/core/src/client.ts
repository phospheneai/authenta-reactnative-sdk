import {
  ModelType,
  FIOptions,
  PollingOptions,
  RunOptions,
  CreateMediaResponse,
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

// Webpack/esbuild runtime require — declared without pulling in all @types/node.
declare const __non_webpack_require__: ((id: string) => any) | undefined;
// Node.js global require — declared minimally so Metro can still follow static analysis.
declare function require(id: string): any;

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PROCESSED', 'FAILED', 'ERROR']);

type ResolvedUploadSource = {
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  filePath?: string;
};

function isReactNativeRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

function normalizeLocalUri(input: string): string {
  let uri = String(input ?? '').trim();
  console.log('[AuthentaClient] normalizeLocalUri input:', JSON.stringify(input));

  // Repair common accidental whitespace that breaks Android file URIs,
  // e.g. "file:///data/user/0 /com.app/cache/foo.jpg".
  uri = uri.replace(/\s+\//g, '/');

  // Also remove accidental spaces before underscores (e.g. VisionCamera file names like "VisionCamera _123.jpg").
  uri = uri.replace(/\s+_/g, '_');

  // Ensure spaces and other characters are URI-safe.
  // Use decode->encode to avoid double-encoding.
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    try {
      uri = decodeURI(uri);
    } catch {
      // ignore
    }
    uri = encodeURI(uri);
  }

  console.log('[AuthentaClient] normalizeLocalUri output:', JSON.stringify(uri));
  return uri;
}

function stripFileProtocol(uri: string): string {
  const path = uri.replace(/^file:\/\//, '').trim().replace(/\s+\//g, '/').replace(/\s+_/g, '_');
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function getReactNativeBlobUtil(): any | undefined {
  if (!isReactNativeRuntime()) return undefined;
  try {
    let mod: any;
    if (typeof __non_webpack_require__ !== 'undefined') {
      // Webpack / esbuild — runtime require so the bundler doesn't follow this.
      mod = __non_webpack_require__('react-native-blob-util');
    } else {
      // Metro — direct require so Metro registers the native dependency.
      mod = require('react-native-blob-util');
    }
    return mod?.default ?? mod;
  } catch (e) {
    console.log('[AuthentaClient] getReactNativeBlobUtil require error:', e);
    return undefined;
  }
}

export interface AuthentaClientConfig {
  baseUrl: string;
  api_key: string;
  auth_enabled: boolean;
}

export class AuthentaClient {
  private readonly baseUrl: string;
  private readonly api_key: string;
  private readonly auth_enabled: boolean;

  constructor({
    baseUrl,
    api_key,
    auth_enabled,
  }: AuthentaClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.api_key = api_key;
    this.auth_enabled = auth_enabled;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.auth_enabled) {
      headers['Authorization'] = `Bearer ${this.api_key}`;
    }
    return headers;
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
  private async resolveUri(uri: string): Promise<ResolvedUploadSource> {
    const normalizedUri = normalizeLocalUri(uri);
    const name = normalizedUri.split('/').pop()?.split('?')[0] ?? 'file';
    const type = getMimeType(name);
    console.log('[AuthentaClient] resolveUri normalizedUri:', JSON.stringify(normalizedUri), 'name:', name, 'type:', type);

    if (isReactNativeRuntime() && (normalizedUri.startsWith('file://') || normalizedUri.startsWith('content://'))) {
      const blobUtil = getReactNativeBlobUtil();
      console.log('[AuthentaClient] resolveUri blobUtil available:', !!blobUtil);
      if (blobUtil?.fs?.stat && blobUtil?.wrap) {
        const filePath = normalizedUri.startsWith('file://') ? stripFileProtocol(normalizedUri) : normalizedUri;
        console.log('[AuthentaClient] resolveUri blobUtil filePath:', JSON.stringify(filePath));
        const stat = await blobUtil.fs.stat(filePath);
        const size = Number(stat?.size ?? 0);
        if (!Number.isFinite(size) || size <= 0) {
          throw new AuthentaError(`Could not determine file size for URI: ${normalizedUri}`);
        }
        return { name, type, size, filePath };
      }
    }

    // Node.js environment — XMLHttpRequest does not exist
    if (typeof XMLHttpRequest === 'undefined') {
      // Aliased so Metro's static analyser does not try to bundle 'fs'.
      const _require = require;
      const fs = _require('fs') as typeof import('fs');
      const filePath = normalizedUri.replace(/^file:\/\//, '');
      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer], { type });
      return Promise.resolve({ name, type, size: buffer.byteLength, blob });
    }

    // React Native — use XHR
    console.log('[AuthentaClient] resolveUri falling back to XHR for:', JSON.stringify(normalizedUri));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      xhr.onload = () => resolve({ name, type, size: (xhr.response as Blob).size, blob: xhr.response as Blob });
      xhr.onerror = () => {
        console.log('[AuthentaClient] resolveUri XHR error for:', JSON.stringify(normalizedUri));
        reject(new AuthentaError(`Could not read file at URI: ${normalizedUri}`));
      };
      xhr.open('GET', normalizedUri);
      xhr.send();
    });
  }

  private async uploadToS3(uploadUrl: string, source: ResolvedUploadSource): Promise<void> {
    if (source.filePath) {
      const blobUtil = getReactNativeBlobUtil();
      if (!blobUtil?.fetch || !blobUtil?.wrap) {
        throw new AuthentaError('react-native-blob-util is required for React Native file uploads.');
      }

      const response = await blobUtil.fetch(
        'PUT',
        uploadUrl,
        { 'Content-Type': source.type },
        blobUtil.wrap(source.filePath),
      );
      const status = Number(response?.info?.()?.status ?? 0);
      if (status < 200 || status >= 300) {
        throw new AuthentaError(`S3 upload failed: HTTP ${status}`, undefined, status);
      }
      return;
    }

    if (!source.blob) {
      throw new AuthentaError('No upload body was resolved for this URI.');
    }

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': source.type },
      body: source.blob,
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
    taskTypeId: string;
    inputs: {
      slotName: string;
      contentType: string;
      fileName: string;
      sizeBytes: number;
    }[];
    parameters?: Record<string, boolean | string>;
  }): Promise<CreateMediaResponse> {
    return this.request<CreateMediaResponse>('POST', '/api/v1/jobs', params);
  }

  async getMedia(jobId: string): Promise<ProcessedMedia> {
    return this.request<ProcessedMedia>('GET', `/api/v1/jobs/${jobId}`);
  }

  async listMedia(params?: ListMediaParams): Promise<ListMediaResponse> {
    return this.request<ListMediaResponse>('GET', '/api/v1/jobs', undefined, params);
  }

  async deleteMedia(mid: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v1/jobs/${mid}`);
  }

  async get_task_id(modelType: ModelType): Promise<string> {
    const mapping: Record<string, string> = {
      'AC-1': '1',
      'AF-1': '2',
      'VF-1': '3',
      'DF-1': '4',
      'FD-1': '5',
      'DI-1': '6',
      'FL-1': '7',
      'FI-1': '8',
      'FE-1': '9',
    };
    const task_id = mapping[modelType.toUpperCase()];
    if (!task_id) {
      throw new ValidationError(`Unsupported modelType: ${modelType}`);
    }
    return task_id;
  }

  // ─── Upload (common for all models) ───────────────────────────────────────

  /**
   * Two-step upload: derives file info from the URI, creates a media record,
   * then PUTs the file blob to S3. Works for all model types.
   * Pass `fiOptions` only when modelType is "FI-1".
   */
  async upload(uri: string, modelType: ModelType, fiOptions?: FIOptions, contentTypeOverride?: string): Promise<CreateMediaResponse> {
    const mediaSource = await this.resolveUri(uri);
    if (contentTypeOverride) mediaSource.type = contentTypeOverride;

    const payload: Parameters<typeof this.createMedia>[0] = {
      taskTypeId: await this.get_task_id(modelType),
      inputs: [{
        slotName: 'original',
        contentType: mediaSource.type,
        fileName: mediaSource.name,
        sizeBytes: mediaSource.size,
      }],
    };

    let referenceSource: ResolvedUploadSource | undefined;

    if (modelType.toUpperCase() === 'FI-1' && fiOptions) {
      const {
        faceswapCheck = false,
        livenessCheck = false,
        faceSimilarityCheck = false,
      } = fiOptions;
      // Only send truthy flags — the API treats absent fields as false.
      const params: Record<string, boolean> = {};
      if (faceswapCheck) params.isFaceswapCheck = true;
      if (livenessCheck) params.isLivenessCheck = true;
      if (faceSimilarityCheck) params.isSimilarityCheck = true;
      if (fiOptions.isSingleFace !== undefined) params.isSingleFace = fiOptions.isSingleFace;
      payload.parameters = params;

      // Reference slot is only needed when similarity check is requested.
      if (faceSimilarityCheck && fiOptions.referenceImage) {
        referenceSource = await this.resolveUri(fiOptions.referenceImage);
        payload.inputs.push({
          slotName: 'reference',
          contentType: referenceSource.type,
          fileName: referenceSource.name,
          sizeBytes: referenceSource.size,
        });
      }
    }

    const media = await this.createMedia(payload);

    await this.uploadToS3(media.inputs[0].uploadUrl, mediaSource);

    if (referenceSource) {
      if (!media.inputs[1]?.uploadUrl) {
        throw new AuthentaError('No reference uploadUrl returned from server');
      }
      await this.uploadToS3(media.inputs[1].uploadUrl, referenceSource);
    }

    return media;
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  async pollResult(
    jobid: string,
    { interval = 5000, timeout = 600_000 }: PollingOptions = {},
  ): Promise<ProcessedMedia> {
    const deadline = Date.now() + timeout;

    while (true) {
      const media = await this.getMedia(jobid);

      if (TERMINAL_STATUSES.has(media.status.toUpperCase())) return media;

      if (Date.now() >= deadline) {
        throw new AuthentaError(
          `Timed out waiting for media ${jobid} — last status: ${media.status}`,
        );
      }

      await new Promise<void>(resolve => setTimeout(resolve, interval));
    }
  }

  // ─── Result ────────────────────────────────────────────────────────────────

  async getResult(media: ProcessedMedia): Promise<DetectionResult> {
    for (const artifact of media.artifacts ?? []) {
      if (artifact.kind === 'result') {
        if (!artifact.downloadUrl) {
          throw new AuthentaError('Result artifact has no downloadUrl — ensure processing is complete');
        }
        const response = await fetch(artifact.downloadUrl);
        if (!response.ok) {
          throw new AuthentaError(
            `Failed to fetch result artifact: HTTP ${response.status}`,
            undefined,
            response.status,
          );
        }
        return response.json() as Promise<DetectionResult>;
      }
    }
    // Fall back to result already embedded in the job response.
    if (media.result) return media.result;
    throw new AuthentaError('No result available — ensure processing is complete');
  }

  async finalizeMedia(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}/finalize`, {
      method: 'POST',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new AuthentaError(
        `Failed to finalize media: HTTP ${response.status}`,
        undefined,
        response.status,
      );
    }
  }

  // ─── High-level: one function for all models ──────────────────────────────

  /**
   * Upload a file URI and process it with the given model.
   * The SDK automatically derives the file name, type, and size from the URI.
   *
   * - For all models: uploads, polls until complete, and fetches the result.
   * - For FI-1: pass any face-check flags; unset flags default to false.
   * - Set `autoPolling: false` to return immediately after upload (returns CreateMediaResponse).
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
      contentType,
    }: RunOptions = {},
  ): Promise<ProcessedMedia | CreateMediaResponse> {
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

    const meta = await this.upload(uri, modelType, fiOptions, contentType);
    await this.finalizeMedia(meta.job.id);
    if (!autoPolling) return meta;

    const media = await this.pollResult(meta.job.id, { interval, timeout });
    const result = await this.getResult(media);
    return { ...media, result };
  }

  // ─── Convenience wrappers ─────────────────────────────────────────────────

  async verify_deepfake(uri: string): Promise<DetectionResult> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isVideo(type)) {
      throw new ValidationError('verify_deepfake only accepts video files');
    }
    const res = await this.uploadAndPoll(uri, 'FI-1', { faceswapCheck: true }) as ProcessedMedia;
    return res.result!;
  }

  async verify_liveness(uri: string): Promise<DetectionResult> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type) && !isVideo(type)) {
      throw new ValidationError('verify_liveness only accepts image or video files');
    }
    const res = await this.uploadAndPoll(uri, 'FI-1', { livenessCheck: true }) as ProcessedMedia;
    return res.result!;
  }

  async verify_similarity(uri: string, referenceImage: string): Promise<DetectionResult> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type)) {
      throw new ValidationError('verify_similarity only accepts image files');
    }
    const res = await this.uploadAndPoll(uri, 'FI-1', { faceSimilarityCheck: true, referenceImage }) as ProcessedMedia;
    return res.result!;
  }

  async verify_face_embeddings(uri: string): Promise<DetectionResult> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type)) {
      throw new ValidationError('verify_face_embeddings only accepts image files');
    }
    const res = await this.uploadAndPoll(uri, 'FE-1') as ProcessedMedia;
    return res.result!;
  }
}

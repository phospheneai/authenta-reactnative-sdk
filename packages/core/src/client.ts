import {
  TaskTypeId,
  FIOptions,
  PollingOptions,
  RunOptions,
  JobInput,
  JobParameters,
  CreateJobResponse,
  JobRecord,
  ListJobsParams,
  ListJobsResponse,
  DetectionResult,
  ProcessedJob,
} from './types';
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  InsufficientBalanceError,
  ValidationError,
  ServerError,
} from './errors';
import { getMimeType, isImage, isVideo } from './utils/helpers';

declare const __non_webpack_require__: typeof require | undefined;

const TERMINAL_STATUSES = new Set(['PROCESSED', 'FAILED', 'ERROR']);

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
      mod = __non_webpack_require__('react-native-blob-util');
    } else {
      mod = require('react-native-blob-util');
    }
    return mod?.default ?? mod;
  } catch (e) {
    console.log('[AuthentaClient] getReactNativeBlobUtil require error:', e);
    return undefined;
  }
}

export interface AuthentaClientConfig {
  baseUrl?: string;
  apiKey: string;
}

export class AuthentaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor({
    baseUrl = 'https://platform.authenta.ai',
    apiKey,
  }: AuthentaClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private get authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
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

    if (code === 'INVALID_API_KEY') throw new AuthenticationError(message, status, data);
    if (code === 'FORBIDDEN') throw new AuthorizationError(message, status, data);
    if (code === 'INSUFFICIENT_BALANCE') throw new InsufficientBalanceError(message, status, data);
    if (status >= 500) throw new ServerError(message, code, status, data);
    if (status >= 400) throw new ValidationError(message, code, status, data);
    throw new AuthentaError(message, code, status, data);
  }

  /** Fetch a local URI once — derives name, type, size, and blob for upload. */
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
        throw new AuthentaError(
          'react-native-blob-util is required for React Native file uploads.',
        );
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

  // ─── Core job CRUD ─────────────────────────────────────────────────────────

  async createJob(params: {
    inputs: JobInput[];
    taskTypeId: TaskTypeId;
    parameters?: JobParameters;
  }): Promise<CreateJobResponse> {
    return this.request<CreateJobResponse>('POST', '/api/v1/jobs', params);
  }

  async getJob(id: string): Promise<JobRecord> {
    return this.request<JobRecord>('GET', `/api/v1/jobs/${id}`);
  }

  async listJobs(params?: ListJobsParams): Promise<ListJobsResponse> {
    return this.request<ListJobsResponse>('GET', '/api/v1/jobs', undefined, params);
  }

  async deleteJob(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v1/jobs/${id}`);
  }

  async finalizeJob(id: string): Promise<JobRecord> {
    return this.request<JobRecord>('POST', `/api/v1/jobs/${id}/finalize`);
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  /**
   * Three-step upload: creates a job, PUTs file(s) to S3 per slot, then finalizes.
   * Pass `fiOptions` only when taskTypeId is "8" (face-intelligence).
   */
  async upload(uri: string, taskTypeId: TaskTypeId, fiOptions?: FIOptions): Promise<CreateJobResponse> {
    const mediaSource = await this.resolveUri(uri);

    const inputs: JobInput[] = [{
      slotName: 'original',
      fileName: mediaSource.name,
      contentType: mediaSource.type,
      sizeBytes: mediaSource.size,
    }];

    let parameters: JobParameters | undefined;

    if (taskTypeId === '8' && fiOptions) {
      const {
        isFaceswapCheck = false,
        isLivenessCheck = false,
        isSimilarityCheck = false,
      } = fiOptions;
      parameters = { isFaceswapCheck, isLivenessCheck, isSimilarityCheck };

      if (isSimilarityCheck) {
        if (!fiOptions.referenceImage) {
          throw new ValidationError('referenceImage is required when isSimilarityCheck is true');
        }
        const refSource = await this.resolveUri(fiOptions.referenceImage);
        inputs.push({
          slotName: 'reference',
          fileName: refSource.name,
          contentType: refSource.type,
          sizeBytes: refSource.size,
        });
      }
    }

    const job = await this.createJob({ inputs, taskTypeId, parameters });

    // Upload each slot to its respective S3 URL
    for (const slot of job.inputs) {
      if (slot.slotName === 'original') {
        await this.uploadToS3(slot.uploadUrl, mediaSource);
      } else if (slot.slotName === 'reference' && fiOptions?.referenceImage) {
        const refSource = await this.resolveUri(fiOptions.referenceImage);
        await this.uploadToS3(slot.uploadUrl, refSource);
      }
    }

    // Send job to processing queue
    await this.finalizeJob(job.id);

    return job;
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  async pollResult(
    id: string,
    { interval = 5000, timeout = 600_000 }: PollingOptions = {},
  ): Promise<JobRecord> {
    const deadline = Date.now() + timeout;

    while (true) {
      const job = await this.getJob(id);
      if (TERMINAL_STATUSES.has(job.status.toUpperCase())) return job;

      if (Date.now() >= deadline) {
        throw new AuthentaError(
          `Timed out waiting for job ${id} — last status: ${job.status}`,
        );
      }

      await new Promise<void>(resolve => setTimeout(resolve, interval));
    }
  }

  // ─── Result ────────────────────────────────────────────────────────────────

  async getResult(job: JobRecord): Promise<DetectionResult> {
    if (!job.resultURL) {
      throw new ValidationError(
        'job has no resultURL — ensure processing is complete (status=PROCESSED)',
      );
    }
    const response = await fetch(job.resultURL);
    if (!response.ok) {
      throw new AuthentaError(
        `Failed to fetch resultURL: HTTP ${response.status}`,
        undefined,
        response.status,
      );
    }
    return response.json() as Promise<DetectionResult>;
  }

  // ─── High-level: one function for all task types ──────────────────────────

  /**
   * Upload a file URI, finalize the job, poll until complete, and return the result.
   *
   * @example AI image detection
   *   const result = await client.uploadAndPoll('file:///path/to/image.jpg', '1');
   *
   * @example Faceswap detection (video)
   *   const result = await client.uploadAndPoll('file:///path/to/video.mp4', '4');
   *
   * @example Face intelligence — liveness
   *   const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', '8', { isLivenessCheck: true });
   *
   * @example Face intelligence — similarity
   *   const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', '8', {
   *     isSimilarityCheck: true,
   *     referenceImage: 'file:///path/to/id-photo.jpg',
   *   });
   *
   * @example Face embeddings
   *   const result = await client.uploadAndPoll('file:///path/to/face.jpg', '9');
   */
  async uploadAndPoll(
    uri: string,
    taskTypeId: TaskTypeId,
    {
      autoPolling = true,
      interval,
      timeout,
      isFaceswapCheck = false,
      isLivenessCheck = false,
      isSimilarityCheck = false,
      referenceImage,
    }: RunOptions = {},
  ): Promise<ProcessedJob> {
    const isFaceIntelligence = taskTypeId === '8';

    if (isFaceIntelligence) {
      const type = getMimeType(uri.split('/').pop() ?? '');
      if (isImage(type) && isFaceswapCheck) {
        throw new ValidationError('isFaceswapCheck cannot be true for image files');
      }
      if (isVideo(type) && isSimilarityCheck) {
        throw new ValidationError('isSimilarityCheck cannot be true for video files');
      }
      if (isSimilarityCheck && !referenceImage) {
        throw new ValidationError('referenceImage is required when isSimilarityCheck is true');
      }
    }

    const fiOptions: FIOptions | undefined = isFaceIntelligence
      ? { isFaceswapCheck, isLivenessCheck, isSimilarityCheck, referenceImage }
      : undefined;

    const job = await this.upload(uri, taskTypeId, fiOptions);
    if (!autoPolling) return job as ProcessedJob;

    const polled = await this.pollResult(job.id, { interval, timeout });
    const result = polled.resultURL ? await this.getResult(polled) : undefined;
    return { ...polled, result };
  }

  async verify_deepfake(uri: string): Promise<ProcessedJob> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isVideo(type)) {
      throw new ValidationError('verify_deepfake only accepts video files');
    }
    return this.uploadAndPoll(uri, '4');
  }

  async verify_liveness(uri: string): Promise<DetectionResult> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type) && !isVideo(type)) {
      throw new ValidationError('verify_liveness only accepts image or video files');
    }
    const job = await this.uploadAndPoll(uri, '8', { isLivenessCheck: true });
    return { id: job.id, status: job.status, isLiveness: job.result?.isLiveness };
  }

  async verify_similarity(uri: string, referenceImage: string): Promise<ProcessedJob> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type)) {
      throw new ValidationError('verify_similarity only accepts image files');
    }
    return this.uploadAndPoll(uri, '8', { isSimilarityCheck: true, referenceImage });
  }

  async verify_face_embeddings(uri: string): Promise<ProcessedJob> {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (!isImage(type)) {
      throw new ValidationError('verify_face_embeddings only accepts image files');
    }
    return this.uploadAndPoll(uri, '9');
  }
}

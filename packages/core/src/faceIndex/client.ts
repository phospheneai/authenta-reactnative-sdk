/**
 * FaceIndexClient — client for the standalone FaceSim face-indexing server.
 *
 * Separate service from AuthentaClient: different host, no API key, scoped by
 * tenant UUID only. The two clients share nothing but local file handling.
 *
 * Enrollment is a three-party flow — the API hands out presigned S3 URLs, the
 * app PUTs the bytes straight to S3, and a Lambda tells the API the object
 * landed. Enrollment is therefore only complete once polling shows every face
 * settled as `processed` or `failed`.
 */

import { ValidationError } from '../errors';
import { getMimeType } from '../utils/helpers';
import {
  putToPresignedUrl,
  readFileAsBase64,
  resolveUri,
  toBase64Url,
} from '../internal/fileSource';
import { throwFaceIndexError } from './errors';
import {
  MAX_ENROLL_IMAGES,
  MAX_SEARCH_LIMIT,
  MIN_ENROLL_IMAGES,
  SUPPORTED_FACE_IMAGE_TYPES,
  TERMINAL_FACE_STATUSES,
} from './types';
import type {
  EnrollImageDescriptor,
  EnrollResponse,
  EnrollmentPollingOptions,
  EnrollmentResult,
  FaceIndexClientConfig,
  LocalFaceImage,
  SearchResponse,
  TenantFace,
  TenantResponse,
  TenantSubject,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


/** `502 storage_error` is documented as retryable with bounded backoff. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const MAX_REQUEST_RETRIES = 2;

export class FaceIndexClient {
  private readonly baseUrl: string;
  private readonly tenantId: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, tenantId, timeoutMs = 30_000 }: FaceIndexClientConfig) {
    const trimmedUrl = String(baseUrl ?? '').trim().replace(/\/$/, '');
    if (!trimmedUrl) {
      throw new ValidationError('baseUrl is required for the face indexing server.');
    }
    if (!UUID_RE.test(String(tenantId ?? '').trim())) {
      throw new ValidationError(`tenantId must be a UUID — received: ${tenantId}`);
    }

    this.baseUrl = trimmedUrl;
    this.tenantId = String(tenantId).trim();
    this.timeoutMs = timeoutMs;
  }

  /** The tenant every call is scoped to. */
  get tenant(): string {
    return this.tenantId;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    { body, query }: { body?: unknown; query?: Record<string, string | number> } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const qs = Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qs) url += `?${qs}`;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_REQUEST_RETRIES; attempt++) {
      if (attempt > 0) {
        // Bounded exponential backoff: 500ms, 1000ms.
        await new Promise<void>(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_REQUEST_RETRIES) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }
          await throwFaceIndexError(response);
        }

        const text = await response.text();
        return (text.trim() ? JSON.parse(text) : {}) as T;
      } catch (err) {
        // Network failures are worth one more try; API errors are not.
        const isAbort = (err as any)?.name === 'AbortError';
        const isApiError = (err as any)?.name === 'FaceIndexError';
        if (isApiError || attempt >= MAX_REQUEST_RETRIES) {
          if (isAbort) {
            throw new ValidationError(
              `The face indexing server at ${this.baseUrl} did not respond within ${this.timeoutMs}ms.`,
            );
          }
          throw err;
        }
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ValidationError(`Could not reach the face indexing server at ${this.baseUrl}.`);
  }

  /** Fills in name and contentType from the URI, and rejects unsupported formats. */
  private describeImage(image: LocalFaceImage): EnrollImageDescriptor {
    const fallbackName = image.uri.split('/').pop()?.split('?')[0] ?? 'face.jpg';
    const name = (image.name ?? fallbackName).trim();
    const contentType = (image.contentType ?? getMimeType(name)).toLowerCase();

    if (!name || name.length > 255) {
      throw new ValidationError(`Image name must be 1–255 characters — received: "${name}"`);
    }
    if (!SUPPORTED_FACE_IMAGE_TYPES.includes(contentType as any)) {
      throw new ValidationError(
        `Unsupported image type "${contentType}" for ${name}. ` +
        `Face indexing accepts ${SUPPORTED_FACE_IMAGE_TYPES.join(', ')}.`,
      );
    }
    return { name, contentType };
  }

  // ─── Health ────────────────────────────────────────────────────────────────

  /** True when the server is reachable and its database is ready. */
  async isReady(): Promise<boolean> {
    try {
      const res = await this.request<{ status?: string }>('GET', '/readyz');
      return res?.status === 'ready';
    } catch {
      return false;
    }
  }

  // ─── Enrollment ────────────────────────────────────────────────────────────

  /** Creates the subject and returns one presigned upload URL per image. */
  async enroll(images: EnrollImageDescriptor[]): Promise<EnrollResponse> {
    if (images.length < MIN_ENROLL_IMAGES || images.length > MAX_ENROLL_IMAGES) {
      throw new ValidationError(
        `Enrollment accepts ${MIN_ENROLL_IMAGES}–${MAX_ENROLL_IMAGES} images — received ${images.length}.`,
      );
    }
    return this.request<EnrollResponse>('POST', '/v1/enroll', {
      body: { tenant_id: this.tenantId, images },
    });
  }

  /**
   * Creates the subject and PUTs every image to its presigned URL.
   * Returns as soon as S3 has the bytes — the embeddings are not ready yet.
   */
  async enrollImages(images: LocalFaceImage[]): Promise<EnrollResponse> {
    const descriptors = images.map(image => this.describeImage(image));

    // Read every file before creating the subject, so a bad URI fails before
    // it leaves a half-uploaded subject behind on the server.
    const sources = await Promise.all(images.map(image => resolveUri(image.uri)));

    const enrollment = await this.enroll(descriptors);

    if (enrollment.faces.length !== sources.length) {
      throw new ValidationError(
        `Server returned ${enrollment.faces.length} upload URLs for ${sources.length} images.`,
      );
    }

    // The response preserves the order of `images`.
    for (let i = 0; i < enrollment.faces.length; i++) {
      const face = enrollment.faces[i];
      const contentType = face.headers?.['Content-Type'] ?? descriptors[i].contentType;
      await putToPresignedUrl(face.upload_url, sources[i], contentType);
    }

    return enrollment;
  }

  // ─── Tenant data ───────────────────────────────────────────────────────────

  /** Every subject and face for this tenant. */
  async getTenant(): Promise<TenantResponse> {
    return this.request<TenantResponse>('GET', '/v1/tenant', {
      query: { tenant_id: this.tenantId },
    });
  }

  /** All faces recorded for one subject, merged across duplicate subject rows. */
  async getSubjectFaces(subjectId: string): Promise<TenantFace[] | undefined> {
    const tenant = await this.getTenant();
    const matches = (tenant.subjects ?? []).filter(
      (s: TenantSubject) => s.subject_id === subjectId,
    );
    if (matches.length === 0) return undefined;
    return ([] as TenantFace[]).concat(...matches.map(s => s.faces ?? []));
  }

  /** Polls until every face of the subject is `processed` or `failed`. */
  async waitForEnrollment(
    subjectId: string,
    { interval = 2000, timeout = 120_000 }: EnrollmentPollingOptions = {},
  ): Promise<EnrollmentResult> {
    const deadline = Date.now() + timeout;

    while (true) {
      const faces = await this.getSubjectFaces(subjectId);

      if (faces && faces.length > 0) {
        const settled = faces.every(f => TERMINAL_FACE_STATUSES.includes(f.status));
        if (settled) {
          return {
            subject_id: subjectId,
            faces,
            processedCount: faces.filter(f => f.status === 'processed').length,
            failedCount: faces.filter(f => f.status === 'failed').length,
          };
        }
      }

      if (Date.now() >= deadline) {
        const statuses = faces?.map(f => f.status).join(', ') ?? 'subject not found';
        throw new ValidationError(
          `Timed out waiting for enrollment ${subjectId} — last status: ${statuses}`,
        );
      }

      await new Promise<void>(resolve => setTimeout(resolve, interval));
    }
  }

  /** Enroll, upload, and wait for every embedding to settle. */
  async enrollAndWait(
    images: LocalFaceImage[],
    polling?: EnrollmentPollingOptions,
  ): Promise<EnrollmentResult> {
    const enrollment = await this.enrollImages(images);
    return this.waitForEnrollment(enrollment.subject_id, polling);
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Ranks enrolled faces against a query image supplied as standard Base64.
   * Only faces with `status: "processed"` are searchable.
   */
  async search(imageBase64: string, { limit = MAX_SEARCH_LIMIT }: { limit?: number } = {}): Promise<SearchResponse> {
    const bytes = toBase64Url(String(imageBase64 ?? '').replace(/^data:[^,]+,/, ''));
    if (!bytes) {
      throw new ValidationError('A query image is required to search faces.');
    }

    return this.request<SearchResponse>('GET', '/v1/search', {
      query: {
        tenant_id: this.tenantId,
        image_bytes: bytes,
        limit: Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT),
      },
    });
  }

  /** Reads a local image and searches with it. Compress large photos first. */
  async searchByUri(uri: string, options?: { limit?: number }): Promise<SearchResponse> {
    return this.search(await readFileAsBase64(uri), options);
  }
}

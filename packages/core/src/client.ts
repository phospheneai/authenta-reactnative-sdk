/**
 * AuthentaClient — the single entry point to the Authenta API.
 *
 * Holds the host and API key, and hands both to the feature modules:
 *   uploadAndPoll   detection            core/faceintelligence.ts
 *   faceEnrol       index a person       core/faceauth.ts
 *   faceSearch      match a face         core/faceauth.ts
 *   tenants         list what is indexed core/faceauth.ts
 */

import { faceEnrol, faceSearch, tenants } from './core/faceauth';
import { uploadAndPoll } from './core/faceintelligence';
import type { RequestContext } from './utils/common';
import type {
  CreateMediaResponse,
  ModelType,
  ProcessedMedia,
  RunOptions,
} from './types';
import type {
  EnrollResponse,
  LocalFaceImage,
  SearchResponse,
  TenantResponse,
} from './types/faceauth';

export interface AuthentaClientConfig {
  baseUrl: string;
  api_key: string;
  auth_enabled: boolean;
}

export class AuthentaClient {
  private readonly ctx: RequestContext;

  constructor({ baseUrl, api_key, auth_enabled }: AuthentaClientConfig) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth_enabled) headers['Authorization'] = `Bearer ${api_key}`;

    this.ctx = { baseUrl: baseUrl.replace(/\/$/, ''), headers };
  }

  // ─── Detection ─────────────────────────────────────────────────────────────

  /**
   * Upload a photo or video and run a detection model over it.
   *
   * @example liveness
   *   await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', { livenessCheck: true });
   * @example faceswap (video only)
   *   await client.uploadAndPoll('file:///clip.mp4', 'FI-1', { faceswapCheck: true });
   * @example similarity
   *   await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
   *     faceSimilarityCheck: true, referenceImage: 'file:///id.jpg',
   *   });
   */
  uploadAndPoll(
    uri: string,
    modelType: ModelType,
    options?: RunOptions,
  ): Promise<ProcessedMedia | CreateMediaResponse> {
    return uploadAndPoll(this.ctx, uri, modelType, options);
  }

  // ─── Face indexing ─────────────────────────────────────────────────────────

  /** Enrol photos of one person: create the subject and upload each image. */
  faceEnrol(images: LocalFaceImage[]): Promise<EnrollResponse> {
    return faceEnrol(this.ctx, images);
  }

  /** Rank enrolled faces against a photo — a local file URI or Base64. */
  faceSearch(image: string, options?: { limit?: number }): Promise<SearchResponse> {
    return faceSearch(this.ctx, image, options);
  }

  /** Every subject and face on the account. */
  tenants(): Promise<TenantResponse> {
    return tenants(this.ctx);
  }
}

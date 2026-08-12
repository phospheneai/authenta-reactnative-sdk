/**
 * Detection — upload media, poll the job, return the model's verdict.
 *
 * Exposed as `client.uploadAndPoll()`.
 */

import { AuthentaError, ValidationError } from '../errors';
import { putToPresignedUrl } from '../internal/fileSource';
import { request, resolveUri } from '../utils/common';
import type { RequestContext, ResolvedUploadSource } from '../utils/common';
import { getMimeType, isImage, isVideo } from '../utils/helpers';
import type {
  CreateMediaResponse,
  DetectionResult,
  ModelType,
  PollingOptions,
  ProcessedMedia,
  RunOptions,
} from '../types';

const JOBS = '/api/v1/jobs';
const TERMINAL_STATUSES = new Set(['COMPLETED', 'PROCESSED', 'FAILED', 'ERROR']);

const TASK_IDS: Record<string, string> = {
  'AC-1': '1', 'AF-1': '2', 'VF-1': '3', 'DF-1': '4', 'FD-1': '5',
  'DI-1': '6', 'FL-1': '7', 'FI-1': '8', 'FE-1': '9',
};

export function taskIdFor(modelType: ModelType): string {
  const id = TASK_IDS[modelType.toUpperCase()];
  if (!id) throw new ValidationError(`Unsupported modelType: ${modelType}`);
  return id;
}

/** Creates the job record and uploads every input to its signed S3 URL. */
async function upload(
  ctx: RequestContext,
  uri: string,
  modelType: ModelType,
  options: RunOptions,
): Promise<CreateMediaResponse> {
  const media = await resolveUri(uri);
  if (options.contentType) media.type = options.contentType;

  const inputs = [{
    slotName: 'original',
    contentType: media.type,
    fileName: media.name,
    sizeBytes: media.size,
  }];

  let reference: ResolvedUploadSource | undefined;
  let parameters: Record<string, boolean | string> | undefined;

  if (modelType.toUpperCase() === 'FI-1') {
    // Only send truthy flags — the API treats absent fields as false.
    parameters = { version: 'v1' };
    if (options.faceswapCheck) parameters.isFaceswapCheck = true;
    if (options.livenessCheck) parameters.isLivenessCheck = true;
    if (options.faceSimilarityCheck) parameters.isSimilarityCheck = true;
    if (options.isSingleFace !== undefined) parameters.isSingleFace = options.isSingleFace;

    // The reference slot only exists when a similarity check is requested.
    if (options.faceSimilarityCheck && options.referenceImage) {
      reference = await resolveUri(options.referenceImage);
      inputs.push({
        slotName: 'reference',
        contentType: reference.type,
        fileName: reference.name,
        sizeBytes: reference.size,
      });
    }
  }

  const job = await request<CreateMediaResponse>(ctx, 'POST', JOBS, { taskTypeId: taskIdFor(modelType), inputs, parameters });

  await putToPresignedUrl(job.inputs[0].uploadUrl, media);
  if (reference) {
    if (!job.inputs[1]?.uploadUrl) throw new AuthentaError('No reference uploadUrl returned from server');
    await putToPresignedUrl(job.inputs[1].uploadUrl, reference);
  }
  return job;
}

/** Polls the job until it reaches a terminal status. */
async function poll(
  ctx: RequestContext,
  jobId: string,
  { interval = 5000, timeout = 600_000 }: PollingOptions,
): Promise<ProcessedMedia> {
  const deadline = Date.now() + timeout;
  while (true) {
    const media = await request<ProcessedMedia>(ctx, 'GET', `${JOBS}/${jobId}`);
    if (TERMINAL_STATUSES.has(media.status.toUpperCase())) return media;
    if (Date.now() >= deadline) {
      throw new AuthentaError(`Timed out waiting for media ${jobId} — last status: ${media.status}`);
    }
    await new Promise<void>(r => setTimeout(r, interval));
  }
}

/** Downloads the result artifact, falling back to the job's inline result. */
async function fetchResult(media: ProcessedMedia): Promise<DetectionResult> {
  const artifact = (media.artifacts ?? []).find(a => a.kind === 'result');
  if (artifact) {
    if (!artifact.downloadUrl) {
      throw new AuthentaError('Result artifact has no downloadUrl — ensure processing is complete');
    }
    const response = await fetch(artifact.downloadUrl);
    if (!response.ok) {
      throw new AuthentaError(`Failed to fetch result artifact: HTTP ${response.status}`, undefined, response.status);
    }
    return response.json() as Promise<DetectionResult>;
  }
  if (media.result) return media.result;
  throw new AuthentaError('No result available — ensure processing is complete');
}

/**
 * Upload a file URI and process it with the given model. Name, type, and size
 * are derived from the URI.
 *
 * - For FI-1: pass any face-check flags; unset flags default to false.
 * - Set `autoPolling: false` to return immediately after upload.
 */
export async function uploadAndPoll(
  ctx: RequestContext,
  uri: string,
  modelType: ModelType,
  options: RunOptions = {},
): Promise<ProcessedMedia | CreateMediaResponse> {
  const { autoPolling = true, isSingleFace = true, ...rest } = options;

  if (modelType.toUpperCase() === 'FI-1') {
    const type = getMimeType(uri.split('/').pop() ?? '');
    if (isImage(type) && rest.faceswapCheck) {
      throw new ValidationError('faceswapCheck cannot be true for image files');
    }
    if (isVideo(type) && rest.faceSimilarityCheck) {
      throw new ValidationError('faceSimilarityCheck cannot be true for video files');
    }
    if (rest.faceSimilarityCheck && !rest.referenceImage) {
      throw new ValidationError('referenceImage is required when faceSimilarityCheck is true');
    }
  }

  const job = await upload(ctx, uri, modelType, { ...rest, isSingleFace });
  await request<void>(ctx, 'POST', `${JOBS}/${job.job.id}/finalize`);
  if (!autoPolling) return job;

  const media = await poll(ctx, job.job.id, rest);
  return { ...media, result: await fetchResult(media) };
}

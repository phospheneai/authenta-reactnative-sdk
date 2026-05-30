// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1  ·  FACESWAP / DEEPFAKE CHECK  (video only)
//
//  HOW TO RUN
//    npx ts-node examples/core/02-faceswap-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { ProcessedMedia, DetectionResult } from '@authenta/core';

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

// faceswap check requires a video — passing an image throws ValidationError
const VIDEO_URI = 'file:///path/to/clip.mp4';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION A — uploadAndPoll()                                             │
// └─────────────────────────────────────────────────────────────────────────┘

async function withUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const media = await client.uploadAndPoll(VIDEO_URI, 'FI-1', {
    faceswapCheck: true,
  }) as ProcessedMedia;

  console.log('id        :', media.id);
  console.log('status    :', media.status);
  console.log('isDeepFake:', media.result?.isDeepFake);  // false = real, true = AI-swapped

  //  ─── RESULT FIELDS (FI-1 faceswap) ──────────────────────────────────────
  //  isDeepFake → true means face-swap manipulation was detected
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION B — verify_deepfake()  (shortcut wrapper)                       │
// └─────────────────────────────────────────────────────────────────────────┘

async function withVerifyHelper(): Promise<void> {
  console.log('\n━━ verify_deepfake() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result: DetectionResult = await client.verify_deepfake(VIDEO_URI);

  console.log('isDeepFake:', result.isDeepFake);
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION C — step by step                                                │
// └─────────────────────────────────────────────────────────────────────────┘

async function stepByStep(): Promise<void> {
  console.log('\n━━ step by step ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const meta = await client.upload(VIDEO_URI, 'FI-1', { faceswapCheck: true });
  console.log('job id:', meta.job.id);

  await client.finalizeMedia(meta.job.id);

  const media = await client.pollResult(meta.job.id);
  console.log('status:', media.status);

  const result = await client.getResult(media);
  console.log('isDeepFake:', result.isDeepFake);
}


async function main() {
  await withUploadAndPoll();
  await withVerifyHelper();
  await stepByStep();
}

main().catch(console.error);

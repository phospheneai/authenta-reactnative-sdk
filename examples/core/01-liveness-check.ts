// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1  ·  LIVENESS CHECK
//
//  HOW TO RUN
//    npx ts-node examples/core/01-liveness-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { ProcessedMedia, DetectionResult } from '@authenta/core';

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  STEP 0 — Create the client (once per app lifetime)                     │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  api_key       → your secret key from the Authenta dashboard
//  auth_enabled  → set true whenever an api_key is provided
//  baseUrl       → optional, default is correct for production

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

const IMAGE_URI = 'file:///path/to/selfie.jpg';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION A — uploadAndPoll()  (recommended for most cases)               │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  Runs the full pipeline in one call:
//    upload()  →  finalizeMedia()  →  pollResult()  →  getResult()
//
//  Returns a ProcessedMedia object with the result already embedded.

async function withUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const media = await client.uploadAndPoll(IMAGE_URI, 'FI-1', {
    livenessCheck: true,
  }) as ProcessedMedia;

  console.log('id     :', media.id);
  console.log('status :', media.status);   // "completed"
  console.log('isSpoof:', media.result?.isSpoof);  // false = live person

  //  ─── RESULT FIELDS (FI-1 liveness) ──────────────────────────────────────
  //  isSpoof  → false means the face is real (live), true means spoofed
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION B — verify_liveness()  (shortcut wrapper)                       │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  Identical to uploadAndPoll() with livenessCheck: true, but returns only
//  the DetectionResult instead of the full ProcessedMedia wrapper.

async function withVerifyHelper(): Promise<void> {
  console.log('\n━━ verify_liveness() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result: DetectionResult = await client.verify_liveness(IMAGE_URI);

  console.log('isSpoof:', result.isSpoof);
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION C — step by step  (for progress bars / custom retry logic)      │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  Use the individual methods when you need to hook into each stage.

async function stepByStep(): Promise<void> {
  console.log('\n━━ step by step ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Create a job and get the S3 upload URLs
  const meta = await client.upload(IMAGE_URI, 'FI-1', { livenessCheck: true });
  console.log('job id:', meta.job.id);
  console.log('status after create:', meta.job.status);  // "initiated"

  // 2. Signal the server that all files have been uploaded
  await client.finalizeMedia(meta.job.id);
  console.log('finalized — job is now queued');

  // 3. Poll until the AI finishes
  const media = await client.pollResult(meta.job.id, {
    interval: 3_000,   // check every 3 s
    timeout:  120_000, // give up after 2 min
  });
  console.log('status after processing:', media.status);  // "completed"

  // 4. Download the result JSON from the S3 artifact
  const result = await client.getResult(media);
  console.log('isSpoof:', result.isSpoof);
}


async function main() {
  await withUploadAndPoll();
  await withVerifyHelper();
  await stepByStep();
}

main().catch(console.error);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FE-1  ·  FACE EMBEDDINGS
//
//  HOW TO RUN
//    npx ts-node examples/core/04-face-embeddings.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { ProcessedMedia, DetectionResult } from '@authenta/core';

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

const IMAGE_URI = 'file:///path/to/selfie.jpg';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION A — uploadAndPoll()                                             │
// └─────────────────────────────────────────────────────────────────────────┘

async function withUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // FE-1 takes no extra options — just the model type
  const media = await client.uploadAndPoll(IMAGE_URI, 'FE-1') as ProcessedMedia;

  console.log('id        :', media.id);
  console.log('status    :', media.status);
  console.log('faceVector:', media.result?.faceVector?.slice(0, 4), '...');

  //  ─── RESULT FIELDS (FE-1) ────────────────────────────────────────────────
  //  faceVector → numeric embedding array; use cosine distance to compare faces
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION B — verify_face_embeddings()  (shortcut wrapper)                │
// └─────────────────────────────────────────────────────────────────────────┘

async function withVerifyHelper(): Promise<void> {
  console.log('\n━━ verify_face_embeddings() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result: DetectionResult = await client.verify_face_embeddings(IMAGE_URI);

  console.log('faceVector:', result.faceVector?.slice(0, 4), '...');
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION C — step by step                                                │
// └─────────────────────────────────────────────────────────────────────────┘

async function stepByStep(): Promise<void> {
  console.log('\n━━ step by step ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const meta = await client.upload(IMAGE_URI, 'FE-1');
  console.log('job id:', meta.job.id);

  await client.finalizeMedia(meta.job.id);

  const media = await client.pollResult(meta.job.id);
  console.log('status:', media.status);

  const result = await client.getResult(media);
  console.log('faceVector length:', result.faceVector?.length);
}


async function main() {
  await withUploadAndPoll();
  await withVerifyHelper();
  await stepByStep();
}

main().catch(console.error);

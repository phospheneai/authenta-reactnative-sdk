// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1  ·  FACE SIMILARITY CHECK  (photo + reference)
//
//  HOW TO RUN
//    npx ts-node examples/core/03-face-similarity-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { ProcessedMedia, DetectionResult } from '@authenta/core';

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

// Both must be images — passing a video throws ValidationError
const IMAGE_URI = 'file:///path/to/selfie.jpg';
const REF_URI   = 'file:///path/to/id-photo.jpg';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION A — uploadAndPoll()                                             │
// └─────────────────────────────────────────────────────────────────────────┘

async function withUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const media = await client.uploadAndPoll(IMAGE_URI, 'FI-1', {
    faceSimilarityCheck: true,
    referenceImage:      REF_URI,   // required when faceSimilarityCheck is true
  }) as ProcessedMedia;

  console.log('id             :', media.id);
  console.log('status         :', media.status);
  console.log('isSimilar      :', media.result?.isSimilar);
  console.log('similarityScore:', media.result?.similarityScore);

  //  ─── RESULT FIELDS (FI-1 similarity) ────────────────────────────────────
  //  isSimilar       → true means the two faces belong to the same person
  //  similarityScore → confidence value (0–100)
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION B — verify_similarity()  (shortcut wrapper)                     │
// └─────────────────────────────────────────────────────────────────────────┘

async function withVerifyHelper(): Promise<void> {
  console.log('\n━━ verify_similarity() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Both uri and referenceImage are required
  const result: DetectionResult = await client.verify_similarity(IMAGE_URI, REF_URI);

  console.log('isSimilar      :', result.isSimilar);
  console.log('similarityScore:', result.similarityScore);
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  OPTION C — step by step                                                │
// └─────────────────────────────────────────────────────────────────────────┘

async function stepByStep(): Promise<void> {
  console.log('\n━━ step by step ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const meta = await client.upload(IMAGE_URI, 'FI-1', {
    faceSimilarityCheck: true,
    referenceImage:      REF_URI,
  });
  console.log('job id:', meta.job.id);
  console.log('upload slots returned:', meta.inputs.map(i => i.slotName));
  // ["original", "reference"] — both uploaded automatically by upload()

  await client.finalizeMedia(meta.job.id);

  const media = await client.pollResult(meta.job.id);
  console.log('status:', media.status);

  const result = await client.getResult(media);
  console.log('isSimilar      :', result.isSimilar);
  console.log('similarityScore:', result.similarityScore);
}


async function main() {
  await withUploadAndPoll();
  await withVerifyHelper();
  await stepByStep();
}

main().catch(console.error);

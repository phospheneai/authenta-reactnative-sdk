// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1 Model  ·  FACE SIMILARITY CHECK
//  Every function in the SDK demonstrated one by one.
//
//
//  IMPORTANT RULES FOR FACE SIMILARITY CHECK
//    ✓ Both files MUST be PHOTOS (not videos)
//    ✓ referenceImage must always be provided alongside faceSimilarityCheck: true
//    ✗ Cannot be combined with faceswapCheck (faceswap requires video)
//
//  TWO FILES ARE UPLOADED IN ONE CALL
//    When faceSimilarityCheck is true, upload() sends:
//      File 1 → the live selfie   → goes to uploadUrl
//      File 2 → the reference photo → goes to referenceUploadUrl
//    The server compares them after both arrive.
//
//  HOW TO RUN THIS FILE
//    npx ts-node examples/core/03-face-similarity-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { CreateMediaResponse, MediaRecord, DetectionResult } from '@authenta/core';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 1 — Create the client                                             │
// └─────────────────────────────────────────────────────────────────────────┘

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  clientId:     '',
  clientSecret: '',
});

//  ─── OUTPUT ─────────────────────────────────────────────────────────────────
//  (no output — object created in memory)


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 2 — createMedia()                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Registers the selfie with the server and gets back:
//      • mid           → the job ID
//      • uploadUrl     → S3 link for the LIVE selfie
//      • referenceUploadUrl → S3 link for the REFERENCE photo  ← new field!
//
//  NOTICE THE EXTRA FIELD IN THE RESPONSE
//    Because faceSimilarityCheck is true, the server also returns a second
//    upload URL (referenceUploadUrl). You must PUT your reference photo
//    to that URL separately.
//
//    upload() handles this automatically. Use createMedia() directly only
//    if you need total control over each upload step.

async function demonstrateCreateMedia(): Promise<CreateMediaResponse> {
  console.log('\n━━ createMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const mediaRecord = await client.createMedia({
    name:        'selfie.jpg',
    contentType: 'image/jpeg',
    size:        310_000,
    modelType:   'FI-1',
    metadata: {
      faceSimilarityCheck: true,    // ← ONLY flag set to true
    },
  });

  console.log('mid:                   ', mediaRecord.mid);
  console.log('status:                ', mediaRecord.status);
  console.log('uploadUrl:             ', mediaRecord.uploadUrl.substring(0, 55) + '…');
  console.log('referenceUploadUrl:    ', mediaRecord.referenceUploadUrl?.substring(0, 55) + '…');

  return mediaRecord;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:                    "88d5h3e4d0g1f29h5e3c7g44"
  //  status:                 "PENDING"
  //  uploadUrl:              "https://s3.amazonaws.com/authenta-uploads/88d5h3e4…"
  //  referenceUploadUrl:     "https://s3.amazonaws.com/authenta-uploads/ref-88d5…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  Two upload URLs are returned — one for each photo.
  //    uploadUrl          → send the live selfie here
  //    referenceUploadUrl → send the reference photo (ID card face) here
  //
  //  Both must be uploaded before the AI can run the comparison.
  //  If referenceUploadUrl is missing, the server did not understand the
  //  faceSimilarityCheck flag — check the metadata you sent.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 3 — upload()                                                      │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Handles the FULL two-file upload in one call:
//      1. Reads the selfie file from storage
//      2. Calls createMedia() to register both files and get two S3 URLs
//      3. PUTs the selfie to uploadUrl
//      4. Reads the reference photo from storage
//      5. PUTs the reference photo to referenceUploadUrl
//
//  THIS IS THE KEY DIFFERENCE vs OTHER CHECKS
//    For liveness or faceswap, upload() sends ONE file.
//    For face similarity, upload() sends TWO files automatically.
//    You just provide the referenceImage path — the SDK does the rest.

async function demonstrateUpload(): Promise<CreateMediaResponse> {
  console.log('\n━━ upload() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const uploaded = await client.upload(
    'file:///path/to/selfie.jpg',             // live selfie (the person at the camera)
    'FI-1',
    {
      faceSimilarityCheck: true,              // ← similarity only
      referenceImage: 'file:///path/to/id-card-face.jpg',  // ← required
    },
  );

  console.log('mid:           ', uploaded.mid);
  console.log('name:          ', uploaded.name);
  console.log('contentType:   ', uploaded.contentType);
  console.log('size (bytes):  ', uploaded.size);
  console.log('status:        ', uploaded.status);
  console.log('createdAt:     ', uploaded.createdAt);

  return uploaded;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "88d5h3e4d0g1f29h5e3c7g44"
  //  name:           "selfie.jpg"
  //  contentType:    "image/jpeg"
  //  size (bytes):   310000
  //  status:         "PENDING"
  //  createdAt:      "2025-05-05T11:20:44.000Z"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  Both photos are now uploaded. The AI will:
  //    Step 1 → detect the face in selfie.jpg
  //    Step 2 → detect the face in id-card-face.jpg
  //    Step 3 → compute a similarity score between the two face embeddings
  //    Step 4 → return isSimilar (true/false) + similarityScore (0.0–1.0)
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 4 — pollResult()                                                  │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Waits for the face comparison to complete.
//    Asks "done?" every few seconds until status becomes terminal.
//
//  TIMING
//    Face similarity processes two images so it may take a little longer
//    than a single liveness check. A 60-second timeout is usually enough.

async function demonstratePollResult(mid: string): Promise<MediaRecord> {
  console.log('\n━━ pollResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const finished = await client.pollResult(mid, {
    interval: 3_000,   // check every 3 seconds
    timeout:  60_000,  // give up after 60 seconds
  });

  console.log('mid:           ', finished.mid);
  console.log('status:        ', finished.status);
  console.log('resultURL:     ', finished.resultURL?.substring(0, 60) + '…');

  return finished;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  (waiting a few seconds…)
  //
  //  mid:            "88d5h3e4d0g1f29h5e3c7g44"
  //  status:         "PROCESSED"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/88d5h3e4…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  "PROCESSED" → both photos were analysed and the comparison is ready.
  //  resultURL holds the answer JSON — we download it in the next step.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 5 — getResult()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Downloads the face comparison result from the server.
//
//  KEY OUTPUT FIELDS FOR FACE SIMILARITY CHECK
//    isSimilar        → true  = same person (faces match)
//                       false = different people (faces do not match)
//    similarityScore  → decimal between 0.0 and 1.0
//                       Higher is a closer match. Typical threshold: 0.75–0.85
//
//  HOW TO READ THE SCORE
//    0.95 – 1.00  →  very high confidence, almost certainly the same person
//    0.80 – 0.94  →  high confidence, same person
//    0.65 – 0.79  →  borderline — consider asking user to retry
//    0.00 – 0.64  →  low confidence, likely different people

async function demonstrateGetResult(finished: MediaRecord): Promise<DetectionResult> {
  console.log('\n━━ getResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result = await client.getResult(finished);

  const score = parseFloat(String(result.similarityScore ?? 0));

  console.log('isSimilar:       ', result.isSimilar);
  console.log('similarityScore: ', score.toFixed(4));
  console.log('verdict:         ', score >= 0.80 ? '✅ MATCH' : score >= 0.65 ? '⚠️  REVIEW' : '❌ NO MATCH');
  console.log('full result:     ', JSON.stringify(result, null, 2));

  return result;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  isSimilar:        true
  //  similarityScore:  0.9142
  //  verdict:          ✅ MATCH
  //  full result:      {
  //                      "isSimilar": true,
  //                      "similarityScore": 0.9142,
  //                      "resultType": "face_similarity",
  //                      "isLiveness": null,
  //                      "isDeepFake": null
  //                    }
  //
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 6 — uploadAndPoll()   ← the one-call shortcut                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    The full pipeline — upload both photos, wait, get result — in one call.
//    This is what you use in production. Cells 2–5 show the internals.

async function demonstrateUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const processed = await client.uploadAndPoll(
    'file:///path/to/selfie.jpg',
    'FI-1',
    {
      faceSimilarityCheck: true,
      referenceImage:      'file:///path/to/id-card-face.jpg',
    },
  );

  const score = parseFloat(String(processed.result?.similarityScore ?? 0));

  console.log('mid:             ', processed.mid);
  console.log('status:          ', processed.status);
  console.log('isSimilar:       ', processed.result?.isSimilar);
  console.log('similarityScore: ', score.toFixed(4));

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:              "88d5h3e4d0g1f29h5e3c7g44"
  //  status:           "PROCESSED"
  //  isSimilar:        true
  //  similarityScore:  0.9142
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  Same answer as the step-by-step approach — just fewer lines of code.
  //  The referenceImage is automatically sent as the second file upload.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 7 — getMedia()                                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Retrieves the stored record for a job using its mid.
//    If you saved the mid after the upload, you can re-read the result
//    later without re-uploading the photos.

async function demonstrateGetMedia(mid: string): Promise<void> {
  console.log('\n━━ getMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const record = await client.getMedia(mid);

  console.log('mid:           ', record.mid);
  console.log('status:        ', record.status);
  console.log('modelType:     ', record.modelType);
  console.log('contentType:   ', record.contentType);
  console.log('size (bytes):  ', record.size);
  console.log('createdAt:     ', record.createdAt);
  console.log('srcURL:        ', record.srcURL   ?? 'N/A');
  console.log('resultURL:     ', record.resultURL ?? 'not ready');

  // If it is already PROCESSED you can call getResult() again without polling
  if (record.status === 'PROCESSED') {
    const result = await client.getResult(record);
    console.log('\nRe-fetched result without re-uploading:');
    console.log('  isSimilar:      ', result.isSimilar);
    console.log('  similarityScore:', result.similarityScore);
  }

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "88d5h3e4d0g1f29h5e3c7g44"
  //  status:         "PROCESSED"
  //  modelType:      "FI-1"
  //  contentType:    "image/jpeg"
  //  size (bytes):   310000
  //  createdAt:      "2025-05-05T11:20:44.000Z"
  //  srcURL:         "https://s3.amazonaws.com/authenta-uploads/88d5h3e4…"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/88d5h3e4…"
  //
  //  Re-fetched result without re-uploading:
  //    isSimilar:       true
  //    similarityScore: 0.9142
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  You can always re-read a result using just the mid — no need to upload
  //  the photos again. This is useful for building an audit log or history view.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 8 — listMedia()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Lists all records across your account with pagination.
//    You can use this to find old similarity jobs by date.

async function demonstrateListMedia(): Promise<void> {
  console.log('\n━━ listMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const response = await client.listMedia({ page: 1, pageSize: 5 });

  console.log('total records: ', response.total);
  console.log('on this page:  ', response.items.length);
  console.log('');

  response.items.forEach((item, i) => {
    console.log(`  [${i + 1}]  ${item.mid}  |  ${item.status}  |  ${item.contentType}  |  ${item.createdAt}`);
  });

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  total records:  31
  //  on this page:   5
  //
  //  [1]  88d5h3e4d0g1f29h5e3c7g44  |  PROCESSED   |  image/jpeg  |  2025-05-05T11:20:44Z
  //  [2]  87c4g2d3c9f0e18g4d2b6f33  |  PROCESSED   |  image/jpeg  |  2025-05-05T09:15:32Z
  //  [3]  86b3f1c2b8e9d07f3c1a5e22  |  PROCESSED   |  image/jpeg  |  2025-05-04T18:30:00Z
  //  [4]  85a2e0b1a7d8c06f2b0a4d11  |  FAILED      |  image/jpeg  |  2025-05-04T15:12:44Z
  //  [5]  84f1d9a0f6c7b05e1a9c3c00  |  PROCESSED   |  image/png   |  2025-05-03T10:05:20Z
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  contentType "image/jpeg" and "image/png" confirm these were photo jobs.
  //  FAILED in row 4 → likely the face could not be detected in one of the
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 9 — deleteMedia()                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Permanently removes the job record and BOTH uploaded photos from the server.
//
//  PRIVACY NOTE
//    Face photos are sensitive personal data (biometric data).
//    After you have stored the similarity verdict in your own database,
//    delete the record from Authenta to minimise data retention.

async function demonstrateDeleteMedia(mid: string): Promise<void> {
  console.log('\n━━ deleteMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.deleteMedia(mid);
  console.log(`Deleted: ${mid}`);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  Deleted: 88d5h3e4d0g1f29h5e3c7g44
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  Both the selfie and the reference photo are gone from the server.
  //  The result JSON is also deleted. Your local database copy remains.
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RUN ALL CELLS IN ORDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  await demonstrateCreateMedia();
  const uploaded = await demonstrateUpload();
  const finished = await demonstratePollResult(uploaded.mid);
  await demonstrateGetResult(finished);
  await demonstrateUploadAndPoll();
  await demonstrateGetMedia(uploaded.mid);
  await demonstrateListMedia();
  await demonstrateDeleteMedia(uploaded.mid);
}

main().catch(err => { console.error(err); process.exit(1); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1 Model  ·  FACESWAP CHECK
//  Every function in the SDK demonstrated one by one.
//
//    Use it for: fraud prevention in video KYC, video call identity checks.
//
//  IMPORTANT RULES FOR FACESWAP CHECK
//    ✓ Keep it under 10 seconds for best results
//    ✗ Cannot be combined with faceSimilarityCheck in the same call
//
//  HOW TO RUN THIS FILE
//    npx ts-node examples/core/02-faceswap-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { CreateMediaResponse, MediaRecord, DetectionResult } from '@authenta/core';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 1 — Create the client                                             │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  Same setup as every file — credentials stay on the client object so you
//  do not repeat them on every function call.

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
//    Registers your VIDEO with the server before you send the actual bytes.
//    The server returns a signed upload URL and a unique job ID (mid).
//
//  NOTICE  →  contentType is "video/mp4" here, not "image/jpeg"
//             faceswapCheck is the ONLY flag set to true

async function demonstrateCreateMedia(): Promise<CreateMediaResponse> {
  console.log('\n━━ createMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const mediaRecord = await client.createMedia({
    name:        'face-recording.mp4',   // must be a video filename
    contentType: 'video/mp4',            // ← video MIME type
    size:        8_450_000,              // ~8 MB, 10-second clip
    modelType:   'FI-1',
    metadata: {
      faceswapCheck:       true,         // ← ONLY flag set to true
    },
  });

  console.log('mid:           ', mediaRecord.mid);
  console.log('status:        ', mediaRecord.status);
  console.log('uploadUrl:     ', mediaRecord.uploadUrl.substring(0, 60) + '…');

  return mediaRecord;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "77c4g2d3c9f0e18g4d2b6f33"
  //  status:         "PENDING"
  //  uploadUrl:      "https://s3.amazonaws.com/authenta-uploads/77c4g2d3…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  Same as liveness — a job slot is created. Status "PENDING" means no file
  //  has arrived yet. The uploadUrl accepts your video bytes via HTTP PUT.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 3 — upload()                                                      │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Reads the VIDEO file from storage, registers it with createMedia(),
//    then PUTs the video bytes to S3 in one call.
//
//  WHAT HAPPENS INSIDE (you do not need to write this — SDK does it for you)
//    1. Reads face-recording.mp4 → gets name, MIME type, size, raw bytes
//    2. Calls createMedia() with those values + { faceswapCheck: true }
//    3. PUTs the video bytes to the signed S3 URL
//
//  VIDEO PROCESSING NOTE
//    Video files are larger than photos so upload takes a few extra seconds.
//    The AI also takes longer to analyse frame-by-frame — budget extra time
//    in your polling timeout (see cell 4).

async function demonstrateUpload(): Promise<CreateMediaResponse> {
  console.log('\n━━ upload() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const uploaded = await client.upload(
    'file:///path/to/face-recording.mp4',   // local video file
    'FI-1',
    {
      faceswapCheck:       true,            // ← faceswap only
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
  //  mid:            "77c4g2d3c9f0e18g4d2b6f33"
  //  name:           "face-recording.mp4"
  //  contentType:    "video/mp4"
  //  size (bytes):   8450000
  //  status:         "PENDING"
  //  createdAt:      "2025-05-05T10:05:15.000Z"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  The video is now safely uploaded. contentType "video/mp4" confirms the
  //  server received it as a video. The AI will analyse each frame of the clip.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 4 — pollResult()                                                  │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHY VIDEOS NEED A LONGER TIMEOUT
//    The AI scans every frame of the video clip independently, then
//    aggregates the verdicts. A 10-second clip at 30 fps = 300 frames.
//    This takes longer than a single photo scan.
//    → Use a higher timeout (at least 3 minutes for video).

async function demonstratePollResult(mid: string): Promise<MediaRecord> {
  console.log('\n━━ pollResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const finishedRecord = await client.pollResult(mid, {
    interval: 5_000,    // check every 5 seconds (video is slower)
    timeout:  180_000,  // give up after 3 minutes
  });

  console.log('mid:           ', finishedRecord.mid);
  console.log('status:        ', finishedRecord.status);
  console.log('resultURL:     ', finishedRecord.resultURL?.substring(0, 60) + '…');

  return finishedRecord;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  (waiting up to 3 minutes…)
  //
  //  mid:            "77c4g2d3c9f0e18g4d2b6f33"
  //  status:         "PROCESSED"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/77c4g2d3…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  "PROCESSED" → analysis is complete. The video was scanned frame-by-frame
  //  and the results are stored at resultURL.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 5 — getResult()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Downloads the faceswap detection answer from the result URL.
//
//  KEY OUTPUT FIELDS FOR FACESWAP CHECK
//    isDeepFake            → true  = AI-generated face detected in the video
//                            false = video appears genuine
//    identityPredictions   → one entry per face detected in the video.
//                            Each has: identityId (face number) + isDeepFake
//    boundingBoxes         → exact pixel coordinates of each face in each frame.
//                            Use this to draw a highlight box on the video.

async function demonstrateGetResult(finishedRecord: MediaRecord): Promise<DetectionResult> {
  console.log('\n━━ getResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result = await client.getResult(finishedRecord);

  console.log('isDeepFake:            ', result.isDeepFake);
  console.log('identityPredictions:   ', JSON.stringify(result.identityPredictions, null, 2));
  console.log('boundingBoxes (sample):');

  // Print the first face, first frame bounding box
  if (result.boundingBoxes) {
    const firstFaceId    = Object.keys(result.boundingBoxes)[0];
    const firstFaceData  = result.boundingBoxes[firstFaceId];
    const firstFrameId   = Object.keys(firstFaceData.boundingBox)[0];
    const [x, y, w, h]  = firstFaceData.boundingBox[firstFrameId];
    console.log(`  Face #${firstFaceId}  Frame #${firstFrameId}  →  x:${x} y:${y} w:${w} h:${h}  class:${firstFaceData.class}  confidence:${firstFaceData.confidence}`);
  }

  return result;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  isDeepFake:             true
  //  identityPredictions:    [
  //                            { "identityId": 0, "isDeepFake": true }
  //                          ]
  //  boundingBoxes (sample):
  //    Face #0  Frame #12  →  x:120 y:85 w:210 h:240  class:fake  confidence:0.94
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  isDeepFake: true → the video contains a manipulated / AI-swapped face.
  //    Reject this submission.
  //
  //  isDeepFake: false → no manipulation detected.
  //    The video appears genuine. Allow access.
  //
  //  boundingBox [x, y, w, h] → in frame 12, the detected face is at
  //    pixel position (120, 85) and is 210 wide × 240 tall.
  //    confidence 0.94 → the model is 94% sure this is a fake face.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 6 — uploadAndPoll()   ← the one-call shortcut                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    upload() + pollResult() + getResult() in a single line.
//    Returns the completed result directly.
//
//  FOR FACESWAP
//    Set faceswapCheck: true.
//    The file must be a video — passing an image will throw a ValidationError.

async function demonstrateUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const processed = await client.uploadAndPoll(
    'file:///path/to/face-recording.mp4',
    'FI-1',
    {
      faceswapCheck: true,     // ← the only flag needed
      timeout: 180_000,        // 3-minute timeout for video
    },
  );

  console.log('mid:           ', processed.mid);
  console.log('status:        ', processed.status);
  console.log('isDeepFake:    ', processed.result?.isDeepFake);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "77c4g2d3c9f0e18g4d2b6f33"
  //  status:         "PROCESSED"
  //  isDeepFake:     false
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  isDeepFake: false → this video is clean. No face-swap detected.
  //  Use this verdict directly in your access-control or fraud logic.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 7 — getMedia()                                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Fetches the full record for ONE job by its mid.
//    Useful to check status manually, re-read file metadata, or get URLs.

async function demonstrateGetMedia(mid: string): Promise<void> {
  console.log('\n━━ getMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const record = await client.getMedia(mid);

  console.log('mid:           ', record.mid);
  console.log('status:        ', record.status);
  console.log('modelType:     ', record.modelType);
  console.log('contentType:   ', record.contentType);     // "video/mp4"
  console.log('size (bytes):  ', record.size);
  console.log('createdAt:     ', record.createdAt);
  console.log('srcURL:        ', record.srcURL  ?? 'N/A');
  console.log('resultURL:     ', record.resultURL ?? 'not ready');

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "77c4g2d3c9f0e18g4d2b6f33"
  //  status:         "PROCESSED"
  //  modelType:      "FI-1"
  //  contentType:    "video/mp4"        ← confirms this was a video job
  //  size (bytes):   8450000
  //  createdAt:      "2025-05-05T10:05:15.000Z"
  //  srcURL:         "https://s3.amazonaws.com/authenta-uploads/77c4g2d3…"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/77c4g2d3…"
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 8 — listMedia()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Returns a paginated list of all your media records.
//    Each item in the list has the same fields as getMedia() returns.

async function demonstrateListMedia(): Promise<void> {
  console.log('\n━━ listMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const response = await client.listMedia({ page: 1, pageSize: 5 });

  console.log('total records: ', response.total);
  console.log('on this page:  ', response.items.length);
  console.log('');

  response.items.forEach((item, i) => {
    const type = item.contentType.startsWith('video') ? '🎥' : '📷';
    console.log(`  [${i + 1}]  ${type}  ${item.mid}  |  ${item.status}  |  ${item.createdAt}`);
  });

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  total records:  23
  //  on this page:   5
  //
  //  [1]  🎥  77c4g2d3c9f0e18g4d2b6f33  |  PROCESSED   |  2025-05-05T10:05:15Z
  //  [2]  🎥  76b3f1c2b8e9d07g3c1a5e11  |  PROCESSED   |  2025-05-04T18:30:00Z
  //  [3]  📷  75a2e0b1a7d8c06f2b0a4d00  |  PROCESSED   |  2025-05-04T15:12:44Z
  //  [4]  🎥  74f1d9a0f6c7b05e1a9c3b99  |  FAILED      |  2025-05-04T10:08:33Z
  //  [5]  🎥  73e0c8f9e5b6a04d0b8b2b88  |  PROCESSING  |  2025-05-05T10:10:01Z
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  The emoji makes it easy to spot video vs photo jobs at a glance.
  //  FAILED in row 4 → video was too long, blurry, or the face was obscured.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 9 — deleteMedia()                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Permanently deletes the video record and its result from the server.
//    No return value — silence means success.
//
//  IMPORTANT  →  Videos are much larger than photos.
//    Deleting faceswap records promptly is good practice to avoid
//    unnecessary storage costs and to honour user privacy.

async function demonstrateDeleteMedia(mid: string): Promise<void> {
  console.log('\n━━ deleteMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.deleteMedia(mid);
  console.log(`Deleted: ${mid}`);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  Deleted: 77c4g2d3c9f0e18g4d2b6f33
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  The video and its AI result are gone from the server.
  //  Any subsequent call to getMedia(mid) will throw a 404 error.
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RUN ALL CELLS IN ORDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  const videoUri = 'file:///path/to/face-recording.mp4';

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

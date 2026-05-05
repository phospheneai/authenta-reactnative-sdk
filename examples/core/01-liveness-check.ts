// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FI-1 Model  ·  LIVENESS CHECK
//  Every function in the SDK demonstrated one by one.
//
//  HOW TO RUN THIS FILE
//    npx ts-node examples/core/01-liveness-check.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { AuthentaClient } from '@authenta/core';
import type { CreateMediaResponse, MediaRecord, DetectionResult } from '@authenta/core';


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 1 — Create the client                                             │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  Before calling any function you need ONE client object.
//  Think of it like a logged-in session — it holds your credentials
//  so every call is automatically authenticated.
//
//  baseUrl      → the server address  (can leave it out, default is correct)
//  clientId     → your organisation's unique ID  (from the Authenta dashboard)
//  clientSecret → your private key   (never share this, never put it in git)

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  clientId:     '',
  clientSecret: '',
});

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 2 — createMedia()                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHEN TO USE IT DIRECTLY
//    Only if you want full manual control. Normally you call upload() which
//    calls createMedia() for you automatically.

async function demonstrateCreateMedia(): Promise<CreateMediaResponse> {
  console.log('\n━━ createMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const mediaRecord = await client.createMedia({
    name:        'selfie.jpg',       // file name — used for logging on the server
    contentType: 'image/jpeg',       // MIME type — tells the server what kind of file
    size:        245_890,            // file size in bytes
    modelType:   'FI-1',            // which AI model to run
    metadata: {
      livenessCheck:      true,      // ← the ONLY flag set to true for this file
    },
  });

  console.log('mid:           ', mediaRecord.mid);
  console.log('status:        ', mediaRecord.status);
  console.log('uploadUrl:     ', mediaRecord.uploadUrl.substring(0, 60) + '…');

  return mediaRecord;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  status:         "PENDING"
  //  uploadUrl:      "https://s3.amazonaws.com/authenta-uploads/64a3f1c2…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  • mid          → this is your job's tracking number. Save it — you will
  //                   use it for every subsequent call.
  //  • status       → "PENDING" means the slot is booked but no file yet.
  //  • uploadUrl    → a short-lived link. You must PUT your file to this URL
  //                   within a few minutes or it expires.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 3 — upload()                                                      │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    This is the recommended way to send a file. It does THREE things inside:
//      1. Reads the file from your device's storage
//      2. Calls createMedia() to register it (cell 2 above)
//      3. Sends the file bytes directly to cloud storage (S3)
//
//    After upload(), the file is safely stored and AI processing begins
//    in the background. The status will be "PENDING" or "PROCESSING".
//
//  WHY IT IS BETTER THAN CALLING createMedia() MANUALLY
//    upload() handles the S3 PUT step for you. If you only called createMedia()
//    you would still need to send the actual file bytes yourself.
//
//  NOTE  →  only set livenessCheck: true.  The other flags stay false.

async function demonstrateUpload(): Promise<CreateMediaResponse> {
  console.log('\n━━ upload() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const uploaded = await client.upload(
    'file:///path/to/selfie.jpg',     // local photo on the device
    'FI-1',
    {
      livenessCheck:      true,       // ← liveness only
      faceswapCheck:      false,
      faceSimilarityCheck: false,
      isSingleFace:       true,
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
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  name:           "selfie.jpg"
  //  contentType:    "image/jpeg"
  //  size (bytes):   245890
  //  status:         "PENDING"
  //  createdAt:      "2025-05-05T09:15:32.000Z"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  • The file is now securely stored in the cloud.
  //  • status "PENDING" = the AI model has not started analysing yet.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 4 — pollResult()                                                  │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    After uploading, the AI model processes the photo in the background.
//    pollResult() keeps asking the server "is it done yet?" every few seconds
//    until the answer is yes (or until it times out).
//
//    It stops when status becomes one of:
//      PROCESSED → success, result is ready
//      FAILED    → the model could not process the file
//      ERROR     → something went wrong on the server
//
//  PARAMETERS
//    mid      → the tracking ID you got from upload()
//    interval → how often to ask (in milliseconds). Default: 5000 (5 seconds)
//    timeout  → give up after this many ms.         Default: 600000 (10 min)
//
//  WHY NOT JUST CALL getMedia() MANUALLY?
//    You could — but you would have to write a loop yourself. pollResult()
//    is that loop, with timeout protection built in.

async function demonstratePollResult(mid: string): Promise<MediaRecord> {
  console.log('\n━━ pollResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const finishedRecord = await client.pollResult(mid, {
    interval: 4_000,    // check every 4 seconds
    timeout:  120_000,  // give up after 2 minutes
  });

  console.log('mid:           ', finishedRecord.mid);
  console.log('status:        ', finishedRecord.status);
  console.log('resultURL:     ', finishedRecord.resultURL?.substring(0, 60) + '…');

  return finishedRecord;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  (nothing printed for a few seconds while it waits…)
  //
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  status:         "PROCESSED"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/64a3f1c2…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  • status "PROCESSED" → the AI finished. The answer is ready.
  //  • resultURL → a link where the actual detection answer (JSON) is stored.
  //    We use this URL in the next step.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 5 — getResult()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Downloads the AI's answer from the resultURL.
//    Returns a plain JavaScript object with the detection fields.
//
//    For liveness check, the key field is:
//      isLiveness → true  = real live person
//                   false = spoof (printed photo, screen, mask, etc.)
//
//  REQUIREMENT
//    The media record must have status = "PROCESSED" before calling this.
//    If you call it too early (status still "PENDING"), it will throw an error.

async function demonstrateGetResult(finishedRecord: MediaRecord): Promise<DetectionResult> {
  console.log('\n━━ getResult() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const detectionResult = await client.getResult(finishedRecord);

  console.log('isLiveness:    ', detectionResult.isLiveness);
  console.log('resultType:    ', detectionResult.resultType);
  console.log('full result:   ', JSON.stringify(detectionResult, null, 2));

  return detectionResult;

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  isLiveness:     true
  //  resultType:     "liveness"
  //  full result:    {
  //                    "isLiveness": true,
  //                    "resultType": "liveness",
  //                    "isDeepFake": null,
  //                    "isSimilar":  null,
  //                    "similarityScore": null
  //                  }
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  isLiveness: true  → the photo passed. This is a real live person.
  //  isLiveness: false → spoof detected. Deny access.
  //
  //  The other fields (isDeepFake, isSimilar) are null because we only
  //  asked for liveness. Each field is null unless you enable its check.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 6 — uploadAndPoll()   ← the one function most apps use           │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Combines upload() + pollResult() + getResult() into a single call.
//    You give it a file path and your options. It returns the final answer.
//
//    Internally it runs:
//      Step 1 → upload()      (send file to cloud)
//      Step 2 → pollResult()  (wait for AI to finish)
//      Step 3 → getResult()   (download the answer)
//
//  WHEN TO USE THIS vs THE STEP-BY-STEP APPROACH
//    Use uploadAndPoll() for 99% of cases — it is simpler.
//    Use the individual functions only when you need custom retry logic,
//    progress bars, or want to save the mid to a database mid-way.

async function demonstrateUploadAndPoll(): Promise<void> {
  console.log('\n━━ uploadAndPoll() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const processedMedia = await client.uploadAndPoll(
    'file:///path/to/selfie.jpg',
    'FI-1',
    {
      livenessCheck: true,     // ← only flag needed for this check
    },
  );

  console.log('mid:           ', processedMedia.mid);
  console.log('status:        ', processedMedia.status);
  console.log('isLiveness:    ', processedMedia.result?.isLiveness);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  status:         "PROCESSED"
  //  isLiveness:     true
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  This is the same final answer as the step-by-step approach in cells 2–5,
  //  but done in one line. Use this in production code.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 7 — getMedia()                                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Fetches the current state of ONE media record by its ID (mid).
//    Gives you the status, timestamps, URLs, and file details.
//
//  WHEN TO USE IT
//    • To check if a job finished without waiting (polling manually)
//    • To re-read a past result without re-uploading
//    • To audit what files were submitted

async function demonstrateGetMedia(mid: string): Promise<void> {
  console.log('\n━━ getMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const record = await client.getMedia(mid);

  console.log('mid:           ', record.mid);
  console.log('status:        ', record.status);
  console.log('modelType:     ', record.modelType);
  console.log('contentType:   ', record.contentType);
  console.log('size (bytes):  ', record.size);
  console.log('createdAt:     ', record.createdAt);
  console.log('srcURL:        ', record.srcURL  ?? 'not available');
  console.log('resultURL:     ', record.resultURL ?? 'not ready yet');

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  status:         "PROCESSED"
  //  modelType:      "FI-1"
  //  contentType:    "image/jpeg"
  //  size (bytes):   245890
  //  createdAt:      "2025-05-05T09:15:32.000Z"
  //  srcURL:         "https://s3.amazonaws.com/authenta-uploads/64a3f1c2…"
  //  resultURL:      "https://s3.amazonaws.com/authenta-results/64a3f1c2…"
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  srcURL    → where the original photo is stored (for audit / replay)
  //  resultURL → where the AI's answer JSON is stored
  //  Both URLs are signed — they expire after a short time.
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 8 — listMedia()                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Returns a paginated list of ALL media records belonging to your account.
//    Useful for building a history view, auditing submissions, or finding
//    a mid you forgot to save.
//
//  PARAMETERS  (all optional)
//    page      → which page (starts at 1)
//    pageSize  → how many records per page

async function demonstrateListMedia(): Promise<void> {
  console.log('\n━━ listMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const response = await client.listMedia({ page: 1, pageSize: 5 });

  console.log('total records: ', response.total);
  console.log('on this page:  ', response.items.length);
  console.log('');

  response.items.forEach((item, index) => {
    console.log(`  [${index + 1}]  ${item.mid}  |  ${item.status}  |  ${item.modelType}  |  ${item.createdAt}`);
  });

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  total records:  47
  //  on this page:   5
  //
  //  [1]  64a3f1c2b8e9d07f3c1a5e22  |  PROCESSED  |  FI-1  |  2025-05-05T09:15:32Z
  //  [2]  63b2e0c1a7d8c06e2b0a4d11  |  PROCESSED  |  FI-1  |  2025-05-04T14:22:10Z
  //  [3]  62a1d9b0f6c7b05d1a9c3c00  |  FAILED     |  FI-1  |  2025-05-04T11:08:44Z
  //  [4]  61f0c8a9e5b6a04c0b8b2b99  |  PROCESSING |  FI-1  |  2025-05-05T09:18:01Z
  //  [5]  60e9b7a8d4a5903b9a7a1a88  |  PENDING    |  FI-1  |  2025-05-05T09:19:55Z
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  • PROCESSED  → done, result is available
  //  • PROCESSING → AI is still working on it
  //  • PENDING    → uploaded, waiting to be picked up by the AI
  //  • FAILED     → the model ran but could not produce a result (bad photo, etc.)
}


// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CELL 9 — deleteMedia()                                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
//  WHAT IT DOES
//    Permanently deletes a media record and its associated files from the
//    Authenta servers. After deletion the mid is gone — you cannot undo this.
//
//  WHEN TO USE IT
//    • After you have stored the result in your own database
//    • To comply with data-retention or privacy policies (GDPR, etc.)
//    • To clean up test records during development

async function demonstrateDeleteMedia(mid: string): Promise<void> {
  console.log('\n━━ deleteMedia() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.deleteMedia(mid);
  console.log(`Deleted: ${mid}`);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  Deleted: 64a3f1c2b8e9d07f3c1a5e22
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  No return value — if the call did not throw an error, deletion succeeded.
  //  Calling getMedia(mid) after this will throw a 404 Not Found error.
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RUN ALL CELLS IN ORDER
//  Each cell's output feeds the next one — this mirrors the real workflow.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  // ── Path to a real photo on your machine ─────────────────────────────────
  const photoUri = 'file:///path/to/selfie.jpg';

  // Cell 2 — register the file (manual approach, step 1)
  const created  = await demonstrateCreateMedia();

  // Cell 3 — upload a fresh record the easy way
  const uploaded = await demonstrateUpload();

  // Cell 4 — wait for the AI to finish
  const finished = await demonstratePollResult(uploaded.mid);

  // Cell 5 — download the answer
  await demonstrateGetResult(finished);

  // Cell 6 — the all-in-one shortcut (does cells 3+4+5 in one line)
  await demonstrateUploadAndPoll();

  // Cell 7 — inspect a single record by id
  await demonstrateGetMedia(uploaded.mid);

  // Cell 8 — list all records on your account
  await demonstrateListMedia();

  // Cell 9 — clean up (delete the record we created in cell 3)
  await demonstrateDeleteMedia(uploaded.mid);
}

main().catch(err => { console.error(err); process.exit(1); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTA CORE SDK  ·  FE-1 Model  ·  FACEEMBEDDINGS
//  Every function in the SDK demonstrated one by one.
//
//  HOW TO RUN THIS FILE
//    npx ts-node examples/core/04-face-embeddings.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━══

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
    'FE-1',
  );

  console.log('mid:           ', processedMedia.mid);
  console.log('status:        ', processedMedia.status);
  console.log('faceVector:    ', processedMedia.result?.faceVector);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  mid:            "64a3f1c2b8e9d07f3c1a5e22"
  //  status:         "PROCESSED"
  //  faceVector:     [0.1, 0.2, 0.3, ...]
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  This is the same final answer as the step-by-step approach in cells 2–5,
  //  but done in one line. Use this in production code.
}


// Alternative approach: use the function verify_face_embeddings() which is a shortcut for uploadAndPoll() with FE-1 modeltype.

async function demonstrate_verify_face_embeddings(): Promise<void> {
  console.log('\n━━ verifyFaceEmbeddings() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const face_embeddings = await client.verify_face_embeddings('file:///path/to/selfie.jpg');

  console.log('Result:    ', face_embeddings);

  //  ─── OUTPUT ───────────────────────────────────────────────────────────────
  //
  //  faceVector:     [0.1, 0.2, 0.3, ...]
  //
  //  ─── WHAT THIS MEANS ──────────────────────────────────────────────────────
  //
  //  This is a simpler alternative to uploadAndPoll() if you only care about face embeddings. It returns the face vector directly.
}





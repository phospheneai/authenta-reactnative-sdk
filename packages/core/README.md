# @authenta/core

Pure TypeScript API client for the [Authenta](https://authenta.ai) eKYC platform. Works in **Node.js** and **React Native** — no native modules or UI dependencies.

Use this package directly when you want headless control over uploads, polling, and results. For a ready-made camera capture UI, use [`@authenta/react-native`](https://www.npmjs.com/package/@authenta/react-native).

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Client Setup](#client-setup)
- [High-level API](#high-level-api)
  - [uploadAndPoll()](#uploadandpoll)
  - [RunOptions](#runoptions)
  - [Convenience wrappers](#convenience-wrappers)
- [Low-level API](#low-level-api)
- [Models](#models)
- [Result fields](#result-fields)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)

---

## Installation

```bash
npm install @authenta/core
```

No peer dependencies. Works in Node.js ≥ 16 and React Native ≥ 0.72.

---

## Quick Start

```ts
import { AuthentaClient } from '@authenta/core';

const client = new AuthentaClient({
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

// FI-1 liveness check
const media = await client.uploadAndPoll('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});

console.log(media.status);          // "completed"
console.log(media.result?.isSpoof); // false = live person
```

---

## Client Setup

```ts
const client = new AuthentaClient({
  api_key:      'YOUR_API_KEY',       // required
  auth_enabled: true,                  // set true when api_key is provided
  baseUrl:      'https://platform.authenta.ai', // optional — default shown
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `api_key` | `string` | Yes | Your Authenta API key |
| `auth_enabled` | `boolean` | Yes | Pass `true` to include the Bearer token on every request |
| `baseUrl` | `string` | No | API base URL (default: `https://platform.authenta.ai`) |

---

## High-level API

### uploadAndPoll()

The primary method. Runs the full pipeline — upload → finalize → poll → fetch result — and returns a `ProcessedMedia` object.

```ts
const media = await client.uploadAndPoll(uri, modelType, options);
```

| Parameter | Type | Description |
|---|---|---|
| `uri` | `string` | `file://` URI of the photo or video to analyse |
| `modelType` | `ModelType` | Model to run — e.g. `'FI-1'`, `'DF-1'`, `'AC-1'`, `'FE-1'` |
| `options` | `RunOptions` | Detection flags and polling config |

**Returns** `Promise<ProcessedMedia>` when `autoPolling: true` (default), or `Promise<CreateMediaResponse>` when `autoPolling: false`.

**Examples**

```ts
// Liveness check — photo
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
});
console.log(media.result?.isSpoof); // false = live person

// Faceswap / deepfake check — video only
const media = await client.uploadAndPoll('file:///clip.mp4', 'FI-1', {
  faceswapCheck: true,
});
console.log(media.result?.isDeepFake);

// Face similarity — photo + reference image
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  faceSimilarityCheck: true,
  referenceImage:      'file:///id-photo.jpg',
});
console.log(media.result?.isSimilar, media.result?.similarityScore);

// Liveness + similarity combined — photo
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck:       true,
  faceSimilarityCheck: true,
  referenceImage:      'file:///id-photo.jpg',
});

// DF-1 deepfake detection — video
const media = await client.uploadAndPoll('file:///clip.mp4', 'DF-1');
console.log(media.result?.isDeepFake);

// FE-1 face embeddings — photo
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FE-1');
console.log(media.result?.faceVector);

// Return immediately after upload (no polling)
const meta = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
  autoPolling:   false,
});
console.log(meta.job.id); // use this id to poll later
```

---

### RunOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `livenessCheck` | `boolean` | `false` | Run liveness check — FI-1 only |
| `faceswapCheck` | `boolean` | `false` | Run faceswap/deepfake check — FI-1, video required |
| `faceSimilarityCheck` | `boolean` | `false` | Run face similarity — FI-1, photo + `referenceImage` required |
| `referenceImage` | `string` | — | `file://` URI of the reference face image |
| `isSingleFace` | `boolean` | `true` | Hint that only one face is present in the frame |
| `autoPolling` | `boolean` | `true` | Set `false` to return after upload without waiting for the result |
| `interval` | `number` | `5000` | Polling interval in ms |
| `timeout` | `number` | `600000` | Max total polling time in ms (10 min) |

**Check compatibility — FI-1**

| Checks | Input | Can combine with |
|---|---|---|
| `livenessCheck` | Photo or video | `faceSimilarityCheck` |
| `faceswapCheck` | Video (max 10 s) | `livenessCheck` |
| `faceSimilarityCheck` | Photo + `referenceImage` | `livenessCheck` |
| `faceswapCheck` + `faceSimilarityCheck` | — | Not allowed — SDK throws `ValidationError` |

---

### Convenience wrappers

Shorthand methods that return only the `DetectionResult` (no job wrapper):

```ts
// FI-1 — liveness
const result = await client.verify_liveness('file:///selfie.jpg');
console.log(result.isSpoof); // false = live

// FI-1 — faceswap (video only)
const result = await client.verify_deepfake('file:///clip.mp4');
console.log(result.isDeepFake);

// FI-1 — face similarity (photo + reference)
const result = await client.verify_similarity('file:///selfie.jpg', 'file:///id-photo.jpg');
console.log(result.isSimilar, result.similarityScore);

// FE-1 — face embeddings
const result = await client.verify_face_embeddings('file:///selfie.jpg');
console.log(result.faceVector);
```

---

## Low-level API

Call each step individually for custom progress tracking, retry logic, or saving the job ID mid-flow.

```ts
// 1. Create a job record + get S3 upload URLs
const meta = await client.upload('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
});
console.log(meta.job.id);     // e.g. "2710"
console.log(meta.job.status); // "initiated"
// meta.inputs[0].uploadUrl  — signed PUT URL for the original file
// meta.inputs[1].uploadUrl  — signed PUT URL for the reference (similarity only)

// 2. Tell the server all files are uploaded — job moves to "queued"
await client.finalizeMedia(meta.job.id);

// 3. Poll until the AI finishes
const media = await client.pollResult(meta.job.id, {
  interval: 3_000,    // check every 3 s
  timeout:  120_000,  // give up after 2 min
});
console.log(media.status); // "completed"

// 4. Download the full result JSON from the S3 artifact
const result = await client.getResult(media);
console.log(result.isSpoof, result.isDeepFake, result.isSimilar);

// ── CRUD helpers ──────────────────────────────────────────────────────────

const job  = await client.getMedia('2710');
const list = await client.listMedia({ page: 1, pageSize: 20 });
await client.deleteMedia('2710');

// Task-type ID lookup
const taskId = await client.get_task_id('FI-1'); // "8"
```

---

## Models

| Model ID | Task | Input |
|---|---|---|
| `FI-1` | Face Intelligence — liveness, faceswap, similarity | Photo or video |
| `FE-1` | Face Embeddings — numeric face vector | Photo |
| `DF-1` | Deepfake detection | Video |
| `AC-1` | AI-generated image detection | Photo |

---

## Result fields

`DetectionResult` fields populated per model and check:

| Field | Type | Populated by |
|---|---|---|
| `isSpoof` | `boolean \| string` | FI-1 liveness check |
| `isDeepFake` | `boolean \| string` | FI-1 faceswap, DF-1 |
| `isSimilar` | `boolean \| string` | FI-1 similarity check |
| `similarityScore` | `number \| string` | FI-1 similarity check |
| `faceVector` | `number[]` | FE-1 |
| `RealConfidencePercent` | `number \| string` | DF-1, AC-1 |

---

## Error Handling

All errors extend `AuthentaError`. Import and catch specifically:

```ts
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  QuotaExceededError,
  InsufficientCreditsError,
  ValidationError,
  ServerError,
} from '@authenta/core';

try {
  const media = await client.uploadAndPoll(uri, 'FI-1', { livenessCheck: true });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid api_key — code: "IAM001"
  } else if (err instanceof AuthorizationError) {
    // Account lacks permission — code: "IAM002"
  } else if (err instanceof QuotaExceededError) {
    // Monthly quota exceeded — code: "AA001"
  } else if (err instanceof InsufficientCreditsError) {
    // No remaining credits — code: "U007"
  } else if (err instanceof ValidationError) {
    // Bad input — see err.message
    console.error(err.message, err.code, err.statusCode);
  } else if (err instanceof ServerError) {
    // Platform error — safe to retry
  } else if (err instanceof AuthentaError) {
    // Base class catch-all
    console.error(err.message, err.code, err.statusCode, err.details);
  }
}
```

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `code` | `string?` | API error code (e.g. `IAM001`) |
| `statusCode` | `number?` | HTTP status code |
| `details` | `object?` | Raw API response body |

---

## TypeScript Types

```ts
import type {
  AuthentaClientConfig,
  ModelType,
  MediaStatus,
  FIOptions,
  RunOptions,
  PollingOptions,
  CreateMediaResponse,
  UploadInput,
  ListMediaParams,
  ListMediaResponse,
  DetectionResult,
  ProcessedMedia,
  Artifact,
  TaskType,
} from '@authenta/core';
```

**Key shapes**

```ts
// Returned by upload() / uploadAndPoll({ autoPolling: false })
interface CreateMediaResponse {
  job: {
    id:         string;
    tenantId:   string;
    taskTypeId: string;
    status:     string;   // "initiated"
    cost:       number;
    createdAt:  string;
    updatedAt:  string;
    result:     null;
  };
  inputs: Array<{
    slotName:           'original' | 'reference';
    uploadUrl:          string;
    uploadUrlExpiresAt: string;
  }>;
}

// Returned by pollResult() / uploadAndPoll() after processing
interface ProcessedMedia {
  id:         string;
  tenantId:   string;
  taskTypeId: string;
  status:     MediaStatus;  // "completed" | "queued" | "processing" | ...
  cost:       number;
  createdAt:  string;
  updatedAt:  string;
  result:     DetectionResult | null;
  artifacts:  Artifact[];
  taskType:   TaskType;
}

// Detection result — fields depend on which checks were run
interface DetectionResult {
  isSpoof?:              boolean | string;
  isDeepFake?:           boolean | string;
  isSimilar?:            boolean | string;
  similarityScore?:      number  | string;
  faceVector?:           number[];
  RealConfidencePercent?: number | string;
  [key: string]: any;
}
```

---

## License

MIT © Authenta

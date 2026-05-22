# @authenta/core

Pure TypeScript API client for the [Authenta](https://authenta.ai) eKYC platform. Works in **Node.js** and **React Native** — no native modules or UI dependencies.

Use this package directly if you want headless control over uploads, polling, and result retrieval. For a ready-made camera capture UI, use [`@authenta/react-native`](https://www.npmjs.com/package/@authenta/react-native).

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [AuthentaClient](#authentaclient)
  - [Configuration](#configuration)
  - [uploadAndPoll()](#uploadandpoll)
  - [RunOptions](#runoptions)
  - [Low-level API](#low-level-api)
  - [Convenience Methods](#convenience-methods)
- [Task Types](#task-types)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)

---

## Installation

```bash
npm install @authenta/core
```

No peer dependencies. Works out of the box in Node.js >= 16 and React Native >= 0.72.

---

## Quick Start

```ts
import { AuthentaClient } from '@authenta/core';

const client = new AuthentaClient({
  apiKey: 'api_xxxxxxxx',
});

const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', '8', {
  isLivenessCheck: true,
});

console.log(result.result?.isLiveness);   // true | false
console.log(result.status);               // "PROCESSED"
```

---

## AuthentaClient

### Configuration

```ts
const client = new AuthentaClient({
  apiKey:   'api_xxxxxxxx',                       // required
  baseUrl:  'https://platform.authenta.ai',       // optional — default shown
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Your Authenta API key (`api_...`) |
| `baseUrl` | `string` | No | API base URL (default: `https://platform.authenta.ai`) |

All requests are authenticated with:
```http
Authorization: Bearer api_xxxxxxxx
```

---

### uploadAndPoll()

The primary high-level method. Uploads the file, finalizes the job, polls until processing is complete, fetches the detection result, and returns a `ProcessedJob` object.

```ts
const result = await client.uploadAndPoll(uri, taskTypeId, options);
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `uri` | `string` | `file://` URI of the photo or video to analyse |
| `taskTypeId` | `TaskTypeId` | Task to run — see [Task Types](#task-types) |
| `options` | `RunOptions` | Detection options — see [RunOptions](#runoptions) |

**Examples**

```ts
// Liveness check — photo (taskTypeId 8, face-intelligence)
const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', '8', {
  isLivenessCheck: true,
});

// Faceswap check — video (taskTypeId 8)
const result = await client.uploadAndPoll('file:///path/to/clip.mp4', '8', {
  isFaceswapCheck: true,
});

// Liveness + faceswap — video
const result = await client.uploadAndPoll('file:///path/to/clip.mp4', '8', {
  isLivenessCheck: true,
  isFaceswapCheck: true,
});

// Face similarity — photo + reference
const result = await client.uploadAndPoll('file:///path/to/selfie.jpg', '8', {
  isSimilarityCheck: true,
  referenceImage: 'file:///path/to/id-photo.jpg',
});

// AI image detection (taskTypeId 1)
const result = await client.uploadAndPoll('file:///path/to/image.jpg', '1');

// Faceswap video detection (taskTypeId 4)
const result = await client.uploadAndPoll('file:///path/to/video.mp4', '4');

// Face embeddings (taskTypeId 9)
const result = await client.uploadAndPoll('file:///path/to/face.jpg', '9');
```

**Returns** `Promise<ProcessedJob>`

```ts
{
  id:          string;       // unique job ID
  status:      'PROCESSED';  // always PROCESSED on success
  taskTypeId:  string;       // e.g. "8"
  contentType: string;       // MIME type of the uploaded file
  sizeBytes:   number;       // file size in bytes
  createdAt:   string;       // ISO 8601
  srcURL?:     string;
  resultURL?:  string;
  result?: {
    resultType:       string;
    isLiveness?:      boolean | string;   // liveness check result
    isDeepFake?:      boolean | string;   // faceswap / deepfake result
    isSimilar?:       boolean | string;   // face similarity result
    similarityScore?: number  | string;   // 0–100
    [key: string]:    any;
  };
}
```

---

### RunOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `isLivenessCheck` | `boolean` | `false` | Run liveness check (taskTypeId `'8'`) |
| `isFaceswapCheck` | `boolean` | `false` | Run faceswap check (taskTypeId `'8'`, video required) |
| `isSimilarityCheck` | `boolean` | `false` | Run face similarity check (taskTypeId `'8'`, photo + reference required) |
| `referenceImage` | `string` | — | `file://` URI of reference face image (required when `isSimilarityCheck: true`) |
| `autoPolling` | `boolean` | `true` | Wait for result before returning. Set `false` to return immediately after upload |
| `interval` | `number` | `5000` | Polling interval in milliseconds |
| `timeout` | `number` | `600000` | Max polling duration in milliseconds (10 min) |

**Check compatibility (taskTypeId `'8'` only)**

| Check | Input required | Can combine with |
|---|---|---|
| `isLivenessCheck` | Photo **or** video | `isSimilarityCheck` |
| `isFaceswapCheck` | Video (max 10 s) | `isLivenessCheck` |
| `isSimilarityCheck` | Photo + `referenceImage` | `isLivenessCheck` |
| `isFaceswapCheck` + `isSimilarityCheck` | — | **Not allowed** |

---

### Low-level API

Call each step individually for full control:

```ts
// 1. Create job + upload file(s) to S3 + finalize (sends to queue)
const job = await client.upload('file:///path/to/selfie.jpg', '8', {
  isLivenessCheck: true,
});
console.log(job.id); // "469"

// 2. Poll until processing completes
const processed = await client.pollResult(job.id, {
  interval: 3000,    // poll every 3 s
  timeout:  120000,  // give up after 2 min
});

// 3. Fetch the detection result from resultURL
const result = await client.getResult(processed);
console.log(result.isLiveness, result.isDeepFake);

// CRUD helpers
const record = await client.getJob(id);
const list   = await client.listJobs({ page: 1, pageSize: 20 });
await client.deleteJob(id);
await client.finalizeJob(id);  // manually finalize if autoPolling is false
```

---

### Convenience Methods

Pre-wired shortcuts that pick the correct task type automatically:

```ts
// Faceswap detection — taskTypeId 4, video only
const result = await client.verify_deepfake('file:///path/to/video.mp4');

// Liveness check — taskTypeId 8, image or video
const result = await client.verify_liveness('file:///path/to/selfie.jpg');

// Face similarity — taskTypeId 8, image + reference
const result = await client.verify_similarity(
  'file:///path/to/selfie.jpg',
  'file:///path/to/id-photo.jpg',
);

// Face embeddings — taskTypeId 9, image
const result = await client.verify_face_embeddings('file:///path/to/face.jpg');
```

---

## Task Types

| TaskTypeId | Slug | Description | Accepted input |
|---|---|---|---|
| `'1'` | ai-image-detection | Detects if an image is AI-generated | `image/jpeg`, `image/png` |
| `'4'` | faceswap-detection | Detects AI face-swap in video | `video/mp4`, `video/mov`, `video/webm` |
| `'8'` | face-intelligence | Liveness, faceswap, and similarity checks | `image/jpeg`, `image/png`, `video/mp4`, `video/mov` |
| `'9'` | face-embeddings | Extracts face embedding vector | `image/jpeg`, `image/png` |

Named constants are also exported:

```ts
import { TASK_TYPE } from '@authenta/core';

TASK_TYPE.AI_IMAGE_DETECTION   // '1'
TASK_TYPE.FACESWAP_DETECTION   // '4'
TASK_TYPE.FACE_INTELLIGENCE    // '8'
TASK_TYPE.FACE_EMBEDDINGS      // '9'
```

---

## Error Handling

All errors extend `AuthentaError`. Import and catch specifically:

```ts
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  InsufficientBalanceError,
  ValidationError,
  ServerError,
} from '@authenta/core';

try {
  const result = await client.uploadAndPoll(uri, '8', { isLivenessCheck: true });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid or missing API key — code: INVALID_API_KEY
  } else if (err instanceof AuthorizationError) {
    // Key lacks permission for this operation — code: FORBIDDEN
  } else if (err instanceof InsufficientBalanceError) {
    // Account has no credits — code: INSUFFICIENT_BALANCE
  } else if (err instanceof ValidationError) {
    // Bad input — see err.message for details
    console.error(err.message, err.code, err.statusCode);
  } else if (err instanceof ServerError) {
    // Platform error — safe to retry
  } else if (err instanceof AuthentaError) {
    // Base class catch-all
    console.error(err.message, err.code, err.statusCode, err.details);
  }
}
```

**Error properties**

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `code` | `string?` | API error code (`INVALID_API_KEY`, `FORBIDDEN`, `INSUFFICIENT_BALANCE`) |
| `statusCode` | `number?` | HTTP status code |
| `details` | `object?` | Raw API response body |

---

## TypeScript Types

All public types are exported from the package entry point:

```ts
import type {
  AuthentaClientConfig,
  TaskTypeId,
  JobStatus,
  FileInfo,
  JobInput,
  JobParameters,
  FIOptions,
  RunOptions,
  PollingOptions,
  CreateJobResponse,
  JobRecord,
  ListJobsResponse,
  DetectionResult,
  ProcessedJob,
} from '@authenta/core';
```

---

## License

MIT © Authenta

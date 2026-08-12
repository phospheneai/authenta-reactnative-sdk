# @authenta/core

Pure TypeScript API clients for the [Authenta](https://authenta.ai) platform. Works in **Node.js** and **React Native** — no native modules or UI dependencies.

The package ships two independent clients:

| Client | Service | Auth | Purpose |
|---|---|---|---|
| `AuthentaClient` | Authenta platform | API key | Liveness, faceswap, similarity, deepfake, and embedding detection |
| `FaceIndexClient` | Your FaceSim host | Tenant UUID only | Enrol faces, then search a photo against them |

They share no state or configuration — use either, or both. Use this package
directly when you want headless control over uploads, polling, and results. For
ready-made UI, use [`@authenta/react-native`](https://www.npmjs.com/package/@authenta/react-native).

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
- [Face Indexing](#face-indexing)
  - [Client setup](#client-setup-1)
  - [Enrolling faces](#enrolling-faces)
  - [Searching](#searching)
  - [Face indexing errors](#face-indexing-errors)
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
  api_key:      'YOUR_API_KEY',              // required
  auth_enabled: true,                         // set true when api_key is provided
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
| `contentType` | `string` | — | Override MIME type sent with the upload (e.g. `'image/jpeg'`, `'video/mp4'`) |

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

## Face Indexing

`FaceIndexClient` talks to the **FaceSim** server, which is a different service
from the Authenta platform: its own host, no API key, and every call scoped to a
tenant UUID. Nothing is shared with `AuthentaClient` — use both side by side.

### Client setup

```ts
import { FaceIndexClient } from '@authenta/core';

const faces = new FaceIndexClient({
  baseUrl: 'http://192.168.1.10:8000',            // your FaceSim host
  tenantId: '6c60ef62-c848-40e3-9cb4-9472ff7b8b58', // must be a UUID
});
```

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | Yes | — | FaceSim host. A trailing slash is stripped |
| `tenantId` | `string` | Yes | — | Tenant UUID. A non-UUID throws `ValidationError` from the constructor |
| `timeoutMs` | `number` | No | `30000` | Timeout for non-search requests; when explicitly set it also applies to search |
| `searchTimeoutMs` | `number` | No | `120000` | Search timeout; large images take longer to transfer and embed |

### Enrolling faces

Enrollment is a three-party flow: the API returns presigned S3 URLs, the client
PUTs the bytes to S3, and a Lambda tells the API each object landed. A face is
only searchable once its embedding is stored, so wait for it:

```ts
// Upload, then poll until every face is `processed` or `failed`.
const result = await faces.enrollAndWait([
  { uri: 'file:///path/front.jpg' },
  { uri: 'file:///path/left.png' },
]);

console.log(result.subject_id, result.processedCount, result.failedCount);
for (const face of result.faces) {
  if (face.status === 'failed') console.warn(face.name, face.error);
}
```

`name` and `contentType` are derived from the URI when omitted. Only
`image/jpeg`, `image/png`, and `image/webp` are accepted — anything else is
rejected before a subject is created, so no half-built record is left behind.
Between 1 and 10 images may be enrolled at a time.

Split the steps when you want progress feedback:

```ts
const created = await faces.enrollImages(images);      // uploaded to S3
const result  = await faces.waitForEnrollment(created.subject_id);
```

### Searching

Search is independent of enrollment — it matches against every processed face
for the tenant, including ones enrolled in an earlier session.

```ts
const response = await faces.searchByUri('file:///path/query.jpg', { limit: 10 });

for (const match of response.results) {
  console.log(match.rank, match.subject_id, match.similarity_score);
}
```

`search()` accepts standard Base64, URL-safe Base64, or a
`data:image/…;base64,…` value, and normalizes it. `limit` defaults to 50 and is
clamped to 1–50. The same subject can appear more than once because every
enrolled face has its own embedding. Only faces with `status: "processed"` are
searched; a tenant with none returns `count: 0`.

Search uses `POST /v1/search?limit=…`. The JSON body contains `tenant_id` and
`image_bytes`, keeping large images out of the URL. The SDK sends the original
file bytes as padded URL-safe Base64 and does not resize or re-encode them.

### Other methods

| Method | Purpose |
|---|---|
| `isReady()` | `true` when the server and its database respond |
| `enroll(images)` | Create the subject and get presigned URLs (no upload) |
| `getTenant()` | Every subject and face for the tenant |
| `getSubjectFaces(id)` | Faces for one subject, merged across duplicate rows |

### Face statuses

| Status | Meaning |
|---|---|
| `pending` | Upload URL created; S3 acknowledgement not received yet |
| `uploaded` | S3 object acknowledged; waiting for a worker |
| `processing` | A worker is generating the embedding |
| `processed` | Embedding stored; the face is searchable |
| `failed` | Upload validation or embedding failed — inspect `face.error` |

`waitForEnrollment()` returns once every face reaches `processed` or `failed`.
A face that fails does not fail the whole enrollment: check `processedCount`
and `failedCount` on the result.

### Face indexing errors

Failures throw `FaceIndexError` (a subclass of `AuthentaError`) carrying the
server's `code` and a message safe to show a user. The original server text is
kept at `error.details.apiMessage`.

```ts
import { FaceIndexError } from '@authenta/core';

try {
  await faces.searchByUri('file:///query.jpg');
} catch (err) {
  if (err instanceof FaceIndexError) {
    console.log(err.message);                 // safe to show the user
    console.log(err.code);                    // e.g. "no_face_detected"
    console.log(err.details?.apiMessage);     // raw server text
  }
}
```

| HTTP | Code | Message shown |
|---:|---|---|
| `403` | `forbidden` | This tenant is not allowed to use face indexing. |
| `404` | `not_found` | The tenant or record was not found… |
| `409` | `conflict` / `upload_missing` | …Start a new enrollment. |
| `413` | `image_too_large` | The image is larger than the server accepts. |
| `422` | `invalid_image` | That image could not be read. Choose a JPEG, PNG, or WebP photo. |
| `422` | `no_face_detected` | No face was found in that photo… |
| `502` | `storage_error` | …temporarily unavailable. Please try again. |
| `500` | `configuration_error` | The face indexing server is misconfigured… |

FastAPI request-validation failures (`{ detail: [...] }`) surface as code
`validation_error` with the offending fields in the message.

Client-side mistakes — a non-UUID tenant, an unsupported image type, more than
10 images, or an enrollment that times out — throw `ValidationError` before or
instead of a request, so no half-built subject is left on the server.

`429`/`500`/`502`/`503`/`504` are retried twice with bounded backoff before
throwing. Search requests time out after `searchTimeoutMs` (default 120 s);
other requests use `timeoutMs` (default 30 s).

---

## TypeScript Types

```ts
// Detection
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

// Face indexing
import type {
  FaceIndexClientConfig,
  LocalFaceImage,
  EnrollImageDescriptor,
  EnrollResponse,
  EnrollFaceUpload,
  EnrollmentResult,
  EnrollmentPollingOptions,
  TenantResponse,
  TenantSubject,
  TenantFace,
  SearchResponse,
  SearchMatch,
  FaceStatus,
  FaceImageContentType,
} from '@authenta/core';
```

Runtime constants are exported too:

```ts
import {
  SUPPORTED_FACE_IMAGE_TYPES, // ['image/jpeg', 'image/png', 'image/webp']
  MIN_ENROLL_IMAGES,          // 1
  MAX_ENROLL_IMAGES,          // 10
  MAX_SEARCH_LIMIT,           // 50
  TERMINAL_FACE_STATUSES,     // ['processed', 'failed']
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
  isSpoof?:               boolean | string;
  isDeepFake?:            boolean | string;
  isSimilar?:             boolean | string;
  similarityScore?:       number  | string;
  faceVector?:            number[];
  RealConfidencePercent?: number  | string;
  [key: string]: any;
}

// Returned by enrollAndWait() / waitForEnrollment()
interface EnrollmentResult {
  subject_id:     string;
  faces:          TenantFace[];
  processedCount: number;   // searchable
  failedCount:    number;   // inspect each face's `error`
}

interface TenantFace {
  face_id:   string;
  name:      string;
  status:    FaceStatus;    // 'pending' | 'uploaded' | 'processing' | 'processed' | 'failed'
  embedding: number[] | null;
  image_url: string;        // presigned, expires in ~5 min
  error:     string | null;
}

// Returned by search() / searchByUri()
interface SearchResponse {
  tenant_id: string;
  count:     number;
  results:   SearchMatch[];  // highest similarity first
}

interface SearchMatch {
  rank:             number;
  subject_id:       string;
  face_id:          string;
  name:             string;
  image_url:        string;
  similarity_score: number;
}
```

---

## License

MIT © Authenta

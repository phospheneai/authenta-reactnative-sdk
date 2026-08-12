# @authenta/core

Pure TypeScript API client for the [Authenta](https://authenta.ai) platform. Works in **Node.js** and **React Native** — no native modules or UI dependencies.

One client, two features:

| Feature | Method | What it does |
|---|---|---|
| **Detection** | `uploadAndPoll()` | Liveness, faceswap, similarity, deepfake, and embedding checks |
| **Face indexing** | `faceEnrol()` · `faceSearch()` · `tenants()` | Index a person's photos, then match a face against them |

Both run on the same host and API key. Use this package directly for headless
control; for ready-made UI use [`@authenta/react-native`](https://www.npmjs.com/package/@authenta/react-native).

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Client Setup](#client-setup)
- [Detection](#detection)
  - [uploadAndPoll()](#uploadandpoll)
  - [RunOptions](#runoptions)
  - [Models](#models)
  - [Result fields](#result-fields)
- [Face Indexing](#face-indexing)
  - [faceEnrol()](#faceenrol)
  - [faceSearch()](#facesearch)
  - [tenants()](#tenants)
  - [Face statuses](#face-statuses)
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
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

// Detection — is this a live person?
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
});
console.log(media.result?.isSpoof);   // false = live person

// Face indexing — index a person, then find them
const subject = await client.faceEnrol([{ uri: 'file:///front.jpg' }]);
const matches = await client.faceSearch('file:///query.jpg');
console.log(matches.results[0]?.similarity_score);
```

---

## Client Setup

```ts
const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | `string` | Yes | API base URL. A trailing slash is stripped |
| `api_key` | `string` | Yes | Your Authenta API key |
| `auth_enabled` | `boolean` | Yes | Pass `true` to send the Bearer token on every request |

---

## Detection

### uploadAndPoll()

Runs the whole pipeline — upload → finalize → poll → fetch result — and returns
a `ProcessedMedia`.

```ts
const media = await client.uploadAndPoll(uri, modelType, options);
```

| Parameter | Type | Description |
|---|---|---|
| `uri` | `string` | `file://` URI of the photo or video to analyse |
| `modelType` | `ModelType` | Model to run — `'FI-1'`, `'DF-1'`, `'AC-1'`, `'FE-1'`, … |
| `options` | `RunOptions` | Detection flags and polling config |

Name, type, and size are derived from the URI. Returns `ProcessedMedia`, or
`CreateMediaResponse` when `autoPolling: false`.

```ts
// Liveness — photo
await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', { livenessCheck: true });

// Faceswap — video only
await client.uploadAndPoll('file:///clip.mp4', 'FI-1', { faceswapCheck: true });

// Similarity — photo + reference
await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  faceSimilarityCheck: true,
  referenceImage:      'file:///id-photo.jpg',
});

// Liveness + similarity combined
await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck:       true,
  faceSimilarityCheck: true,
  referenceImage:      'file:///id-photo.jpg',
});

// Other models
await client.uploadAndPoll('file:///clip.mp4',   'DF-1');  // deepfake
await client.uploadAndPoll('file:///selfie.jpg', 'FE-1');  // face vector

// Return right after upload, poll yourself later
const meta = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
  autoPolling:   false,
});
console.log(meta.job.id);
```

### RunOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `livenessCheck` | `boolean` | `false` | Run liveness check — FI-1 only |
| `faceswapCheck` | `boolean` | `false` | Run faceswap check — FI-1, video required |
| `faceSimilarityCheck` | `boolean` | `false` | Run similarity — FI-1, photo + `referenceImage` required |
| `referenceImage` | `string` | — | `file://` URI of the reference face image |
| `isSingleFace` | `boolean` | `true` | Hint that only one face is in the frame |
| `autoPolling` | `boolean` | `true` | Set `false` to return after upload |
| `interval` | `number` | `5000` | Polling interval in ms |
| `timeout` | `number` | `600000` | Max total polling time in ms (10 min) |
| `contentType` | `string` | — | Override the MIME type derived from the extension |

**Check compatibility — FI-1**

| Checks | Input | Can combine with |
|---|---|---|
| `livenessCheck` | Photo or video | `faceSimilarityCheck` |
| `faceswapCheck` | Video (max 10 s) | `livenessCheck` |
| `faceSimilarityCheck` | Photo + `referenceImage` | `livenessCheck` |
| `faceswapCheck` + `faceSimilarityCheck` | — | Not allowed — throws `ValidationError` |

### Models

| Model ID | Task | Input |
|---|---|---|
| `FI-1` | Face Intelligence — liveness, faceswap, similarity | Photo or video |
| `FE-1` | Face Embeddings — numeric face vector | Photo |
| `DF-1` | Deepfake detection | Video |
| `AC-1` | AI-generated image detection | Photo |

### Result fields

| Field | Type | Populated by |
|---|---|---|
| `isSpoof` | `boolean \| string` | FI-1 liveness |
| `isDeepFake` | `boolean \| string` | FI-1 faceswap, DF-1 |
| `isSimilar` | `boolean \| string` | FI-1 similarity |
| `similarityScore` | `number \| string` | FI-1 similarity |
| `faceVector` | `number[]` | FE-1 |
| `RealConfidencePercent` | `number \| string` | DF-1, AC-1 |

---

## Face Indexing

Three endpoints, all on the same host and API key as detection:

| Method | Endpoint |
|---|---|
| `faceEnrol(images)` | `POST /api/v1/facesim/enroll` |
| `tenants()` | `GET /api/v1/facesim/subjects` |
| `faceSearch(image, opts)` | `POST /api/v1/facesim/search` |

### faceEnrol()

Creates a subject and uploads each photo to its presigned S3 URL.

```ts
const subject = await client.faceEnrol([
  { uri: 'file:///front.jpg' },
  { uri: 'file:///left.png' },
]);

console.log(subject.subject_id, subject.status);
```

`name` and `contentType` are derived from the URI when omitted. Only
`image/jpeg`, `image/png`, and `image/webp` are accepted, and 1–10 images may be
enrolled at a time. Both rules are checked **before** the subject is created, so
a bad input never leaves a half-built record behind.

It returns as soon as S3 has the bytes. Embeddings are generated out of band —
call [`tenants()`](#tenants) afterwards to watch each face reach `processed`.

### faceSearch()

Ranks every enrolled face against a query photo.

```ts
const response = await client.faceSearch('file:///query.jpg', { limit: 10 });

for (const match of response.results) {
  console.log(match.rank, match.subject_id, match.similarity_score);
}
```

The argument is either a **local file URI** (read and encoded for you) or a
**Base64 string** you prepared yourself — including a `data:image/…;base64,…`
value, which is normalised. The bytes are sent exactly as they sit on disk: the
SDK never resizes or re-encodes them, so nothing disturbs the EXIF orientation
that face detection depends on.

The image travels as `image_bytes` in the JSON **POST body**, so there is no URL
length limit to worry about. `limit` defaults to 50 and is clamped to 1–50.

Search is independent of enrolment: it matches everything already indexed on the
account, including from earlier sessions. The same subject can appear more than
once because every enrolled face has its own embedding.

### tenants()

Every subject and face on the account — use it to follow enrolment progress.

```ts
const { subjects } = await client.tenants();

for (const subject of subjects) {
  for (const face of subject.faces) {
    console.log(face.face_id, face.status, face.error);
  }
}
```

### Face statuses

| Status | Meaning |
|---|---|
| `pending` | Upload URL created; the object has not been acknowledged yet |
| `uploaded` | Stored; waiting for a worker |
| `processing` | A worker is generating the embedding |
| `processed` | Embedding stored — the face is searchable |
| `failed` | Upload validation or embedding failed — inspect `face.error` |

A face that fails does not fail the whole enrolment. `TERMINAL_FACE_STATUSES`
(`['processed', 'failed']`) is exported so you can tell when polling is done.

---

## Error Handling

Every error extends `AuthentaError`, for both features.

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
  await client.uploadAndPoll(uri, 'FI-1', { livenessCheck: true });
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
  } else if (err instanceof ServerError) {
    // Platform error — safe to retry
  } else if (err instanceof AuthentaError) {
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

`ValidationError` is also thrown client-side, before any request, for an
unsupported image type, an image count outside 1–10, an empty search image, or
an incompatible FI-1 check combination.

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
  DetectionResult,
  ProcessedMedia,
  Artifact,
  TaskType,
} from '@authenta/core';

// Face indexing
import type {
  LocalFaceImage,
  EnrollImageDescriptor,
  EnrollFaceUpload,
  EnrollResponse,
  TenantResponse,
  TenantSubject,
  TenantFace,
  SearchResponse,
  SearchMatch,
  FaceStatus,
  FaceImageContentType,
} from '@authenta/core';
```

Runtime constants:

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
// uploadAndPoll() after polling
interface ProcessedMedia {
  id:         string;
  tenantId:   string;
  taskTypeId: string;
  status:     MediaStatus;   // "completed" | "queued" | "processing" | ...
  cost:       number;
  createdAt:  string;
  updatedAt:  string;
  result:     DetectionResult | null;
  artifacts:  Artifact[];
  taskType:   TaskType;
}

interface DetectionResult {
  isSpoof?:               boolean | string;
  isDeepFake?:            boolean | string;
  isSimilar?:             boolean | string;
  similarityScore?:       number  | string;
  faceVector?:            number[];
  RealConfidencePercent?: number  | string;
  [key: string]: any;
}

// faceEnrol()
interface EnrollResponse {
  subject_id: string;
  status:     FaceStatus;
  faces:      EnrollFaceUpload[];
  expires_at: string;
}

// tenants()
interface TenantFace {
  face_id:   string;
  name:      string;
  status:    FaceStatus;
  embedding: number[] | null;
  image_url: string;        // presigned, expires in ~5 min
  error:     string | null;
}

// faceSearch()
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

# @authenta/core

Pure TypeScript API client for the [Authenta](https://authenta.ai) eKYC platform. Works in **Node.js** and **React Native** — no native modules or UI dependencies.

Use this package directly if you want headless control over uploads, polling, and result retrieval. For a ready-made camera capture UI, use [`@authenta/react-native`](https://www.npmjs.com/package/@authenta/react-native).

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [AuthentaClient](#authentaclient)
  - [Configuration](#configuration)
  - [faceIntelligence()](#faceintelligence)
  - [RunOptions](#runoptions)
  - [Low-level API](#low-level-api)
- [Models](#models)
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
  clientId:     'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});

console.log(result.result?.isLiveness);   // true | false
console.log(result.status);               // "PROCESSED"
```

---

## AuthentaClient

### Configuration

```ts
const client = new AuthentaClient({
  clientId:     'YOUR_CLIENT_ID',       // required
  clientSecret: 'YOUR_CLIENT_SECRET',   // required
  baseUrl:      'https://platform.authenta.ai', // optional — default shown
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `clientId` | `string` | Yes | Your Authenta client ID |
| `clientSecret` | `string` | Yes | Your Authenta client secret |
| `baseUrl` | `string` | No | API base URL (default: `https://platform.authenta.ai`) |

---

### faceIntelligence()

The primary high-level method. Uploads the file, polls until processing is complete, fetches the detection result, and returns a `ProcessedMedia` object.

```ts
const result = await client.faceIntelligence(uri, modelType, options);
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `uri` | `string` | `file://` URI of the photo or video to analyse |
| `modelType` | `ModelType` | Model to run (e.g. `'FI-1'`) |
| `options` | `RunOptions` | Detection options — see [RunOptions](#runoptions) |

**Examples**

```ts
// Liveness check — photo
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});

// Faceswap check — video
const result = await client.faceIntelligence('file:///path/to/clip.mp4', 'FI-1', {
  faceswapCheck: true,
});

// Liveness + faceswap — video
const result = await client.faceIntelligence('file:///path/to/clip.mp4', 'FI-1', {
  livenessCheck: true,
  faceswapCheck: true,
});

// Face similarity — photo + reference
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  faceSimilarityCheck: true,
  referenceImage: 'file:///path/to/id-photo.jpg',
});

// Liveness + face similarity — photo
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
  faceSimilarityCheck: true,
  referenceImage: 'file:///path/to/id-photo.jpg',
});
```

**Returns** `Promise<ProcessedMedia>`

```ts
{
  mid:         string;       // unique media ID
  name:        string;
  status:      'PROCESSED';  // always PROCESSED on success
  modelType:   string;       // e.g. "FI-1"
  contentType: string;       // MIME type of the uploaded file
  size:        number;       // file size in bytes
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
| `livenessCheck` | `boolean` | `false` | Run liveness check (FI-1) |
| `faceswapCheck` | `boolean` | `false` | Run faceswap / deepfake check (FI-1, video required) |
| `faceSimilarityCheck` | `boolean` | `false` | Run face similarity check (FI-1, photo + reference required) |
| `referenceImage` | `string` | — | `file://` URI of reference face image (required when `faceSimilarityCheck: true`) |
| `isSingleFace` | `boolean` | `true` | Hint that only one face is present |
| `autoPolling` | `boolean` | `true` | Wait for result before returning. Set `false` to return immediately after upload |
| `interval` | `number` | `5000` | Polling interval in milliseconds |
| `timeout` | `number` | `600000` | Max polling duration in milliseconds (10 min) |

**Check compatibility**

| Check | Input required | Can combine with |
|---|---|---|
| `livenessCheck` | Photo **or** video | `faceSimilarityCheck` |
| `faceswapCheck` | Video (max 10 s) | `livenessCheck` |
| `faceSimilarityCheck` | Photo + `referenceImage` | `livenessCheck` |
| `faceswapCheck` + `faceSimilarityCheck` | — | **Not allowed** |

---

### Low-level API

Call each step individually for full control:

```ts
// 1. Upload — creates a media record and uploads the file to S3
const media = await client.upload('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});
console.log(media.mid); // "abc-123"

// 2. Poll until processing completes
const processed = await client.pollResult(media.mid, {
  interval: 3000,    // poll every 3 s
  timeout:  120000,  // give up after 2 min
});

// 3. Fetch the detection result from resultURL
const result = await client.getResult(processed);
console.log(result.isLiveness, result.isDeepFake);

// CRUD helpers
const record = await client.getMedia(mid);
const list   = await client.listMedia({ page: 1, pageSize: 20 });
await client.deleteMedia(mid);
```

---

## Models

| Model ID | Description | Input |
|---|---|---|
| `FI-1` | Face Intelligence — liveness, faceswap, face similarity | Photo or video |

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
  const result = await client.faceIntelligence(uri, 'FI-1', { livenessCheck: true });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid clientId / clientSecret — check your credentials
  } else if (err instanceof AuthorizationError) {
    // Account lacks permission for this operation
  } else if (err instanceof QuotaExceededError) {
    // Monthly quota exceeded
  } else if (err instanceof InsufficientCreditsError) {
    // No remaining credits
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
| `code` | `string?` | API error code (e.g. `IAM001`) |
| `statusCode` | `number?` | HTTP status code |
| `details` | `object?` | Raw API response body |

---

## TypeScript Types

All public types are exported from the package entry point:

```ts
import type {
  AuthentaClientConfig,
  ModelType,
  MediaStatus,
  FileInfo,
  FIOptions,
  RunOptions,
  PollingOptions,
  CreateMediaResponse,
  MediaRecord,
  ListMediaResponse,
  DetectionResult,
  ProcessedMedia,
} from '@authenta/core';
```
---

## License

MIT © Authenta

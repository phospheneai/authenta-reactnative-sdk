# Authenta React Native SDK

A React Native SDK for the [Authenta](https://authenta.ai) platform. Handles camera capture, file upload, polling, and result retrieval — your app only needs to declare which checks to run and handle the result.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Android Setup](#android-setup)
- [iOS Setup](#ios-setup)
- [Quick Start](#quick-start)
- [AuthentaCapture (Recommended)](#authentacapture-recommended)
  - [Props](#props)
  - [Result Object](#result-object)
  - [Check Compatibility Rules](#check-compatibility-rules)
  - [Full Example](#full-example)
- [AuthentaClient (Advanced / Headless)](#authentaclient-advanced--headless)
  - [Configuration](#configuration)
  - [client.faceIntelligence()](#clientfaceintelligence)
  - [RunOptions](#runoptions)
  - [Low-level API](#low-level-api)
- [Models](#models)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)
- [Contributing](#contributing)

---

## Requirements

| Requirement | Version |
|---|---|
| React Native | >= 0.74 |
| React | >= 18 |
| react-native-vision-camera | >= 4 |
| react-native-image-picker | >= 7 |


---

## Installation

```bash
npm install @authenta/react-native-sdk
```

Then install the required peer dependencies:

```bash
npm install react-native-vision-camera react-native-image-picker
```

> **Note:** These are peer dependencies — they must be installed in your app, not the SDK. After installing any package with native code you must rebuild the app (`npx react-native run-android` / `run-ios`).

---

## Android Setup

### 1. Camera & microphone permissions

In `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### 2. Build

```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

---

## iOS Setup

### 1. Install pods

```bash
cd ios && pod install && cd ..
```

### 2. Camera & microphone permissions

In `ios/<AppName>/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture during identity verification.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is required for video recording during face verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select a reference image.</string>
```

### 3. Build

```bash
npx react-native run-ios
```

---

## Quick Start

```tsx
import React, { useState } from 'react';
import { Button } from 'react-native';
import { AuthentaClient, AuthentaCapture } from '@authenta/react-native-sdk';
import type { ProcessedMedia } from '@authenta/react-native-sdk';

// Create a client once — outside your component or in a context/singleton
const client = new AuthentaClient({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

export default function App() {
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<ProcessedMedia | null>(null);

  return (
    <>
      <Button title="Start Verification" onPress={() => setVisible(true)} />

      <AuthentaCapture
        client={client}
        visible={visible}
        onClose={() => setVisible(false)}
        onResult={(result) => {
          setVisible(false);
          setResult(result);
          console.log(result);
        }}
        onerr={(err) => {
          setVisible(false);
          handleErr(err);
        }}
        livenessCheck={true}
      />
    </>
  );
}
```

---

## AuthentaCapture (Recommended)

`AuthentaCapture` is a self-contained modal UI. It opens the front camera, guides the user through capture, uploads the file, polls for the result, and returns a `ProcessedMedia` object — all internally. Your app only passes which checks to enable and receives the result.

```tsx
<AuthentaCapture
  client={client}
  visible={visible}
  onClose={() => setVisible(false)}
  onResult={(result) => {
    setVisible(false);
    console.log(result);
  }}
  onError={(error) => {
    setVisible(false);
    console.error(error);
  }}
  livenessCheck={true}
  faceswapCheck={false}
  faceSimilarityCheck={false}
  modelType="FI-1"
/>
```

### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `AuthentaClient` | Yes | — | Initialized SDK client instance |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `onResult` | `(result: ProcessedMedia) => void` | Yes | — | Called with the detection result on success |
| `onError` | `(error: Error) => void` | No | — | Called on any capture or API error |
| `modelType` | `ModelType` | No | `'FI-1'` | Which model to run against |
| `livenessCheck` | `boolean` | No | `false` | Pre-enable the liveness check toggle |
| `faceswapCheck` | `boolean` | No | `false` | Pre-enable the faceswap check toggle |
| `faceSimilarityCheck` | `boolean` | No | `false` | Pre-enable the face similarity check toggle |

### Result Object

`mid fetch result recieved media object with mid`

```ts
{
  mid: string;               // unique media ID
  name: string;
  status: 'PROCESSED';       // always PROCESSED on success
  modelType: string;         // e.g. "FI-1"
  contentType: string;       // MIME type of the uploaded file
  size: number;              // file size in bytes
  createdAt: string;         // ISO 8601 timestamp
  srcURL?: string;
  resultURL?: string;
}
```
`onResult` receives a `ProcessedMedia` object:

```ts
{
  resultType: string;           // e.g. "face-intelligence"
  isLiveness?: string | boolean;           // liveness check result
  isDeepFake?: string | boolean;           // faceswap/deepfake result
  isSimilar?: string | boolean;            // face similarity result
  similarityScore?: string | number;       // similarity confidence score (0-100)
  [key: string]: any;                     // other model-specific result fields
}
```

### Check Compatibility Rules

| Check | Capture Mode | Can Combine With |
|---|---|---|
| `livenessCheck` | Photo & Video | `faceSimilarityCheck` |
| `faceswapCheck` | Video (max 10 s) | `livenessCheck` |
| `faceSimilarityCheck` | Photo (+ reference image) | `livenessCheck` |
| `faceswapCheck` + `faceSimilarityCheck` | — | **Not allowed** — conflicting capture modes |

The SDK enforces these rules internally and shows a user-facing error when an invalid combination is selected. Retries are automatically managed — the user gets up to **3 attempts** before a final error is shown.

### Full Example

See the **[AuthentaDemo app](../AuthentaDemo/README.md)** — a complete runnable React Native app that shows the full integration in a single file ([App.tsx](../AuthentaDemo/App.tsx)).

It covers:
- Creating the client
- Toggle switches for each check
- Rendering `AuthentaCapture` and receiving the result
- Displaying results and errors on screen

---

## AuthentaClient (Advanced / Headless)

Use `AuthentaClient` directly if you want full control over the camera, file selection, or UI — or if you are not using `AuthentaCapture`.

### Configuration

```ts
import { AuthentaClient } from '@authenta/react-native-sdk';

const client = new AuthentaClient({
  clientId:     'YOUR_CLIENT_ID',       // required
  clientSecret: 'YOUR_CLIENT_SECRET',   // required
  baseUrl:      'https://platform.authenta.ai', // optional — default shown
});
```

### client.faceIntelligence()

The highest-level method. Pass a `file://` URI and a model type, get back a fully-processed result.

```ts
const result = await client.faceIntelligence(uri, modelType, options);
```

**Examples:**

```ts
// FI-1 — liveness check (photo)
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});

// FI-1 — faceswap check (video)
const result = await client.faceIntelligence('file:///path/to/clip.mp4', 'FI-1', {
  faceswapCheck: true,
});

// FI-1 — liveness + faceswap (video)
const result = await client.faceIntelligence('file:///path/to/clip.mp4', 'FI-1', {
  livenessCheck: true,
  faceswapCheck: true,
});

// FI-1 — face similarity (photo + reference image)
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  faceSimilarityCheck: true,
  referenceImage: 'file:///path/to/id-card.jpg',
});

// DF-1 — deepfake detection (video)
const result = await client.faceIntelligence('file:///path/to/video.mp4', 'DF-1');

// AC-1 — age / content check (photo)
const result = await client.faceIntelligence('file:///path/to/photo.jpg', 'AC-1');
```

### RunOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `livenessCheck` | `boolean` | `false` | Run liveness check (FI-1, photo) |
| `faceswapCheck` | `boolean` | `false` | Run faceswap/deepfake check (FI-1, video) |
| `faceSimilarityCheck` | `boolean` | `false` | Run face similarity check (FI-1, photo) |
| `referenceImage` | `string` | — | `file://` URI of reference face image (required when `faceSimilarityCheck: true`) |
| `isSingleFace` | `boolean` | `true` | Hint that only one face is present in the media |
| `autoPolling` | `boolean` | `true` | Wait for result before returning. Set `false` to return immediately after upload |
| `interval` | `number` | `5000` | Polling interval in milliseconds |
| `timeout` | `number` | `600000` | Maximum polling duration in milliseconds (10 min) |

### Low-level API

For fine-grained control, call each step individually:

```ts
// 1. Upload — returns a media ID and a pre-signed S3 URL
const media = await client.upload('file:///path/to/video.mp4', 'FI-1', {
  livenessCheck: true,
  faceswapCheck: true,
});
console.log(media.mid); // "abc-123"

// 2. Poll until processing completes (status → PROCESSED / FAILED / ERROR)
const processed = await client.waitForMedia(media.mid, {
  interval: 3000,   // poll every 3 s
  timeout:  120000, // give up after 2 min
});

// 3. Fetch the detection result JSON from resultURL
const result = await client.getResult(processed);
console.log(result.isLiveness, result.isDeepFake);

// Other CRUD
const record = await client.getMedia(mid);
const list   = await client.listMedia({ page: 1, pageSize: 20 });
await client.deleteMedia(mid);
```

---

## Models

| Model ID | Description | Supported Input |
|---|---|---|
| `FI-1` | Face Intelligence — liveness, faceswap, and face similarity | Photo or video |

---

## Error Handling

The SDK throws typed errors. Import and catch them specifically:

```ts
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  QuotaExceededError,
  InsufficientCreditsError,
  ValidationError,
  ServerError,
} from '@authenta/react-native-sdk';

try {
  const result = await client.faceIntelligence(uri, 'FI-1', { livenessCheck: true });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid clientId / clientSecret
  } else if (err instanceof AuthorizationError) {
    // Account does not have permission for this operation
  } else if (err instanceof QuotaExceededError) {
    // Monthly quota exceeded
  } else if (err instanceof InsufficientCreditsError) {
    // No remaining credits on the account
  } else if (err instanceof ValidationError) {
    // Bad input — check err.message for details
    console.error(err.message, err.code, err.statusCode);
  } else if (err instanceof ServerError) {
    // Authenta platform error — safe to retry
  } else if (err instanceof AuthentaError) {
    // Base class — all SDK errors extend this
    console.error(err.message, err.code, err.statusCode, err.details);
  }
}
```

All error classes expose:

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `code` | `string?` | API error code (e.g. `IAM001`) |
| `statusCode` | `number?` | HTTP status code |
| `details` | `object?` | Raw API response body |

---

## TypeScript Types

All public types are exported from the root package entry point:

```ts
import type {
  // Config & props
  AuthentaClientConfig,
  AuthentaCaptureProps,

  // Options
  RunOptions,
  FIOptions,
  PollingOptions,

  // API responses
  ProcessedMedia,
  MediaRecord,
  CreateMediaResponse,
  ListMediaResponse,
  ListMediaParams,
  DetectionResult,

  // Supporting types
  ModelType,
  MediaStatus,
  FileInfo,
  IdentityPrediction,
  BoundingBoxesMap,
  FrameBoundingBox,
  IdentityBoundingBox,
  BoundingBoxCoords,
} from '@authenta/react-native-sdk';
```

---

## Contributing

Contributions are welcome. Please follow these steps:

### 1. Clone and install

```bash
git clone https://github.com/yourusername/@authenta/react-native-sdk.git
cd @authenta/react-native-sdk
npm install
```

### 2. Project structure

```
src/
├── AuthentaCapture.tsx   # Modal UI — camera, capture, retry flow
├── client.ts             # AuthentaClient — all API and upload logic
├── errors.ts             # Typed error classes
├── types/index.ts        # All TypeScript interfaces and types
├── utils/helpers.ts      # MIME type resolution, isImage, isVideo helpers
├── services/index.ts     # Re-exports AuthentaClient
└── index.ts              # Public API surface
```

### 3. Build

```bash
npm run build    # compiles TypeScript → dist/
```

### 4. Run tests

```bash
npm test
```

### 5. Guidelines

- **Do not break the public API** — `AuthentaClient`, `AuthentaCapture`, and all exported types are the stable public surface.
- **No Node.js built-ins** — do not use `fs`, `path`, `crypto`, or any other Node.js built-in in any `src/` file. Metro (the React Native bundler) cannot resolve them. Use `XMLHttpRequest` for file reads.
- **Peer dependencies only** — `react`, `react-native`, `react-native-vision-camera`, and `react-native-image-picker` must stay as `peerDependencies` and must never be moved to `dependencies`.
- **Typed errors** — all thrown errors must extend `AuthentaError`. New error types go in `errors.ts`.
- **Types in one place** — all interfaces and types belong in `src/types/index.ts` and must be exported from `src/index.ts`.
- **Validation rules** — faceswap/similarity conflict, `referenceImage` requirement, and image vs. video restrictions are enforced in `client.ts` `faceIntelligence()` only. Do not duplicate them elsewhere.

### 6. Submit a pull request

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make your changes and add tests where relevant
4. Run `npm run build && npm test` — both must pass
5. Open a pull request with a clear description of what changed and why

---

## License

MIT © Authenta

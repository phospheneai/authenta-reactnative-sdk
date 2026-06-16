# @authenta/react-native

React Native camera capture UI for the [Authenta](https://authenta.ai) eKYC platform. Wraps [`@authenta/core`](https://www.npmjs.com/package/@authenta/core) in a self-contained modal — your app only decides which checks to enable and receives the result.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Android Setup](#android-setup)
- [iOS Setup](#ios-setup)
- [Quick Start](#quick-start)
- [AuthentaCapture](#authentacapture)
  - [Props](#props)
  - [Check Modes & Capture Rules](#check-modes--capture-rules)
  - [Result Object](#result-object)
- [Using AuthentaClient Directly](#using-authentaclient-directly)
- [Error Handling](#error-handling)
- [Platform Notes](#platform-notes)
- [TypeScript Types](#typescript-types)

---

## Requirements

| Dependency | Version |
|---|---|
| React Native | ≥ 0.72 |
| React | ≥ 18 |
| react-native-vision-camera | ≥ 5 |
| react-native-image-picker | ≥ 7 |
| react-native-blob-util | ≥ 0.19 |
| react-native-compressor | ≥ 1.18 |
| react-native-nitro-modules | ≥ 0.35 |
| react-native-nitro-image | ≥ 0.14 |

---

## Installation

```bash
npm install @authenta/react-native
```

Then install peer dependencies:

```bash
npm install react-native-vision-camera react-native-image-picker \
  react-native-blob-util react-native-compressor \
  react-native-nitro-modules react-native-nitro-image
```

After installation, link the native modules:

```bash
# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

---

## Android Setup

Add to `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

---

## iOS Setup

Add to `ios/<AppName>/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture during identity verification.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is required for video recording during face verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select a reference image.</string>
```

---

## Quick Start

```tsx
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { AuthentaClient } from '@authenta/core';
import { AuthentaCapture } from '@authenta/react-native';
import type { ProcessedMedia } from '@authenta/core';

// Create once — outside your component or in a context/singleton
const client = new AuthentaClient({
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

export default function App() {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Button title="Start Verification" onPress={() => setVisible(true)} />

      <AuthentaCapture
        client={client}
        modelType="FI-1"
        visible={visible}
        livenessCheck={true}
        onClose={() => setVisible(false)}
        onResult={(media: ProcessedMedia) => {
          setVisible(false);
          console.log(media.result?.isSpoof);       // liveness
          console.log(media.result?.isDeepFake);    // faceswap
          console.log(media.result?.isSimilar);     // similarity
        }}
        onError={(err) => {
          setVisible(false);
          console.error(err.message);
        }}
      />
    </View>
  );
}
```

---

## AuthentaCapture

`AuthentaCapture` is a self-contained modal that handles the entire eKYC capture flow:

1. **Toggles** — user enables which checks to run (or pre-set via props)
2. **Reference image** — user picks a face photo from their library (only when `faceSimilarityCheck` is enabled)
3. **Camera** — live camera view with capture/record buttons and front/back flip
4. **Processing** — upload → finalize → polling → result fetch, all handled internally
5. **Result / Error** — shows the outcome; up to 3 retry attempts on failure

### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `AuthentaClient` | Yes | — | Initialized client from `@authenta/core` |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `onResult` | `(result: ProcessedMedia) => void` | Yes | — | Called with the job result on success |
| `onError` | `(error: Error \| AuthentaError) => void` | No | — | Called on capture or API errors |
| `modelType` | `ModelType` | No | `'FI-1'` | Model to run |
| `livenessCheck` | `boolean` | No | `false` | Pre-enable liveness check |
| `faceswapCheck` | `boolean` | No | `false` | Pre-enable faceswap check |
| `faceSimilarityCheck` | `boolean` | No | `false` | Pre-enable face similarity check |

### Check Modes & Capture Rules

The SDK automatically selects the correct capture mode based on which checks are enabled:

| Checks enabled | Capture mode | Notes |
|---|---|---|
| `livenessCheck` only | Photo **and** video — user chooses | Both buttons shown side by side |
| `faceswapCheck` only | Video only (max 10 s) | |
| `faceSimilarityCheck` only | Photo only | Reference image picker appears first |
| `faceswapCheck` + `livenessCheck` | Video only | faceswap takes priority |
| `livenessCheck` + `faceSimilarityCheck` | Photo only | similarity takes priority |
| `faceswapCheck` + `faceSimilarityCheck` | — | Not allowed — SDK shows an error |

The user can flip between front and back camera at any time (except while recording).

Video recording is capped at **10 seconds** and **7 MB**. If the file exceeds 6 MB it is automatically compressed before upload using `react-native-compressor`.

### Result Object

`onResult` receives a `ProcessedMedia` object:

```ts
{
  id:         string;        // job ID — e.g. "2710"
  tenantId:   string;
  taskTypeId: string;        // e.g. "8" for FI-1
  status:     string;        // "completed"
  cost:       number;
  createdAt:  string;        // ISO 8601
  updatedAt:  string;
  result: {
    isSpoof?:         boolean | string;  // liveness check
    isDeepFake?:      boolean | string;  // faceswap check
    isSimilar?:       boolean | string;  // similarity check
    similarityScore?: number  | string;  // similarity confidence
    [key: string]:    any;
  } | null;
  artifacts: Artifact[];
  taskType:  TaskType;
}
```

---

## Using AuthentaClient Directly

`@authenta/react-native` re-exports the full `AuthentaClient` API so you only need one import. Use it headless if you have your own camera UI.

```ts
import { AuthentaClient } from '@authenta/react-native'; // or '@authenta/core'

const client = new AuthentaClient({
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

// ── High-level ────────────────────────────────────────────────────────────

const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', {
  livenessCheck: true,
});
console.log(media.result?.isSpoof);

// ── Convenience wrappers ─────────────────────────────────────────────────

const r1 = await client.verify_liveness('file:///selfie.jpg');
const r2 = await client.verify_deepfake('file:///clip.mp4');
const r3 = await client.verify_similarity('file:///selfie.jpg', 'file:///id-photo.jpg');
const r4 = await client.verify_face_embeddings('file:///selfie.jpg');

// ── Low-level (step by step) ─────────────────────────────────────────────

const meta = await client.upload('file:///selfie.jpg', 'FI-1', { livenessCheck: true });
// meta.job.id       — job ID to poll
// meta.inputs[0]    — signed S3 URL for the original file

await client.finalizeMedia(meta.job.id);

const processed = await client.pollResult(meta.job.id, {
  interval: 3_000,
  timeout:  120_000,
});
const result = await client.getResult(processed);

// ── CRUD ─────────────────────────────────────────────────────────────────

const job  = await client.getMedia('2710');
const list = await client.listMedia({ page: 1, pageSize: 20 });
await client.deleteMedia('2710');
```

See the [`@authenta/core` README](https://www.npmjs.com/package/@authenta/core) for the full API reference and all `RunOptions`.

---

## Error Handling

```ts
import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  QuotaExceededError,
  InsufficientCreditsError,
  ValidationError,
  ServerError,
} from '@authenta/react-native';

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
```

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `code` | `string?` | API error code (e.g. `IAM001`) |
| `statusCode` | `number?` | HTTP status code |
| `details` | `object?` | Raw API response body |

### Camera Errors

The SDK surfaces camera errors through `onError` with a human-readable message:

| Situation | Error message |
|---|---|
| Active phone call (audio conflict) | `"The camera was interrupted by a phone call. End the call and tap Try Again."` |
| Active video call (FaceTime / Zoom) | `"The camera is in use by another app. Please end that call and try again."` |
| Camera not ready yet | `"Camera is still starting. Please try again in a moment."` |
| Recording failed | `"Recording failed"` |

The modal allows up to **3 retry attempts** before requiring the user to dismiss and restart.

---

## Platform Notes

### iOS

- Each detection attempt starts a **fresh native `AVCaptureSession`**. This prevents a crash that occurs on iOS when the same session is reused after an error or interruption — Android's Camera2 API does not have this restriction.
- **Audio phone calls:** Photo capture works normally during an active audio call. Video recording is unavailable as iOS's audio session is held by the call.
- **Video calls (FaceTime, Zoom, Teams):** iOS gives the active video call app exclusive camera access. Detection is not possible while a video call is in progress — the user must end the call first.
- **Screen recording / screen mirroring:** Neither blocks the camera. Detection works normally.

### Android

- Camera and microphone permissions are requested at runtime on first use.
- No known restrictions when used alongside audio calls.

---

## TypeScript Types

All types are re-exported from `@authenta/core`:

```ts
import type {
  AuthentaClientConfig,
  ModelType,
  MediaStatus,
  FIOptions,
  RunOptions,
  PollingOptions,
  CreateMediaResponse,
  DetectionResult,
  ProcessedMedia,
  Artifact,
  TaskType,
} from '@authenta/react-native';
```

---

## License

MIT © Authenta

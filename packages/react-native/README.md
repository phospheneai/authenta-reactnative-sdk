# @authenta/react-native

React Native UI for the [Authenta](https://authenta.ai) platform. Wraps [`@authenta/core`](https://www.npmjs.com/package/@authenta/core) in a self-contained modal — your app sets four toggles and receives the result.

**One import, one component, one client:**

```tsx
import { AuthentaCapture, AuthentaClient } from '@authenta/react-native';
```

| Toggle | What the modal does |
|---|---|
| `livenessCheck` · `faceswapCheck` · `faceSimilarityCheck` | Opens the camera, captures, uploads, polls, returns the verdict |
| `faceIndexing` | Switches to enrol/search — index a person's photos, or match a face |

The two features are mutually exclusive; asking for both raises a `ValidationError`.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Android Setup](#android-setup)
- [iOS Setup](#ios-setup)
- [Quick Start](#quick-start)
- [Props](#props)
- [Detection](#detection)
  - [Capture rules](#capture-rules)
  - [Result object](#result-object)
- [Face Indexing](#face-indexing)
  - [Flow](#flow)
  - [Results](#results)
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

npm install react-native-vision-camera react-native-image-picker \
  react-native-blob-util react-native-compressor \
  react-native-nitro-modules react-native-nitro-image
```

Then link the native modules:

```bash
# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

---

## Android Setup

Add to `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**No microphone permission is needed** — video is recorded without audio, so the
SDK never requests it.

---

## iOS Setup

Add to `ios/<AppName>/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture during identity verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select images for face indexing.</string>
```

---

## Quick Start

```tsx
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { AuthentaCapture, AuthentaClient } from '@authenta/react-native';

// Create once — outside your component, or in a context/singleton
const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Button title="Start Verification" onPress={() => setOpen(true)} />

      <AuthentaCapture
        client={client}
        visible={open}
        onClose={() => setOpen(false)}

        livenessCheck={true}
        faceswapCheck={false}
        faceSimilarityCheck={false}
        faceIndexing={false}

        onResult={(media) => {
          setOpen(false);
          console.log(media.result?.isSpoof);
        }}
        onError={(err) => console.error(err.message)}
      />
    </View>
  );
}
```

---

## Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `AuthentaClient` | Yes | — | One client serves both features |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `livenessCheck` | `boolean` | No | `false` | Run the liveness check |
| `faceswapCheck` | `boolean` | No | `false` | Run the faceswap check (video) |
| `faceSimilarityCheck` | `boolean` | No | `false` | Run the similarity check (needs `referenceImage`) |
| `faceIndexing` | `boolean` | No | `false` | Switch to enrol/search instead of detection |
| `referenceImage` | `string` | No | — | Reference photo URI for `faceSimilarityCheck` |
| `modelType` | `ModelType` | No | `'FI-1'` | Detection model to run |
| `maxImages` | `number` | No | `3` | How many photos may be indexed at once |
| `onResult` | `(result: ProcessedMedia) => void` | No | — | Detection finished |
| `onEnrolled` | `(result: EnrollResponse) => void` | No | — | Photos uploaded for indexing |
| `onSearchResult` | `(result: SearchResponse) => void` | No | — | Face search returned matches |
| `onError` | `(error: Error) => void` | No | — | Validation, capture, or API error |

**Enforced on open**, surfacing through `onError` as a `ValidationError`:

- `faceIndexing` with any detection check — face indexing runs no model
- No check enabled at all for `FI-1`
- `faceswapCheck` together with `faceSimilarityCheck` — one needs video, the other a photo

---

## Detection

`busy → camera → analysing → result`

The host app already chose the checks, so the modal asks the user nothing. It
takes camera permission, opens the camera in the right mode, uploads what was
captured, polls, and shows the verdict.

### Capture rules

| Checks enabled | Capture mode | Notes |
|---|---|---|
| `livenessCheck` only | Photo **and** video — user chooses | Both buttons shown |
| `faceswapCheck` only | Video only (max 10 s) | |
| `faceSimilarityCheck` only | Photo only | Supply `referenceImage` |
| `faceswapCheck` + `livenessCheck` | Video only | faceswap takes priority |
| `livenessCheck` + `faceSimilarityCheck` | Photo only | similarity takes priority |
| `faceswapCheck` + `faceSimilarityCheck` | — | Not allowed |

The user can flip between front and back camera except while recording. Video is
capped at **10 seconds** and **7 MB**, and compressed before upload if it exceeds
6 MB. Recording never captures audio.

### Result object

`onResult` receives a `ProcessedMedia`:

```ts
{
  id:         string;        // job ID
  tenantId:   string;
  taskTypeId: string;        // e.g. "8" for FI-1
  status:     string;        // "completed"
  cost:       number;
  createdAt:  string;
  updatedAt:  string;
  result: {
    isSpoof?:         boolean | string;  // liveness
    isDeepFake?:      boolean | string;  // faceswap
    isSimilar?:       boolean | string;  // similarity
    similarityScore?: number  | string;
  } | null;
  artifacts: Artifact[];
  taskType:  TaskType;
}
```

---

## Face Indexing

Set `faceIndexing` and the same component becomes an indexing tool. Enrolling
and searching are independent — searching needs no prior enrolment in this
session, since it matches everything already indexed on the account.

### Flow

```
              ┌─────────────────────────┐
              │     Face Indexing       │
              │  [Index a Face]         │
              │  [Search a Face]        │
              └──────┬───────────┬──────┘
                     │           │
        ┌────────────┘           └────────────┐
        ▼                                     ▼
  Add photos                            Pick a photo
  camera or library                     camera or library
        ▼                                     ▼
  Uploading…                            Matching…
        ▼                                     ▼
  ┌──────────────┐                    ┌──────────────────┐
  │ Faces Indexed│                    │ Search Results   │
  │ [Index More] │                    │ ranked matches   │
  │ [Search]     │                    │ [Search Another] │
  │ [Done]       │                    │ [Back]           │
  └──────────────┘                    └──────────────────┘
```

Both halves take photos from **the camera or the library**. HEIC from the iOS
library is converted to JPEG automatically for enrolment, since the server
accepts only JPEG, PNG, and WebP.

Search photos are sent **exactly as captured** — no resizing or re-encoding, so
the EXIF orientation face detection relies on stays intact. The bytes travel in
a JSON POST body, so there is no URL length limit.

The modal stays open after each step so the user can keep going. Close it from
`onClose` when you would rather show results in your own UI.

### Results

`onEnrolled` receives an `EnrollResponse` — the photos are uploaded, but
embeddings are generated in the background:

```ts
{
  subject_id: string;
  status:     string;
  faces:      Array<{ face_id: string; status: string }>;
  expires_at: string;
}
```

Call `client.tenants()` afterwards to watch each face reach `processed`.

`onSearchResult` receives a `SearchResponse`, strongest match first:

```ts
{
  count: number;
  results: Array<{
    rank: number; subject_id: string; face_id: string;
    name: string; image_url: string; similarity_score: number;   // 0–1
  }>;
}
```

---

## Using AuthentaClient Directly

`@authenta/react-native` re-exports all of `@authenta/core`, so one import is
enough. Use the client headless if you have your own UI.

```ts
import { AuthentaClient } from '@authenta/react-native';

const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  api_key: 'YOUR_API_KEY',
  auth_enabled: true,
});

const media   = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', { livenessCheck: true });
const subject = await client.faceEnrol([{ uri: 'file:///front.jpg' }]);
const matches = await client.faceSearch('file:///query.jpg', { limit: 10 });
const all     = await client.tenants();
```

See the [`@authenta/core` README](https://www.npmjs.com/package/@authenta/core)
for the full API reference.

---

## Error Handling

Everything reaches `onError`, and every error extends `AuthentaError`.

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
} else if (err instanceof ValidationError) {
  // Bad toggle combination or unsupported image
} else if (err instanceof AuthentaError) {
  console.error(err.message, err.code, err.statusCode, err.details);
}
```

### Camera errors

Surfaced through `onError` with a human-readable message:

| Situation | Message |
|---|---|
| Active phone call | `"The camera was interrupted by a phone call. End the call and tap Try Again."` |
| Active video call (FaceTime / Zoom) | `"The camera is in use by another app. Please end that call and try again."` |
| Camera not ready yet | `"Camera is still starting. Please try again in a moment."` |
| Recording failed | `"Recording failed"` |

Detection allows up to **3 retry attempts** before the user must dismiss and restart.

---

## Platform Notes

### iOS

- Each capture starts a **fresh native `AVCaptureSession`**, preventing a crash that occurs when a session is reused after an error or interruption. Android's Camera2 API has no such restriction.
- **Audio phone calls:** photo capture works normally. Video recording is unavailable while iOS holds the audio session.
- **Video calls (FaceTime, Zoom, Teams):** the active call app gets exclusive camera access — the user must end the call first.
- **Screen recording / mirroring:** neither blocks the camera.

### Android

- Camera permission is requested at runtime on first use.
- No known restrictions alongside audio calls.

---

## TypeScript Types

The component's props plus every `@authenta/core` type:

```ts
import type {
  AuthentaCaptureProps,

  // Detection
  AuthentaClientConfig,
  ModelType,
  RunOptions,
  ProcessedMedia,
  DetectionResult,

  // Face indexing
  LocalFaceImage,
  EnrollResponse,
  TenantResponse,
  TenantFace,
  SearchResponse,
  SearchMatch,
  FaceStatus,
} from '@authenta/react-native';
```

---

## License

MIT © Authenta

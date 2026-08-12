# @authenta/react-native

React Native UI for the [Authenta](https://authenta.ai) platform. Wraps [`@authenta/core`](https://www.npmjs.com/package/@authenta/core) in self-contained modals — your app decides what to run and receives the result.

Two independent components:

| Component | Service | What it does |
|---|---|---|
| `AuthentaCapture` | Authenta platform | Captures a photo or video and returns liveness / faceswap / similarity results |
| `AuthentaFaceIndex` | Your FaceSim host | Enrols photos of a person, and searches a face against everything enrolled |

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
- [AuthentaFaceIndex](#authentafaceindex)
  - [Flow](#flow)
  - [Props](#props-1)
- [Choosing between the two](#choosing-between-the-two)
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

`AuthentaCapture` is a self-contained modal that handles the entire capture flow:

1. **Starting** — validates the checks you passed in and requests camera/microphone permission
2. **Reference image** — user picks a face photo from their library (only when `faceSimilarityCheck` is enabled)
3. **Camera** — live camera view with capture/record buttons and front/back flip
4. **Processing** — upload → finalize → polling → result fetch, all handled internally
5. **Result / Error** — shows the outcome; up to 3 retry attempts on failure

Your app decides which checks to run and passes them as props — the modal never
asks the user to pick them again. It opens straight into the camera (or the
reference picker, when similarity is enabled).

### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `AuthentaClient` | Yes | — | Initialized client from `@authenta/core` |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `onResult` | `(result: ProcessedMedia) => void` | Yes | — | Called with the job result on success |
| `onError` | `(error: Error \| AuthentaError) => void` | No | — | Called on capture or API errors |
| `modelType` | `ModelType` | No | `'FI-1'` | Model to run |
| `livenessCheck` | `boolean` | No | `false` | Run the liveness check |
| `faceswapCheck` | `boolean` | No | `false` | Run the faceswap check (video) |
| `faceSimilarityCheck` | `boolean` | No | `false` | Run the face similarity check (photo + reference image) |

At least one check must be enabled for `FI-1`, and `faceswapCheck` cannot be
combined with `faceSimilarityCheck` — either mistake surfaces through `onError`
as a `ValidationError` as soon as the modal opens.

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

## AuthentaFaceIndex

`AuthentaFaceIndex` is a separate modal for the **FaceSim** face-indexing
server. It is unrelated to detection: different host, no API key, and a tenant
UUID instead. Use it alongside `AuthentaCapture` or on its own.

```tsx
import { AuthentaFaceIndex, FaceIndexClient } from '@authenta/react-native';

const faces = new FaceIndexClient({
  baseUrl: 'http://192.168.1.10:8000',
  tenantId: '6c60ef62-c848-40e3-9cb4-9472ff7b8b58',
});

<AuthentaFaceIndex
  client={faces}
  visible={open}
  maxImages={3}
  onClose={() => setOpen(false)}
  onEnrolled={(result) => console.log(result.subject_id, result.processedCount)}
  onSearchResult={(response) => console.log(response.results)}
  onError={(err) => console.warn(err.message)}
/>
```

### Flow

Enrolling and searching are **two independent features**, both reachable from
the modal's home page. Searching does not require enrolling first — it matches
against every face already indexed for the tenant, including from earlier
sessions.

```
                    ┌──────────────────────────┐
                    │  Face Indexing (home)    │
                    │  ─ pick up to N photos   │
                    │  [Index N Photos]        │
                    │  [Search a Face]         │
                    └───────┬──────────┬───────┘
                            │          │
             ┌──────────────┘          └──────────────┐
             ▼                                        ▼
    Indexing (upload + poll)                  Camera or Library
             ▼                                        ▼
    ┌──────────────────┐                     Matching (downscale + search)
    │ Faces Indexed    │                              ▼
    │ per-photo status │                     ┌──────────────────┐
    │ [Index More]     │                     │ Search Results   │
    │ [Done]           │                     │ ranked matches   │
    └──────────────────┘                     │ [Search Another] │
                                             │ [Back]           │
                                             └──────────────────┘
```

1. **Face Indexing** — pick up to `maxImages` photos from the library. HEIC is
   converted to JPEG automatically, since the server takes only JPEG, PNG, and
   WebP. Search is available here too.
2. **Indexing** — uploads to S3 and polls until every embedding is stored.
3. **Faces Indexed** — per-photo status, with any server error shown inline.
4. **Search a Face** — take a photo with the camera or pick one from the
   library. The original bytes are Base64 encoded and sent in a POST body.
5. **Search Results** — matches ranked by similarity, strongest first.

The modal stays open after each step so the user can keep enrolling or
searching. `onEnrolled` and `onSearchResult` hand the same data to your app, so
you can render it in your own UI — close the modal from `onClose` when you would
rather show results yourself.

### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `FaceIndexClient` | Yes | — | Client from `@authenta/core` |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `onEnrolled` | `(result: EnrollmentResult) => void` | No | — | Called when every face has settled |
| `onSearchResult` | `(response: SearchResponse) => void` | No | — | Called after each search |
| `onError` | `(error: Error) => void` | No | — | Called on validation, network, or API errors |
| `maxImages` | `number` | No | `3` | How many photos may be indexed at once |

> **Cleartext HTTP:** a FaceSim server on `http://` needs
> `android:usesCleartextTraffic="true"` (or a network-security config) on
> Android, and an `NSAppTransportSecurity` exception on iOS. `127.0.0.1` refers
> to the device — use your machine's LAN IP when testing.

Enrolling and searching both read from the photo library, so
`NSPhotoLibraryUsageDescription` is required on iOS. Searching by camera also
needs `NSCameraUsageDescription` — but never the microphone, since face indexing
never records video.

Camera and library searches follow the same path: the SDK reads the original
file, converts it to padded URL-safe Base64, and sends `tenant_id` and
`image_bytes` in the JSON body of `POST /v1/search`. Only `limit` remains in the
query string. Search has a 120-second timeout for transfer and face embedding.

---

## Choosing between the two

The two components hit different servers and share no state. A face-indexing
session runs **no detection model**, and a detection session indexes nothing.
Present them as separate modes rather than running both at once:

```tsx
const [mode, setMode] = useState<'detect' | 'index' | null>(null);

<AuthentaCapture   visible={mode === 'detect'} … />
<AuthentaFaceIndex visible={mode === 'index'}  … />
```

Opening both at the same time stacks two modals and is never useful. If your UI
has detection toggles alongside an indexing switch, clear and disable the
toggles while indexing is selected — `AuthentaCapture` will otherwise open with
no checks enabled and immediately report a `ValidationError`. See
[examples/AuthentaDemo/App.tsx](../../examples/AuthentaDemo/App.tsx) for a
worked example.

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

### Face Indexing Errors

`AuthentaFaceIndex` reports failures through `onError` as `FaceIndexError`,
whose `message` is already safe to show a user (the raw server text is kept at
`err.details.apiMessage`):

| Situation | Error message |
|---|---|
| Tenant not permitted | `"This tenant is not allowed to use face indexing."` |
| No face in the query photo | `"No face was found in that photo. Use a clear, front-facing photo and try again."` |
| Unreadable / unsupported image | `"That image could not be read. Choose a JPEG, PNG, or WebP photo."` |
| Search image too large for the URL | `"The search image is too large to send in the request URL…"` |
| Storage failure | `"The face indexing storage is temporarily unavailable. Please try again."` |
| Search timed out / host unreachable | `"The face indexing server at … did not respond within 120000ms."` |

The modal shows the same message on its error screen with a **Try Again** button
that returns to the home page.

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

Both component prop types are exported, and every `@authenta/core` type is
re-exported so a single import is enough:

```ts
import type {
  // Component props
  AuthentaCaptureProps,
  AuthentaFaceIndexProps,

  // Detection — from @authenta/core
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

  // Face indexing — from @authenta/core
  FaceIndexClientConfig,
  LocalFaceImage,
  EnrollmentResult,
  TenantFace,
  SearchResponse,
  SearchMatch,
  FaceStatus,
} from '@authenta/react-native';
```

The clients themselves come from the same place:

```ts
import { AuthentaClient, FaceIndexClient } from '@authenta/react-native';
```

---

## License

MIT © Authenta

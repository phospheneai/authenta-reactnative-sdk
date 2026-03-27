# @authenta/react-native

React Native camera capture UI for the [Authenta](https://authenta.ai) eKYC platform. Wraps [`@authenta/core`](https://www.npmjs.com/package/@authenta/core) in a self-contained modal — your app only passes which checks to enable and receives the result.

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
  - [Full Example](#full-example)
- [Using AuthentaClient Directly](#using-authentaclient-directly)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)
- [Contributing](#contributing)

---

## Requirements

| Dependency | Version |
|---|---|
| React Native | >= 0.72 |
| React | >= 18 |
| react-native-vision-camera | >= 4 |
| react-native-image-picker | >= 7 |

---

## Installation

```bash
npm install @authenta/react-native
```

Install the required peer dependencies:

```bash
npm install react-native-vision-camera react-native-image-picker
```

> These are peer dependencies — they must be installed in **your app**, not the SDK. After installing any package that contains native code you must rebuild the app.

---

## Android Setup

### 1. Permissions

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

### 2. Info.plist permissions

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
import { Button, View } from 'react-native';
import { AuthentaClient, AuthentaCapture } from '@authenta/react-native';
import type { ProcessedMedia } from '@authenta/react-native';

// Create the client once — outside your component or in a context/singleton
const client = new AuthentaClient({
  clientId:     'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

export default function App() {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Button title="Start Verification" onPress={() => setVisible(true)} />

      <AuthentaCapture
        client={client}
        visible={visible}
        onClose={() => setVisible(false)}
        onResult={(result: ProcessedMedia) => {
          setVisible(false);
          console.log(result.result?.isLiveness);
        }}
        onError={(err) => {
          setVisible(false);
          console.error(err.message);
        }}
        livenessCheck={true}
      />
    </View>
  );
}
```

---

## AuthentaCapture

`AuthentaCapture` is a self-contained modal that handles the entire eKYC capture flow:

1. **Toggles** — user enables which checks to run (or you pre-set them via props)
2. **Reference image** — user picks a face photo from their library (only when `faceSimilarityCheck` is on)
3. **Camera** — live camera view with capture / record button and front/back flip
4. **Processing** — upload → polling → result fetch, all handled internally
5. **Result / Error** — shows the outcome; user gets up to 3 retry attempts

```tsx
<AuthentaCapture
  client={client}
  visible={visible}
  onClose={() => setVisible(false)}
  onResult={(result) => console.log(result)}
  onError={(err) => console.error(err)}
  livenessCheck={true}
  faceswapCheck={false}
  faceSimilarityCheck={false}
  modelType="FI-1"
/>
```

### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | `AuthentaClient` | Yes | — | Initialized client instance from `@authenta/core` |
| `visible` | `boolean` | Yes | — | Controls modal open/close |
| `onClose` | `() => void` | Yes | — | Called when the user dismisses the modal |
| `onResult` | `(result: ProcessedMedia) => void` | Yes | — | Called with the detection result on success |
| `onError` | `(error: Error \| AuthentaError) => void` | No | — | Called on capture or API errors |
| `modelType` | `ModelType` | No | `'FI-1'` | Model to run against |
| `livenessCheck` | `boolean` | No | `false` | Pre-enable the liveness check toggle |
| `faceswapCheck` | `boolean` | No | `false` | Pre-enable the faceswap check toggle |
| `faceSimilarityCheck` | `boolean` | No | `false` | Pre-enable the face similarity check toggle |

### Check Modes & Capture Rules

The active checks determine which capture mode is presented to the user. The SDK enforces these rules automatically — no extra validation needed in your app.

| Checks enabled | Capture presented | Notes |
|---|---|---|
| `livenessCheck` only | Photo **and** video — user chooses | Both buttons shown side by side |
| `faceswapCheck` only | Video only (max 10 s) | |
| `faceSimilarityCheck` only | Photo only | Reference image required |
| `faceswapCheck` + `livenessCheck` | Video only | faceswap takes priority |
| `livenessCheck` + `faceSimilarityCheck` | Photo only | similarity takes priority |
| `faceswapCheck` + `faceSimilarityCheck` | — | **Not allowed** — SDK shows an error |

The user can also flip between front and back camera at any time during capture (except while recording).

### Result Object

`onResult` receives a `ProcessedMedia` object:

```ts
{
  mid:         string;       // unique media ID
  name:        string;
  status:      'PROCESSED';
  modelType:   string;       // e.g. "FI-1"
  contentType: string;       // MIME type of the uploaded file
  size:        number;       // bytes
  createdAt:   string;       // ISO 8601
  srcURL?:     string;
  resultURL?:  string;
  result?: {
    resultType:       string;
    isLiveness?:      boolean | string;   // liveness result
    isDeepFake?:      boolean | string;   // faceswap / deepfake result
    isSimilar?:       boolean | string;   // face similarity result
    similarityScore?: number  | string;   // 0–100
    [key: string]:    any;
  };
}
```

### Full Example

See the [AuthentaDemo](../../AuthentaDemo/) app for a complete runnable integration:
- Toggle switches for each check
- Start button and result display
- Error display with retry

---

## Using AuthentaClient Directly

`@authenta/react-native` re-exports the full `AuthentaClient` API from `@authenta/core`. Use it headless if you want your own camera UI.

```ts
import { AuthentaClient } from '@authenta/react-native';

const client = new AuthentaClient({
  clientId:     'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

// High-level: upload + poll + result in one call
const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
  livenessCheck: true,
});

// Low-level
const media     = await client.upload(uri, 'FI-1', { livenessCheck: true });
const processed = await client.waitForMedia(media.mid);
const result    = await client.getResult(processed);

// CRUD
const record = await client.getMedia(mid);
const list   = await client.listMedia({ page: 1, pageSize: 20 });
await client.deleteMedia(mid);
```

See the [`@authenta/core` README](https://www.npmjs.com/package/@authenta/core) for the full `AuthentaClient` API reference and all `RunOptions`.

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

// In onError prop or try/catch around faceIntelligence()
if (err instanceof AuthenticationError) {
  // Invalid clientId / clientSecret
} else if (err instanceof AuthorizationError) {
  // Account lacks permission
} else if (err instanceof QuotaExceededError) {
  // Monthly quota exceeded
} else if (err instanceof InsufficientCreditsError) {
  // No remaining credits
} else if (err instanceof ValidationError) {
  // Bad input — see err.message
} else if (err instanceof ServerError) {
  // Platform error — safe to retry
} else if (err instanceof AuthentaError) {
  // Base class — all SDK errors extend this
  console.error(err.message, err.code, err.statusCode, err.details);
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

All types from both packages are re-exported from `@authenta/react-native`:

```ts
import type {
  // Component
  AuthentaCaptureProps,

  // Client config
  AuthentaClientConfig,

  // Options
  RunOptions,
  FIOptions,
  PollingOptions,

  // API responses
  ProcessedMedia,
  MediaRecord,
  CreateMediaResponse,
  ListMediaResponse,
  DetectionResult,

  // Supporting types
  ModelType,
  MediaStatus,
  FileInfo,
} from '@authenta/react-native';
```

---

## Contributing

### Setup

```bash
git clone https://github.com/phospheneai/authenta-reactnative-sdk.git
cd authenta-reactnative-sdk
npm install
```

### Build

Build core first (react-native depends on it), then react-native:

```bash
npm run build
```

Or individually:

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/react-native
```

### Test

```bash
npm test --workspace=packages/react-native
```

### Guidelines

- **Peer dependencies only** — `react`, `react-native`, `react-native-vision-camera`, and `react-native-image-picker` must remain as `peerDependencies`. Never move them to `dependencies`.
- **No Node.js built-ins** — Metro cannot resolve `fs`, `path`, `crypto`, etc. File reads use `XMLHttpRequest`.
- **Core owns all API logic** — do not duplicate `AuthentaClient` logic in this package. `AuthentaCapture` calls `client.faceIntelligence()` and nothing else.
- **Capture mode rules live in one place** — the `resolveCaptureMode` function in `AuthentaCapture.tsx` is the single source of truth.
- **Typed errors** — import error classes from `@authenta/core` and re-export them via `index.ts`.

### Publish

Publish `@authenta/core` before publishing this package (this package depends on it):

```bash
# Bump versions in both package.json files, then:
npm publish --workspace=packages/core --access public
npm publish --workspace=packages/react-native --access public
```

---

## License

MIT © Authenta

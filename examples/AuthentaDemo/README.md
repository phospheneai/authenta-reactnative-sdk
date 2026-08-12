# Authenta Demo App

A minimal React Native app showing the whole SDK: **one client, one component, four toggles.**

The entire integration lives in a **single file** — [App.tsx](./App.tsx).

---

## What it shows

```tsx
import { AuthentaClient } from '@authenta/core';
import { AuthentaCapture } from '@authenta/react-native';

const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  api_key: 'YOUR_API_KEY',
  auth_enabled: true,
});

<AuthentaCapture
  client={client}
  visible={open}
  onClose={() => setOpen(false)}

  livenessCheck={liveness}
  faceswapCheck={faceswap}
  faceSimilarityCheck={similarity}
  faceIndexing={indexing}

  onResult={(res) => …}        // detection finished
  onEnrolled={(res) => …}      // faces uploaded for indexing
  onSearchResult={(res) => …}  // face search matches
  onError={(err) => …}
/>
```

The toggles decide what happens:

| Toggle | What the SDK does |
|---|---|
| `livenessCheck` | Opens the camera for a photo **and** video, uploads, polls, returns the verdict |
| `faceswapCheck` | Video only, max 10 s |
| `faceSimilarityCheck` | Photo only — pass `referenceImage` to compare against |
| `faceIndexing` | Switches to enrol/search: add a person's photos, or match a face |

The app calls **nothing** related to camera, compression, upload, or polling.

---

## The two features are mutually exclusive

Face indexing runs no detection model, so the demo treats them as modes.
Turning on **Image Indexing**:

- clears all three detection checks,
- disables their switches,
- and the SDK itself raises a `ValidationError` if both are ever requested together.

---

## Prerequisites

- Node.js >= 18
- React Native environment set up ([guide](https://reactnative.dev/docs/set-up-your-environment))
- Android Studio (for Android) or Xcode (for iOS)
- A physical device or emulator/simulator — Android API 24+, iOS 13+

---

## Setup

```bash
npm install
cd ios && pod install && cd ..     # iOS only
```

Set your API key at the top of [App.tsx](./App.tsx). Both features use the same
client, so there is nothing else to configure.

### Android permissions

In `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

No microphone permission is needed — detection records video without audio.

### iOS permissions

In `ios/AuthentaDemo/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture during identity verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select images for face indexing.</string>
```

---

## Run

```bash
npx react-native run-android
npx react-native run-ios

# Clear Metro cache if you hit a stale bundle
npx react-native start --reset-cache
```

> After installing any package with native code, do a full rebuild — not just a Metro reload.

---

## Result objects

**`onResult`** — `ProcessedMedia`

```ts
{
  id: string;            // job ID
  status: string;        // "completed"
  taskTypeId: string;    // e.g. "8" for FI-1
  result: {
    isSpoof?:         boolean | string;  // liveness
    isDeepFake?:      boolean | string;  // faceswap
    isSimilar?:       boolean | string;  // similarity
    similarityScore?: number  | string;
  } | null;
}
```

**`onEnrolled`** — `EnrollResponse`. Photos are uploaded; embeddings are
generated in the background, so poll `client.tenants()` to watch each face
reach `processed`.

```ts
{
  subject_id: string;
  status: string;
  faces: Array<{ face_id: string; status: string }>;
}
```

**`onSearchResult`** — `SearchResponse`, strongest match first. The same
subject can appear more than once, since every enrolled face has its own
embedding.

```ts
{
  count: number;
  results: Array<{
    rank: number;
    subject_id: string;
    face_id: string;
    name: string;
    image_url: string;
    similarity_score: number;   // 0–1
  }>;
}
```

---

## Testing local SDK changes

This app installs `@authenta/core` and `@authenta/react-native` from npm. To run
it against your working copy, build both and copy their `dist/` into
`node_modules/@authenta/*` — see
[CONTRIBUTING.md](../../CONTRIBUTING.md#testing-local-changes). Restart Metro
with `--reset-cache` afterwards, or the old bundle keeps running.

---

## SDK documentation

- React Native SDK → [`@authenta/react-native` README](../../packages/react-native/README.md)
- Core API client → [`@authenta/core` README](../../packages/core/README.md)
- Monorepo overview → [Root README](../../README.md)

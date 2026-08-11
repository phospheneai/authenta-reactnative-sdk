# Authenta Demo App

A minimal React Native app that demonstrates both features of the Authenta React Native SDK.

The entire integration lives in a **single file** — [App.tsx](./App.tsx). This is the only file a client developer needs to write when using the SDK.

---

## What it shows

**A. Detection** — Authenta platform

- Create an `AuthentaClient` with your domain and API key
- Three toggles — Liveness, Faceswap, Face Similarity
- Tap **Start Detection** → the SDK opens the camera, captures a photo or video
  (whichever the checks require), compresses, uploads, polls, and returns the result

**B. Face indexing** — your FaceSim server

- Create a `FaceIndexClient` with your host and tenant UUID
- One toggle — Image Indexing
- Tap **Start Face Indexing** → the SDK uploads up to 3 photos, waits for the
  embeddings, and lets you search a face from the camera or library

The app calls **nothing** related to camera, compression, upload, S3, or polling. All of that is inside the SDK.

---

## The two are mutually exclusive

Face indexing runs no detection model, so the demo treats them as modes rather
than options that combine. Turning **Image Indexing** on:

- clears all three detection checks,
- disables their switches so they cannot be re-enabled,
- and changes the Start button to open `AuthentaFaceIndex` instead of `AuthentaCapture`.

This matters: `AuthentaCapture` opened with zero checks enabled immediately
reports a `ValidationError`, so the two must never be requested together.

---

## Prerequisites

- Node.js >= 18
- React Native environment set up ([guide](https://reactnative.dev/docs/set-up-your-environment))
- Android Studio (for Android) or Xcode (for iOS)
- A physical device or emulator/simulator
- Android: API 24+
- iOS: 13+
- For face indexing: a reachable FaceSim server and a valid tenant UUID

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. iOS only — install pods
cd ios && pod install && cd ..
```

### Configure the clients

Both live at the top of [App.tsx](./App.tsx):

```tsx
const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});

const FACE_INDEX_BASE_URL  = 'http://192.168.1.10:8000';
const FACE_INDEX_TENANT_ID = '6c60ef62-c848-40e3-9cb4-9472ff7b8b58';
```

> `127.0.0.1` on a device means the phone itself — use your machine's LAN IP (or
> the server's public address). If the tenant ID is not a valid UUID the app
> shows a "Face indexing not configured" card instead of crashing.

### Android permissions

In `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

A FaceSim server on plain `http://` also needs cleartext traffic allowed, on the
`<application>` tag:

```xml
<application android:usesCleartextTraffic="true" ... >
```

### iOS permissions

In `ios/AuthentaDemo/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture during identity verification.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is required for video recording during face verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select reference and enrollment images.</string>
```

For an `http://` FaceSim host, add an App Transport Security exception:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>192.168.1.10</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

---

## Run

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios

# Clear Metro cache if you hit stale bundle issues
npx react-native start --reset-cache
```

> After installing any new package with native code, always do a full rebuild — not just a Metro reload.

---

## How it works

The full app code is in [App.tsx](./App.tsx).

### Detection — 3 steps

**1. Create the client**

```tsx
import { AuthentaClient } from '@authenta/core';

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});
```

**2. Track which checks to run**

```tsx
const [checks, setChecks] = useState({
  liveness: false, faceswap: false, similarity: false,
});
```

**3. Render AuthentaCapture**

```tsx
import { AuthentaCapture } from '@authenta/react-native';

<AuthentaCapture
  client={client}
  modelType="FI-1"
  visible={openModal === 'capture'}
  livenessCheck={checks.liveness}
  faceswapCheck={checks.faceswap}
  faceSimilarityCheck={checks.similarity}
  onClose={() => setOpenModal(null)}
  onResult={(res) => {
    setOpenModal(null);
    console.log(res.result?.isSpoof);       // liveness
    console.log(res.result?.isDeepFake);    // faceswap
    console.log(res.result?.isSimilar);     // similarity
  }}
  onError={(err) => {
    setOpenModal(null);
    console.error(err.message);
  }}
/>
```

The SDK handles camera permission, VisionCamera, capture/record, the reference
image picker, compression, upload, S3, polling, retry (up to 3 attempts), and
error UI.

### Face indexing — 2 steps

**1. Create the client**

```tsx
import { FaceIndexClient } from '@authenta/core';

// The constructor validates the tenant UUID — keep a bad config visible
// instead of crashing at startup.
const faceClient = useMemo(() => {
  try {
    return new FaceIndexClient({
      baseUrl:  FACE_INDEX_BASE_URL,
      tenantId: FACE_INDEX_TENANT_ID,
    });
  } catch {
    return null;
  }
}, []);
```

**2. Render AuthentaFaceIndex**

```tsx
import { AuthentaFaceIndex } from '@authenta/react-native';

<AuthentaFaceIndex
  client={faceClient}
  visible={openModal === 'index'}
  maxImages={3}
  onClose={() => setOpenModal(null)}
  // The modal stays open so the user can keep enrolling or searching —
  // these just mirror the data into this screen.
  onEnrolled={(res) => setEnrollment(res)}
  onSearchResult={(res) => setMatches(res)}
  onError={(err) => setError(err.message)}
/>
```

Inside the modal, **Index Photos** and **Search a Face** are both available on
the first page — searching does not require enrolling first, since it matches
against every face already indexed for the tenant.

---

## Result objects

### Detection — `onResult` receives a `ProcessedMedia`

```ts
{
  id:         string;   // job ID
  status:     string;   // "completed"
  taskTypeId: string;   // e.g. "8" for FI-1
  result: {
    isSpoof?:         boolean | string;  // liveness check
    isDeepFake?:      boolean | string;  // faceswap check
    isSimilar?:       boolean | string;  // similarity check
    similarityScore?: number  | string;  // similarity confidence
  } | null;
}
```

### Face indexing — `onEnrolled` receives an `EnrollmentResult`

```ts
{
  subject_id:     string;
  processedCount: number;   // faces that are now searchable
  failedCount:    number;   // faces the server could not read
  faces: Array<{
    face_id:   string;
    name:      string;
    status:    'processed' | 'failed' | 'pending' | 'uploaded' | 'processing';
    image_url: string;        // presigned, expires in ~5 min
    error:     string | null; // why this photo failed
  }>;
}
```

### Face indexing — `onSearchResult` receives a `SearchResponse`

```ts
{
  tenant_id: string;
  count:     number;
  results: Array<{
    rank:             number;  // 1 = strongest match
    subject_id:       string;
    face_id:          string;
    name:             string;
    image_url:        string;
    similarity_score: number;  // 0–1
  }>;
}
```

The same subject can appear more than once — every enrolled face has its own embedding.

---

## Testing local SDK changes

This app installs `@authenta/core` and `@authenta/react-native` from npm. To run
it against your local edits, build both packages and point the demo at them —
see [CONTRIBUTING.md](../../CONTRIBUTING.md#testing-local-changes).

---

## SDK documentation

- React Native SDK → [`@authenta/react-native` README](../../packages/react-native/README.md)
- Core API clients → [`@authenta/core` README](../../packages/core/README.md)
- Monorepo overview → [Root README](../../README.md)

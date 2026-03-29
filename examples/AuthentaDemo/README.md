# Authenta Demo App

A minimal React Native app that demonstrates how to integrate the [Authenta React Native SDK].

The entire integration lives in a **single file** — [App.tsx](./App.tsx). This is the only file a client developer needs to write when using the SDK.

---

## What it shows

- Create an `AuthentaClient` with your credentials
- Three toggle switches — Liveness, Faceswap, Face Similarity
- Tap **Start Detection** → the SDK opens the camera, captures, uploads, polls, and returns the result
- Result and errors are displayed on screen

The app calls **nothing** related to camera, upload, S3, or polling. All of that is inside the SDK.

---

## Prerequisites

- Node.js >= 18
- React Native environment set up ([guide](https://reactnative.dev/docs/set-up-your-environment))
- Android Studio (for Android) or Xcode (for iOS)
- A physical device or emulator/simulator
- Android | API 24+ |
- iOS | 13+ |

---



## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install peer dependencies (if not already installed)
npm install react-native-vision-camera react-native-image-picker

# 3. iOS only — install pods
cd ios && pod install && cd ..
```

### Android permissions

In `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### iOS permissions

In `ios/AuthentaDemo/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Camera is required for face capture.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone is required for video recording.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Photo library access is required to select a reference image.</string>
```

---

## Run

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

> After installing any new package with native code, always do a full rebuild — not just a Metro reload.

---

## How it works

The full app code is in [App.tsx](./App.tsx). The integration is 3 steps:

### Step 1 — Create the client

```tsx
const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});
```

### Step 2 — Track which checks to run

```tsx
const [livenessCheck, setLivenessCheck]             = useState(false);
const [faceswapCheck, setFaceswapCheck]             = useState(false);
const [faceSimilarityCheck, setFaceSimilarityCheck] = useState(false);
```

### Step 3 — Render AuthentaCapture

```tsx
<AuthentaCapture
  client={client}
  modelType="FI-1"
  visible={captureOpen}
  onClose={() => setCaptureOpen(false)}
  livenessCheck={livenessCheck}
  faceswapCheck={faceswapCheck}
  faceSimilarityCheck={faceSimilarityCheck}
  onResult={(res) => {
    setCaptureOpen(false);
    console.log(res); // ProcessedMedia — display what you need
  }}
  onError={(err) => {
    setCaptureOpen(false);
    console.error(err.message);
  }}
/>
```

That's it. The SDK handles camera permission, VisionCamera, capture/record, reference image picker, upload, S3, polling, retry (3 attempts), and error UI.

---

## Result Object

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

---

## SDK documentation

Full SDK reference → [authenta-reactnative-sdk/README.md](../../README.md)

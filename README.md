# Authenta SDK — Monorepo

This repository contains the Authenta SDK published as two independent npm packages.

| Package | npm | Description |
|---|---|---|
| [`@authenta/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@authenta/core)](https://www.npmjs.com/package/@authenta/core) | Pure TypeScript API clients — works in Node.js and React Native |
| [`@authenta/react-native`](./packages/react-native) | [![npm](https://img.shields.io/npm/v/@authenta/react-native)](https://www.npmjs.com/package/@authenta/react-native) | React Native modals powered by `@authenta/core` |

---

## Two features, two services

The SDK covers two capabilities that talk to **different servers** and share no
state. Pick either, or use both side by side.

| | Detection | Face indexing |
|---|---|---|
| **What it does** | Liveness, faceswap, and face-similarity checks on a captured photo or video | Enrol photos of a person, then search a face against everything enrolled |
| **Server** | Authenta platform (`https://platform.authenta.ai`) | Your FaceSim host |
| **Auth** | API key (Bearer token) | None — scoped by tenant UUID |
| **Core client** | `AuthentaClient` | `FaceIndexClient` |
| **RN component** | `AuthentaCapture` | `AuthentaFaceIndex` |

> The two are mutually exclusive per session: a face-indexing run executes no
> detection model. Host apps should present them as separate modes — see the
> [demo app](./examples/AuthentaDemo/).

---

## Which package should I use?

| Scenario | Package |
|---|---|
| React Native app — want a ready-made camera / indexing UI | `@authenta/react-native` |
| React Native app — have your own UI | `@authenta/core` |
| Node.js backend / script | `@authenta/core` |

---

## API overview

### Detection — client setup

```ts
import { AuthentaClient } from '@authenta/core'; // or '@authenta/react-native'

const client = new AuthentaClient({
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
  baseUrl:      'https://platform.authenta.ai', // optional
});
```

#### High-level

| Method | Description |
|---|---|
| `uploadAndPoll(uri, model, options?)` | Upload → finalize → poll → result in one call. Returns `ProcessedMedia` (or `CreateMediaResponse` when `autoPolling: false`) |
| `verify_liveness(uri)` | FI-1 liveness — returns `DetectionResult` with `isSpoof` |
| `verify_deepfake(uri)` | FI-1 faceswap — video only, returns `DetectionResult` with `isDeepFake` |
| `verify_similarity(uri, referenceUri)` | FI-1 face similarity — returns `DetectionResult` with `isSimilar` + `similarityScore` |
| `verify_face_embeddings(uri)` | FE-1 face vector — returns `DetectionResult` with `faceVector` |

#### Low-level (step by step)

| Method | Description |
|---|---|
| `upload(uri, model, options?)` | Create a job, resolve file info, upload to S3. Returns `CreateMediaResponse` |
| `finalizeMedia(jobId)` | Signal the server that all files are uploaded — job moves to "queued" |
| `pollResult(jobId, options?)` | Poll `GET /jobs/{id}` until terminal status. Returns `ProcessedMedia` |
| `getResult(media)` | Download the result JSON from the S3 artifact. Returns `DetectionResult` |

#### CRUD

| Method | Description |
|---|---|
| `createMedia(params)` | Create a raw job record. Returns `CreateMediaResponse` |
| `getMedia(jobId)` | Fetch a single job. Returns `ProcessedMedia` |
| `listMedia(params?)` | List jobs with pagination. Returns `ListMediaResponse` |
| `deleteMedia(jobId)` | Delete a job |
| `get_task_id(modelType)` | Resolve model type string to task type ID |

---

### Face indexing — client setup

```ts
import { FaceIndexClient } from '@authenta/core'; // or '@authenta/react-native'

const faces = new FaceIndexClient({
  baseUrl:  'http://your-facesim-host:8000',
  tenantId: '6c60ef62-c848-40e3-9cb4-9472ff7b8b58', // must be a UUID
});
```

| Method | Description |
|---|---|
| `enrollAndWait(images, polling?)` | Enrol → upload to S3 → poll until every embedding settles. Returns `EnrollmentResult` |
| `enrollImages(images)` | Create the subject and PUT each photo to its presigned URL |
| `enroll(images)` | Create the subject and return presigned URLs only (no upload) |
| `waitForEnrollment(subjectId, polling?)` | Poll until every face is `processed` or `failed` |
| `search(base64, options?)` | Rank enrolled faces against a Base64 query image |
| `searchByUri(uri, options?)` | Read a local image, then search with it |
| `getTenant()` | Every subject and face for the tenant |
| `getSubjectFaces(subjectId)` | Faces for one subject |
| `isReady()` | `true` when the server and its database respond |

---

### `@authenta/react-native` — components

```tsx
import { AuthentaCapture, AuthentaFaceIndex } from '@authenta/react-native';

// Detection — your app picks the checks, the modal captures and returns a result
<AuthentaCapture
  client={client}
  modelType="FI-1"
  visible={captureOpen}
  livenessCheck={true}
  faceswapCheck={false}
  faceSimilarityCheck={false}
  onClose={() => setCaptureOpen(false)}
  onResult={(media) => console.log(media.result?.isSpoof)}
  onError={(err) => console.error(err.message)}
/>

// Face indexing — enrol photos and search a face
<AuthentaFaceIndex
  client={faces}
  visible={indexOpen}
  maxImages={3}
  onClose={() => setIndexOpen(false)}
  onEnrolled={(res) => console.log(res.subject_id, res.processedCount)}
  onSearchResult={(res) => console.log(res.results)}
  onError={(err) => console.error(err.message)}
/>
```

`AuthentaCapture` handles camera permission, VisionCamera, photo/video capture,
the reference image picker, compression, S3 upload, polling, result display, and
up to 3 retry attempts. `AuthentaFaceIndex` handles the library picker, HEIC
conversion, upload, embedding polling, and search — including capturing the
query photo with the camera.

**Peer dependencies required:**

```bash
npm install react-native-vision-camera react-native-image-picker \
  react-native-blob-util react-native-compressor \
  react-native-nitro-modules react-native-nitro-image
```

---

## Flow diagrams

```
Detection — uploadAndPoll()
───────────────────────────
1. upload()
   ├── resolveUri()        read file from device
   ├── createMedia()       POST /api/v1/jobs  →  job.id + signed S3 URLs
   └── uploadToS3()        PUT file(s) to signed URL(s)

2. finalizeMedia()         POST /api/v1/jobs/{id}/finalize  →  status: "queued"

3. pollResult()            GET /api/v1/jobs/{id}  (repeat until "completed")

4. getResult()             GET signed S3 artifact URL  →  DetectionResult JSON
```

```
Face indexing — enrollAndWait()
───────────────────────────────
1. enroll()                POST /v1/enroll  →  subject_id + one presigned URL per image

2. PUT each image          direct to S3        (a Lambda then acks the API)

3. waitForEnrollment()     GET /v1/tenant   (repeat until every face is
                                             "processed" or "failed")

Face indexing — search()
────────────────────────
   POST /v1/search?limit=…
   JSON { tenant_id, image_bytes: <base64url> }
   →  matches ranked by similarity_score
```

---

## Repository structure

```
authenta-reactnative-sdk/
├── packages/
│   ├── core/                          @authenta/core
│   │   ├── src/
│   │   │   ├── client.ts              AuthentaClient — detection
│   │   │   ├── errors.ts              Typed error classes
│   │   │   ├── types/index.ts         Detection TypeScript interfaces
│   │   │   ├── utils/helpers.ts       MIME type helpers
│   │   │   ├── internal/
│   │   │   │   └── fileSource.ts      Local file reads + presigned uploads
│   │   │   │                          (shared by both clients)
│   │   │   ├── faceIndex/             FaceSim service — separate from detection
│   │   │   │   ├── client.ts          FaceIndexClient
│   │   │   │   ├── errors.ts          FaceIndexError + code mapping
│   │   │   │   └── types.ts           Enrollment and search interfaces
│   │   │   └── index.ts               Public API surface
│   │   └── __tests__/                 Integration tests (run against live API)
│   │
│   └── react-native/                  @authenta/react-native
│       ├── src/
│       │   ├── AuthentaCapture.tsx    Detection modal
│       │   ├── AuthentaFaceIndex.tsx  Face indexing modal
│       │   ├── CameraScreen.tsx       Shared camera — capture and record
│       │   ├── ui.tsx                 Shared primitives + useModalFlow
│       │   ├── theme.ts               Limits, colours, stylesheet
│       │   ├── media.ts               Capture mode + image/video compression
│       │   ├── types.ts               Props and flow types
│       │   └── index.ts               Re-exports core + both components
│       └── __mocks__/                 Jest mocks for native modules
│
├── examples/
│   ├── core/                          Runnable ts-node examples
│   │   ├── 01-liveness-check.ts
│   │   ├── 02-faceswap-check.ts
│   │   ├── 03-face-similarity-check.ts
│   │   └── 04-face-embeddings.ts
│   └── AuthentaDemo/                  Full React Native demo app
│       └── App.tsx
├── CONTRIBUTING.md
└── README.md
```

---

## Building

There is no root `package.json` — each package is built independently. Always
build `@authenta/core` first, because `@authenta/react-native` compiles against
core's `dist/`.

```bash
cd packages/core && npm install && npm run build
cd ../react-native && npm install && npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for testing local changes across
packages.

---

## Running the integration tests

The detection tests hit the real Authenta API. Edit
`packages/core/__tests__/setup.ts` to set your API key and local file paths,
then:

```bash
cd packages/core

npx jest                                      # all tests
npx jest --testPathPattern=fi1-liveness       # one scenario
npx jest --testPathPattern=fi1-faceswap
npx jest --testPathPattern=fi1-similarity
npx jest --testPathPattern=fi1-full
npx jest --testPathPattern=df1
npx jest --testPathPattern=ac1
npx jest --testPathPattern=verify-helpers
npx jest --testPathPattern=media-crud
```

---

## Running the core examples

```bash
cd examples/core
npx ts-node 01-liveness-check.ts
npx ts-node 02-faceswap-check.ts
npx ts-node 03-face-similarity-check.ts
npx ts-node 04-face-embeddings.ts
```

---

## Demo app

See [examples/AuthentaDemo/](./examples/AuthentaDemo/) for a runnable React
Native app covering both detection and face indexing.

<p align="center">
  <img src="examples/mobile-app-demo.gif" alt="Authenta Demo" width="200" height="400" />
</p>

---

## License

MIT © Authenta

# Authenta SDK — Monorepo

This repository contains the Authenta SDK published as two independent npm packages.

| Package | npm | Description |
|---|---|---|
| [`@authenta/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@authenta/core)](https://www.npmjs.com/package/@authenta/core) | TypeScript API client — React Native (see the note below) |
| [`@authenta/react-native`](./packages/react-native) | [![npm](https://img.shields.io/npm/v/@authenta/react-native)](https://www.npmjs.com/package/@authenta/react-native) | React Native capture modal powered by `@authenta/core` |

---

## Two features, one client

Both run on the same host and API key.

| | Detection | Face indexing |
|---|---|---|
| **What it does** | Liveness, faceswap, and similarity checks on a captured photo or video | Index a person's photos, then match a face against them |
| **Core methods** | `uploadAndPoll()` | `faceEnrol()` · `faceSearch()` · `tenants()` |
| **RN toggles** | `livenessCheck` · `faceswapCheck` · `faceSimilarityCheck` | `faceIndexing` |

> The two are mutually exclusive: a face-indexing session runs no detection
> model. Requesting both raises a `ValidationError`.

---

## Which package should I use?

| Scenario | Package |
|---|---|
| React Native app — want ready-made UI | `@authenta/react-native` |
| React Native app — have your own UI | `@authenta/core` |

> **Node.js is currently broken.** `faceSearch()` converts images with
> `@bam.tech/react-native-image-resizer`, imported at the top of
> `internal/fileSource.ts`. That drags in `react-native`, so `require('@authenta/core')`
> throws under Node — which also takes out `examples/core/` and the integration
> tests. Making that import lazy would restore it.

---

## API overview

### Client setup

```ts
import { AuthentaClient } from '@authenta/core'; // or '@authenta/react-native'

const client = new AuthentaClient({
  baseUrl:      'https://platform.authenta.ai',
  api_key:      'YOUR_API_KEY',
  auth_enabled: true,
});
```

### Methods

| Method | Endpoint | Description |
|---|---|---|
| `uploadAndPoll(uri, model, options?)` | `/api/v1/jobs` | Upload → finalize → poll → result. Returns `ProcessedMedia`, or `CreateMediaResponse` when `autoPolling: false` |
| `faceEnrol(images)` | `POST /api/v1/facesim/v1/enroll` | Create a subject and upload each photo. Returns `EnrollResponse` |
| `faceSearch(image, options?)` | `POST /api/v1/facesim/v1/search` | Rank enrolled faces against a photo. Returns `SearchResponse` |
| `tenants()` | `GET /api/v1/facesim/v1/subjects` | Every subject and face on the account |

```ts
// Detection
const media = await client.uploadAndPoll('file:///selfie.jpg', 'FI-1', { livenessCheck: true });
console.log(media.result?.isSpoof);

// Face indexing
const subject = await client.faceEnrol([{ uri: 'file:///front.jpg' }]);
const matches = await client.faceSearch('file:///query.jpg', { limit: 10 });
```

`faceSearch()` takes a local file URI. The image is converted to JPEG and posted
as `multipart/form-data`, which keeps it clear of the JSON body-size limit.

---

### `@authenta/react-native` — one component

```tsx
import { AuthentaCapture, AuthentaClient } from '@authenta/react-native';

<AuthentaCapture
  client={client}
  visible={open}
  onClose={() => setOpen(false)}

  livenessCheck={liveness}
  faceswapCheck={faceswap}
  faceSimilarityCheck={similarity}
  faceIndexing={indexing}

  onResult={(media) => console.log(media.result?.isSpoof)}
  onEnrolled={(res) => console.log(res.subject_id)}
  onSearchResult={(res) => console.log(res.results)}
  onError={(err) => console.error(err.message)}
/>
```

The toggles decide everything. Detection opens the camera in photo, video, or
both modes and returns the verdict; `faceIndexing` switches to enrol/search with
photos from the camera or library. The SDK handles permissions, capture,
compression, upload, polling, and error UI.

**Peer dependencies:**

```bash
npm install react-native-vision-camera react-native-image-picker \
  react-native-blob-util react-native-compressor \
  react-native-nitro-modules react-native-nitro-image \
  @bam.tech/react-native-image-resizer
```

No microphone permission is required — video is recorded without audio.

---

## Flow diagrams

```
Detection — uploadAndPoll()
───────────────────────────
1. resolve the file, create the job    POST /api/v1/jobs        → job.id + signed S3 URLs
2. PUT the file(s) to S3
3. finalize                            POST /api/v1/jobs/{id}/finalize
4. poll until terminal                 GET  /api/v1/jobs/{id}
5. fetch the result artifact           GET  signed S3 URL       → DetectionResult
```

```
Face indexing
─────────────
faceEnrol()    POST /api/v1/facesim/v1/enroll    → subject_id + one signed URL per image
               PUT each image to S3              (embeddings follow out of band)

tenants()      GET  /api/v1/facesim/v1/subjects  → every subject and face + status

faceSearch()   POST /api/v1/facesim/v1/search    → matches ranked by similarity_score
               multipart/form-data: image, limit
```

---

## Repository structure

```
authenta-reactnative-sdk/
├── packages/
│   ├── core/                            @authenta/core
│   │   ├── src/
│   │   │   ├── client.ts                AuthentaClient — the four public methods
│   │   │   ├── core/
│   │   │   │   ├── faceintelligence.ts  Detection: upload, poll, fetch result
│   │   │   │   └── faceauth.ts          Face indexing: enrol, search, tenants
│   │   │   ├── utils/
│   │   │   │   ├── common.ts            request, throwApiError, resolveUri
│   │   │   │   └── helpers.ts           MIME type helpers
│   │   │   ├── internal/fileSource.ts   Local file reads + presigned uploads
│   │   │   ├── types/index.ts           Detection types
│   │   │   ├── types/faceauth.ts        Face indexing types
│   │   │   ├── errors.ts                Typed error classes
│   │   │   └── index.ts                 Public API surface
│   │   └── __tests__/                   Integration tests (live API)
│   │
│   └── react-native/                    @authenta/react-native
│       ├── src/
│       │   ├── AuthentaCapture.tsx      The only export — routes on faceIndexing
│       │   ├── flows/detection.tsx      Camera → analyse → result
│       │   ├── flows/faceindex.tsx      Enrol / search, camera or library
│       │   ├── CameraScreen.tsx         Shared camera — capture and record
│       │   ├── ui.tsx                   Shared primitives + useModalFlow
│       │   ├── theme.ts                 Limits, colours, stylesheet
│       │   ├── media.ts                 Capture mode + compression
│       │   ├── types.ts                 Props and flow steps
│       │   └── index.ts
│       └── __mocks__/                   Jest mocks for native modules
│
├── examples/
│   ├── core/                            Runnable ts-node scripts
│   └── AuthentaDemo/                    React Native demo app
│       └── App.tsx
├── CONTRIBUTING.md
└── README.md
```

---

## Building

There is no root `package.json` — each package builds independently. Build
`@authenta/core` first, because `@authenta/react-native` compiles against its
`dist/`.

```bash
cd packages/core && npm install && npm run build
cd ../react-native && npm install && npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for testing local changes across
packages.

---

## Running the integration tests

> These do not run today — `@authenta/core` cannot be imported under Node.js
> (see above). The commands below apply once that import is made lazy.

The detection tests hit the real API. Set your key and sample file paths in
`packages/core/__tests__/setup.ts`, then:

```bash
cd packages/core
npx jest
npx jest --testPathPattern=fi1-liveness
```

---

## Demo app

See [examples/AuthentaDemo/](./examples/AuthentaDemo/) for a runnable React
Native app covering both features.

<p align="center">
  <img src="examples/mobile-app-demo.gif" alt="Authenta Demo" width="200" height="400" />
</p>

---

## License

MIT © Authenta

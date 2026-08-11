# Contributing to Authenta SDK

Thank you for your interest in contributing. This guide covers everything you need to get the repo running locally, understand the codebase, make changes, and publish new versions.

---

## Table of Contents

- [Repository Overview](#repository-overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Build](#build)
- [Testing Local Changes](#testing-local-changes)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [Package Guidelines](#package-guidelines)
  - [@authenta/core](#authentacore)
  - [@authenta/react-native](#authentareact-native)
- [Making Changes](#making-changes)
- [Capture Mode Rules](#capture-mode-rules)
- [Face Indexing Rules](#face-indexing-rules)
- [Error Handling Rules](#error-handling-rules)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Publishing to npm](#publishing-to-npm)

---

## Repository Overview

Two publishable packages, each with its own `package.json`, dependencies, and
build. There is **no root `package.json` and no npm workspaces** — install and
build each package separately.

| Package | Path | Description |
|---|---|---|
| `@authenta/core` | `packages/core/` | Pure TypeScript API clients — no React, no native modules |
| `@authenta/react-native` | `packages/react-native/` | React Native UI built on top of core |

Each package covers two independent services:

| Service | Core client | RN component | Auth |
|---|---|---|---|
| Authenta detection platform | `AuthentaClient` | `AuthentaCapture` | API key |
| FaceSim face indexing | `FaceIndexClient` | `AuthentaFaceIndex` | Tenant UUID only |

`examples/AuthentaDemo/` is a runnable React Native app that consumes the
**published** packages from npm. See [Testing Local Changes](#testing-local-changes)
to point it at your working copy.

---

## Prerequisites

- Node.js >= 18
- npm >= 8
- For running the demo app: React Native development environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- For face indexing work: a reachable FaceSim server (see its `API.md`)

---

## Setup

```bash
git clone https://github.com/phospheneai/authenta-reactnative-sdk.git
cd authenta-reactnative-sdk

cd packages/core && npm install
cd ../react-native && npm install
```

---

## Build

Always build `@authenta/core` before `@authenta/react-native` — the react-native
package compiles against core's `dist/`, not its `src/`.

```bash
cd packages/core && npm run build
cd ../react-native && npm run build
```

Compiled output goes to `packages/*/dist/`. These folders are git-ignored.

---

## Testing Local Changes

`packages/react-native/node_modules/@authenta/core` is an **installed copy** of
the published package, not a symlink. After changing core, refresh that copy or
the react-native build will compile against stale types:

```bash
cd packages/core && npm run build

rm -rf ../react-native/node_modules/@authenta/core/dist
cp -R dist ../react-native/node_modules/@authenta/core/dist

cd ../react-native && npm run build
```

To run the demo app against local packages, do the same for
`examples/AuthentaDemo/node_modules/@authenta/*`, then restart Metro with
`--reset-cache`. Metro does not follow symlinks reliably, so prefer copying
`dist/` over `npm link`.

Nothing here is committed — it all lives inside `node_modules/`.

---

## Tests

### Core — integration tests

`packages/core/__tests__/` holds integration tests that hit the **real** Authenta
API. Edit `__tests__/setup.ts` with your API key and local sample file paths
first, then:

```bash
cd packages/core

npx jest                                    # all
npx jest --testPathPattern=fi1-liveness     # one scenario
```

| File | Covers |
|---|---|
| `fi1-liveness.test.ts` | FI-1 liveness check |
| `fi1-faceswap.test.ts` | FI-1 faceswap check (video) |
| `fi1-similarity.test.ts` | FI-1 similarity check (photo + reference) |
| `fi1-full.test.ts` | Combined FI-1 checks |
| `df1.test.ts` | DF-1 deepfake detection |
| `ac1.test.ts` | AC-1 AI-image detection |
| `verify-helpers.test.ts` | `verify_*` convenience wrappers |
| `media-crud.test.ts` | createMedia / getMedia / listMedia / deleteMedia |

> These tests hit the live API, so they fail out of the box: `setup.ts` ships
> with `API_KEY = 'API_KEY_HERE'` and absolute sample-file paths. Set a real key
> and valid paths before reading anything into a failure.

### React Native

`packages/react-native/jest.config.js` points `roots` at a `__tests__/`
directory that does not exist yet, so `npm test` currently fails with:

```
Directory .../packages/react-native/__tests__ in the roots[0] option was not found.
```

Mocks for the native modules already live in `packages/react-native/__mocks__/`
(`react-native`, `react-native-vision-camera`, `react-native-image-picker`) —
create `__tests__/` alongside them when writing the first test.

### Type checking

The fastest correctness gate for either package:

```bash
npx tsc --noEmit                          # types
npx tsc --noEmit --noUnusedLocals         # also catches dead imports
```

---

## Project Structure

```
authenta-reactnative-sdk/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client.ts              # AuthentaClient — detection
│   │   │   ├── errors.ts              # Typed error classes
│   │   │   ├── types/index.ts         # Detection interfaces and types
│   │   │   ├── utils/helpers.ts       # getMimeType, isImage, isVideo, safeJsonParse
│   │   │   ├── internal/
│   │   │   │   └── fileSource.ts      # Local file reads + presigned S3 uploads.
│   │   │   │                          # Platform-sensitive — shared by both clients
│   │   │   ├── faceIndex/
│   │   │   │   ├── client.ts          # FaceIndexClient — enrol + search
│   │   │   │   ├── errors.ts          # FaceIndexError + friendly code mapping
│   │   │   │   ├── types.ts           # Enrollment/search interfaces + constants
│   │   │   │   └── index.ts           # Face indexing public surface
│   │   │   └── index.ts               # Public API surface (re-exports everything)
│   │   ├── __tests__/                 # Integration tests
│   │   ├── dist/                      # Compiled output — git-ignored
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── react-native/
│       ├── src/
│       │   ├── AuthentaCapture.tsx    # Detection modal + its screens
│       │   ├── AuthentaFaceIndex.tsx  # Face indexing modal + its screens
│       │   ├── CameraScreen.tsx       # Shared camera — photo capture + recording
│       │   ├── ui.tsx                 # Sheet, Page, Button, Row, ErrorView,
│       │   │                          # Badge, KeyValue, Spinner, useModalFlow
│       │   ├── theme.ts               # Limits, colours, the one stylesheet
│       │   ├── media.ts               # resolveCaptureMode + image/video compression
│       │   ├── types.ts               # Component props and flow step types
│       │   └── index.ts               # Public API surface
│       ├── __mocks__/
│       │   ├── react-native.js
│       │   ├── react-native-vision-camera.js
│       │   └── react-native-image-picker.js
│       ├── dist/                      # Compiled output — git-ignored
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   ├── core/                          # Runnable ts-node scripts
│   └── AuthentaDemo/                  # Runnable demo React Native app
│       ├── App.tsx
│       ├── metro.config.js
│       └── package.json
│
├── CONTRIBUTING.md                    # This file
├── README.md
└── .gitignore
```

---

## Package Guidelines

### @authenta/core

- **No React or React Native imports** — this package must run in plain Node.js. Any React Native-specific code breaks server-side usage and tests.
- **No Node.js built-ins at the top level** — Metro (React Native bundler) cannot statically resolve `fs`, `path`, `crypto`, etc. When a Node.js fallback is needed (e.g. reading a file), use the aliased require trick inside a runtime guard:
  ```ts
  if (typeof XMLHttpRequest === 'undefined') {
    const _require = require;
    const fs = _require('fs');
    // ...
  }
  ```
- **File and upload plumbing lives in `internal/fileSource.ts`** — `resolveUri`, `putToPresignedUrl`, `readFileAsBase64`, and the URI normalizers are shared by both clients. This module carries hard-won Android/iOS fixes (whitespace repair in `file://` paths, `react-native-blob-util` streaming, the XHR fallback). Do not duplicate this logic into a client, and change it only with a device test on both platforms.
- **Keep the two clients separate** — `AuthentaClient` and `FaceIndexClient` target different services. They may share `internal/` and `utils/`, but never configuration, auth, error envelopes, or types.
- **Types belong with their service** — detection types in `src/types/index.ts`, face indexing types in `src/faceIndex/types.ts`. Both must be reachable from `src/index.ts`.
- **Typed errors only** — all thrown values must extend `AuthentaError`. New error types go in `errors.ts` (or `faceIndex/errors.ts`) and must be exported from `index.ts`.
- **Stable public surface** — the exported clients and types are the public API. Do not remove or rename them without a major version bump.

### @authenta/react-native

- **Core owns all API logic** — the modals only call client methods (`uploadAndPoll`, `enrollImages`, `waitForEnrollment`, `search`). Do not duplicate upload, polling, or result-fetching logic here.
- **`CameraScreen.tsx` is shared and delicate** — both modals mount it. It is keyed by a session counter so every entry creates fresh native outputs; on iOS, reusing an `AVCaptureOutput` across two `AVCaptureSession`s throws an unhandled `NSException`. Do not lift its hooks into a parent, and do not remove the `key`.
- **One stylesheet, one set of primitives** — new screens compose `Page`, `Button`, `Row`, `Badge`, `KeyValue`, `Spinner`, and `ErrorView` from `ui.tsx`. Add a style to `theme.ts` only when no existing key fits; do not create per-screen stylesheets.
- **Flow state comes from `useModalFlow`** — it owns the current step, last error, attempt count, reset-on-open, and `run()` for async work. New modals should use it rather than re-implementing the pattern.
- **No Node.js built-ins** — Metro cannot resolve `fs`, `path`, `crypto`, etc.
- **`react` and `react-native` are peer dependencies** — they must never be moved to `dependencies`. Two copies of React in one app causes runtime crashes.
- **`react-native-vision-camera`, `react-native-image-picker`, and `react-native-compressor` are `dependencies`** — they are versioned and ship with the package so consumers get them automatically.
- **Import errors from core** — do not define new error classes here. Import from `@authenta/core` and re-export via `index.ts`.

---

## Making Changes

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/your-change
   ```
2. Make your changes in `packages/core/src/` or `packages/react-native/src/`.
3. Rebuild the affected package — and refresh the vendored copy if you touched core (see [Testing Local Changes](#testing-local-changes)).
4. Type-check both packages:
   ```bash
   cd packages/core && npx tsc --noEmit
   cd ../react-native && npx tsc --noEmit --noUnusedLocals
   ```
5. If you changed the public API, update the relevant README (`packages/core/README.md`, `packages/react-native/README.md`, and the root `README.md` tables).

---

## Capture Mode Rules

`resolveCaptureMode()` in `packages/react-native/src/media.ts` maps the enabled
checks to a camera capture mode. These rules must stay in sync with the docs:

| Checks enabled | Capture mode | Behaviour |
|---|---|---|
| `livenessCheck` only | `'both'` | Photo and video buttons shown side by side |
| `faceswapCheck` only | `'video'` | Video only, max 10 s |
| `faceSimilarityCheck` only | `'photo'` | Photo only, reference image required |
| `faceswapCheck` + `livenessCheck` | `'video'` | faceswap takes priority |
| `livenessCheck` + `faceSimilarityCheck` | `'photo'` | similarity takes priority |
| `faceswapCheck` + `faceSimilarityCheck` | — | **Not allowed** — validation error shown |

`AuthentaCapture` validates on open, before touching the camera: at least one
check must be enabled for `FI-1`, and the faceswap/similarity pair is rejected.
Both surface through `onError` as a `ValidationError`.

Video is capped at 10 s and 7 MB, and compressed before upload when it exceeds
6 MB (`VIDEO_SIZE_LIMIT_BYTES` in `theme.ts`).

---

## Face Indexing Rules

The FaceSim contract is enforced client-side so bad input never creates a
half-built subject on the server:

| Rule | Where |
|---|---|
| `tenantId` must be a UUID | `FaceIndexClient` constructor — throws `ValidationError` |
| 1–10 images per enrollment | `enroll()` |
| Only `image/jpeg`, `image/png`, `image/webp` | `describeImage()` — validated **before** `POST /v1/enroll` |
| All files read before the subject is created | `enrollImages()` |
| Search `limit` clamped to 1–50 | `search()` |
| Query image sent as unpadded URL-safe Base64 | `search()` |
| `502`/`503`/`504` retried twice with backoff | `request()` |

`/v1/search` puts the image in the query string, so its size is bounded by the
server's request-line limit — unknowable from the app. Rather than hard-code a
guess, the client stays permissive (`maxSearchImageChars` defaults to 200 000)
and reports both a server `414` and a local ceiling breach as code
`uri_too_long`. `AuthentaFaceIndex` uses that single code to walk the
`SEARCH_STEPS` ladder in `media.ts` down until the server accepts the image,
then reuses that rung for the session. Keep the two codes identical — the retry
loop branches on it.

On the UI side, `packages/react-native/src/media.ts` transcodes anything the
server will not accept (iOS hands back HEIC) to JPEG before enrolling, and
downscales the search photo to 800 px because the API carries it in a query
string. Enrollment is only complete once every face reaches `processed` or
`failed` — always go through `waitForEnrollment()`.

Face indexing and detection are mutually exclusive per session: a face-indexing
run executes no detection model. Host apps should present them as separate
modes, as the demo does.

---

## Error Handling Rules

- All SDK errors extend `AuthentaError` (defined in `packages/core/src/errors.ts`).
- Each error class maps to a specific HTTP status or API error code.
- When adding a new error type: add the class to `errors.ts`, export it from `packages/core/src/index.ts`, and document it in `packages/core/README.md`.

| Class | When to throw |
|---|---|
| `AuthenticationError` | 401 — invalid credentials |
| `AuthorizationError` | 403 — account lacks permission |
| `QuotaExceededError` | 429 — monthly quota hit |
| `InsufficientCreditsError` | 402 — no remaining credits |
| `ValidationError` | 400 / bad input from caller |
| `ServerError` | 5xx — platform error, safe to retry |
| `FaceIndexError` | Any FaceSim API failure — carries the server's `code` |

The two services use different error envelopes. Authenta returns
`{ code, message }`; FaceSim returns `{ error: { code, message } }` or FastAPI's
`{ detail: [...] }`. `faceIndex/errors.ts` parses both and maps known codes to
messages that are safe to display, keeping the raw server text at
`err.details.apiMessage`. When adding a FaceSim code, add it to
`FRIENDLY_MESSAGES` and to the table in `packages/core/README.md`.

---

## Submitting a Pull Request

1. Ensure both packages build and type-check cleanly.
2. Keep the PR focused — one change per PR.
3. Update the relevant README if you changed any public API.
4. Open a PR against `master` with a clear title and description of what changed and why.

---

## Publishing to npm

Both packages must be published separately. Always publish `@authenta/core` first because `@authenta/react-native` depends on it.

### 1. Bump versions

Edit `packages/core/package.json` and/or `packages/react-native/package.json` and increment the `version` field following semver:

| Change type | Example bump |
|---|---|
| Bug fix | `1.0.1` → `1.0.2` |
| New feature, backward compatible | `1.0.1` → `1.1.0` |
| Breaking API change | `1.0.1` → `2.0.0` |

If you bump `@authenta/core`, also update the `"@authenta/core"` version in `packages/react-native/package.json` `dependencies`.

### 2. Build

```bash
cd packages/core && npm run build
cd ../react-native && npm run build
```

### 3. Dry run

```bash
cd packages/core && npm publish --access public --dry-run
cd ../react-native && npm publish --access public --dry-run
```

Verify only `dist/` files appear — no `src/`, `__tests__/`, or secrets.

### 4. Publish

```bash
npm login   # if not already logged in

cd packages/core && npm publish --access public
cd ../react-native && npm publish --access public
```

### 5. Verify

```bash
npm info @authenta/core
npm info @authenta/react-native
```

---

## License

MIT © Authenta

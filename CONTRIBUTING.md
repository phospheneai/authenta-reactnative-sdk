# Contributing to Authenta SDK

Thank you for your interest in contributing. This guide covers everything you need to get the monorepo running locally, understand the codebase, make changes, and publish new versions.

---

## Table of Contents

- [Repository Overview](#repository-overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Build](#build)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [Package Guidelines](#package-guidelines)
  - [@authenta/core](#authentacore)
  - [@authenta/react-native](#authentareact-native)
- [Making Changes](#making-changes)
- [Capture Mode Rules](#capture-mode-rules)
- [Error Handling Rules](#error-handling-rules)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Publishing to npm](#publishing-to-npm)

---

## Repository Overview

This is an npm workspaces monorepo with two publishable packages:

| Package | Path | Description |
|---|---|---|
| `@authenta/core` | `packages/core/` | Pure TypeScript API client — no React, no native modules |
| `@authenta/react-native` | `packages/react-native/` | React Native camera capture UI built on top of core |

The `examples/AuthentaDemo/` folder contains a runnable React Native app that consumes both packages locally via `file:` references.

---

## Prerequisites

- Node.js >= 18
- npm >= 8 (workspaces support required)
- For running the demo app: React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))

---

## Setup

```bash
git clone https://github.com/phospheneai/authenta-reactnative-sdk.git
cd authenta-reactnative-sdk
npm install
```

`npm install` at the root installs all workspaces and symlinks `@authenta/core` into `packages/react-native/node_modules` automatically.

---

## Build

Always build `@authenta/core` before `@authenta/react-native` — the react-native package imports from core's compiled dist.

```bash
# Build both in the correct order
npm run build

# Or individually
npm run build --workspace=packages/core
npm run build --workspace=packages/react-native
```

Compiled output goes to `packages/*/dist/`. These folders are git-ignored.

---

## Tests

```bash
# Run all workspaces
npm test --workspaces

# Run a specific package
npm test --workspace=packages/core
npm test --workspace=packages/react-native
```

The `packages/core/__tests__/client.test.ts` file is a manual integration test that hits the real Authenta API. It requires valid credentials set as environment variables:

```bash
AUTHENTA_CLIENT_ID=your_id AUTHENTA_CLIENT_SECRET=your_secret node packages/core/__tests__/client.test.js
```

Unit tests for `@authenta/react-native` use Jest mocks located in `packages/react-native/__mocks__/`.

---

## Project Structure

```
authenta-reactnative-sdk/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client.ts          # AuthentaClient — upload, poll, getResult, faceIntelligence
│   │   │   ├── errors.ts          # All typed error classes
│   │   │   ├── types/index.ts     # All TypeScript interfaces and types
│   │   │   ├── utils/helpers.ts   # getMimeType, isImage, isVideo, safeJsonParse
│   │   │   └── index.ts           # Public API surface (re-exports everything)
│   │   ├── __tests__/
│   │   │   └── client.test.ts     # Integration test
│   │   ├── dist/                  # Compiled output — git-ignored
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── react-native/
│       ├── src/
│       │   ├── AuthentaCapture.tsx  # Self-contained eKYC camera modal
│       │   └── index.ts             # Public API surface
│       ├── __mocks__/
│       │   ├── react-native.js
│       │   ├── react-native-vision-camera.js
│       │   └── react-native-image-picker.js
│       ├── dist/                    # Compiled output — git-ignored
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   └── AuthentaDemo/                # Runnable demo React Native app
│       ├── App.tsx
│       ├── metro.config.js
│       └── package.json
│
├── CONTRIBUTING.md                  # This file
├── package.json                     # Workspace root
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
- **All types in one place** — every interface and type belongs in `src/types/index.ts` and must be exported from `src/index.ts`.
- **Typed errors only** — all thrown values must extend `AuthentaError`. New error types go in `errors.ts` and must be exported from `index.ts`.
- **Stable public surface** — `AuthentaClient` and all exported types are the public API. Do not remove or rename them without a major version bump.

### @authenta/react-native

- **Core owns all API logic** — `AuthentaCapture` only calls `client.faceIntelligence()`. Do not duplicate any upload, polling, or result-fetching logic here.
- **Capture mode rules in one place** — the `resolveCaptureMode()` function in `AuthentaCapture.tsx` is the single source of truth for which capture mode maps to which check combination. See [Capture Mode Rules](#capture-mode-rules).
- **No Node.js built-ins** — Metro cannot resolve `fs`, `path`, `crypto`, etc. File reads use `XMLHttpRequest`.
- **`react` and `react-native` are peer dependencies** — they must never be moved to `dependencies`. Having two copies of React in the same app causes runtime crashes.
- **`react-native-vision-camera` and `react-native-image-picker` are `dependencies`** — they are versioned and ship with the package so consumers get them automatically on install.
- **Import errors from core** — do not define new error classes here. Import from `@authenta/core` and re-export via `index.ts`.

---

## Making Changes

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/your-change
   ```
2. Make your changes in `packages/core/src/` or `packages/react-native/src/`.
3. Rebuild the affected package:
   ```bash
   npm run build --workspace=packages/core
   # and/or
   npm run build --workspace=packages/react-native
   ```
4. Run the tests:
   ```bash
   npm test --workspaces
   ```
5. If you changed the public API, update the relevant README (`packages/core/README.md` or `packages/react-native/README.md`).

---

## Capture Mode Rules

The `resolveCaptureMode()` function in `AuthentaCapture.tsx` maps the enabled checks to a camera capture mode. These rules must stay in sync with the docs:

| Checks enabled | Capture mode | Behaviour |
|---|---|---|
| `livenessCheck` only | `'both'` | Photo and video buttons shown side by side |
| `faceswapCheck` only | `'video'` | Video only, max 10 s |
| `faceSimilarityCheck` only | `'photo'` | Photo only, reference image required |
| `faceswapCheck` + `livenessCheck` | `'video'` | faceswap takes priority |
| `livenessCheck` + `faceSimilarityCheck` | `'photo'` | similarity takes priority |
| `faceswapCheck` + `faceSimilarityCheck` | — | **Not allowed** — validation error shown |

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

---

## Submitting a Pull Request

1. Ensure `npm run build && npm test --workspaces` both pass.
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
npm run build
```

### 3. Dry run

```bash
npm publish --workspace=packages/core --access public --dry-run
npm publish --workspace=packages/react-native --access public --dry-run
```

Verify only `dist/` files appear — no `src/`, `__tests__/`, or secrets.

### 4. Publish

```bash
npm login   # if not already logged in

npm publish --workspace=packages/core --access public
npm publish --workspace=packages/react-native --access public
```

### 5. Verify

```bash
npm info @authenta/core
npm info @authenta/react-native
```

---

## License

MIT © Authenta

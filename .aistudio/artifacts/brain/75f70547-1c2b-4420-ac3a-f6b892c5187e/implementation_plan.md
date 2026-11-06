# Phase 9: Production API & Build Remediation Plan

This plan details the root-cause investigation and minimal permanent fix for the Vercel production `ERR_MODULE_NOT_FOUND` (`/var/task/server`) failure and the three remaining build/runtime diagnostics, while keeping all MongoDB Atlas production records, the `lastOrderSequence` (`1082`) counter, Firebase Authentication, and the React UI/UX untouched.

## User Review & Critical Decisions

> [!IMPORTANT]
> **No source files have been modified in this step.** Review the root-cause investigation and proposed minimal fixes below. Once you approve, we will apply these targeted changes, run full local and bundle verification, and wait for your confirmation before Phase 10.

- **Priority 1 — Fix Vercel `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server'`**: Pre-bundle the Express + MongoDB serverless entry point into a self-contained ESM handler (`/api/index.js`) during `npm run build` using `esbuild` (already installed), eliminating extensionless cross-directory TypeScript imports and `__dirname` path mismatches inside `/var/task/api/`.
- **Priority 2 — Fix `TS2688: Cannot find type definition file for 'vite/client'`**: Lock `compilerOptions.types` to `["node"]` in `tsconfig.json`, provide self-contained Vite ambient types in `src/vite-env.d.ts`, and deploy `/api/index.js` as pre-bundled JavaScript so `@vercel/node` never invokes its legacy TypeScript type-directive resolver.
- **Priority 3 — Fix `[vite] failed to connect to websocket (WebSocket closed without opened)`**: Disable Vite HMR WebSocket attempts in `vite.config.ts` and `server.ts` when running inside the AI Studio preview proxy (`hmr: false`).
- **Priority 4 — Fix `persistMenuToLocalStorage` / Legacy Firestore Startup Listeners in `ContentContext.tsx`**: Remove the 6 legacy Firestore `onSnapshot`/`setDoc`/`deleteDoc` calls in `src/context/ContentContext.tsx` so catalogue and settings state syncs exclusively from MongoDB Atlas (`/api/products`, `/api/classes`, `/api/settings`) and `localStorage`, leaving Firebase Authentication untouched.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves the Vercel Serverless Function runtime module resolution failure (`ERR_MODULE_NOT_FOUND` on `/api/*`), eliminates the `TS2688` TypeScript build error on Vercel, stops broken HMR WebSocket connection attempts in the AI Studio preview environment, and removes duplicate legacy Firestore listeners in `ContentContext`.
- **Target Environment**: Vercel Production Serverless Functions (`/var/task/api/index.js` + static `dist/` frontend) and Google AI Studio development preview (`http://0.0.0.0:3000`).
- **Key Value**: Ensures `/api/health`, `/api/orders`, `/api/bookings`, `/api/classes`, `/api/products`, `/api/settings`, and `/api/admin/*` execute reliably on Vercel Production without ESM path resolution errors or cold-start file-lookup crashes.

---

## 2. User Experience & Visual Design

- **Zero UI/UX Changes**: All storefront pages, product cards, cart drawer, custom cake inquiry modals, baking class registration modals, customer authentication flows, and Admin Panel views remain 100% unchanged.
- **Zero Auth or Data Changes**:
  - Firebase Authentication (`GoogleAuthProvider` sign-in and ID token verification) remains untouched.
  - MongoDB Atlas `browniegirl` production database (`54` products, `9` categories, `4` website settings, `3` users) and `lastOrderSequence` (`1082`) remain untouched.

---

## 3. Key Technical Decisions & Root-Cause Analysis

### Issue 1 (Priority 1): `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server' imported from /var/task/api/index.js`
- **Root Cause**:
  1. `package.json` sets `"type": "module"` (line 5), which forces Node.js in Vercel's `/var/task` runtime to execute `/var/task/api/index.js` using strict native ECMAScript Modules (ESM).
  2. `api/index.ts` (line 1) contains `import { createExpressApiApp } from '../server';`, and `server.ts` (lines 5–29) contains extensionless relative imports (`./src/lib/mongodb`, `./src/lib/mongoSchema`, `./src/lib/adminAuth`, `./src/lib/firebaseToMongoMigration`).
  3. When `@vercel/node` transpiles `api/index.ts` to `/var/task/api/index.js`, it does not rewrite extensionless relative specifiers or bundle parent-directory TypeScript modules cleanly under `"type": "module"`. At runtime, Node's strict ESM loader looks for a literal file `/var/task/server` (without `.js`) and throws `ERR_MODULE_NOT_FOUND`.
  4. Additionally, `server.ts` (lines 35–36) executes `fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'))` at module load time. Inside `/var/task/api/index.js`, `__dirname` resolves to `/var/task/api` rather than `/var/task`, which would cause an `ENOENT` crash if not resolved safely across candidate paths.
- **Minimal Permanent Fix**:
  - Make `firebase-applet-config.json` resolution in `server.ts` safe across `/var/task`, `/var/task/api`, and `process.cwd()` with a fallback object.
  - Use `esbuild` (already installed in `devDependencies`) during `npm run build` (`vite build && esbuild ...`) to bundle the serverless entry point into a self-contained ESM file `/api/index.js` that inlines `server.ts` and `src/lib/*` while keeping `node_modules` packages (`express`, `mongodb`, etc.) external, and route `/api/(.*)` to `/api/index.js` in `vercel.json`.

### Issue 2: `TS2688: Cannot find type definition file for 'vite/client'`
- **Root Cause**:
  1. In `vite@8.3.4`, `client.d.ts` is only mapped via `package.json` `"exports": { "./client": { "types": "./client.d.ts" } }`; there is no `node_modules/@types/vite/client` or `node_modules/vite/client/index.d.ts`.
  2. Whenever `@vercel/node` compiles a `.ts` file in `/api` using `typescript@7.0.2`, its Node type-directive resolver ignores `package.json` `"exports"` and fails with `TS2688` if `"vite/client"` is referenced in `compilerOptions.types`.
- **Minimal Permanent Fix**:
  - Keep `"types": ["node"]` in `tsconfig.json` and self-contained ambient types in `src/vite-env.d.ts`.
  - Because the Vercel Serverless Function entry point is pre-bundled to `/api/index.js` (JavaScript) during `npm run build` (and `/api/index.ts` is removed), `@vercel/node` no longer invokes its TypeScript transpiler on `/api/*` during Vercel deployment.

### Issue 3: `[vite] failed to connect to websocket (Error: WebSocket closed without opened)`
- **Root Cause**:
  1. The Google AI Studio preview proxy (`*.run.app`) disables HMR WebSocket upgrades to prevent iframe flickering.
  2. `server.ts` mounts Vite in `middlewareMode: true` without an HMR WebSocket server, and `vite.config.ts` enables `hmr` whenever `DISABLE_HMR` is not `'true'`.
  3. In the browser, `/@vite/client` attempts to open a WebSocket that immediately closes before opening, causing an unhandled promise rejection in Vite 8.
- **Minimal Permanent Fix**:
  - Explicitly disable HMR (`hmr: false`) in `vite.config.ts` and in `server.ts`'s `createViteServer` call.

### Issue 4: Stack Trace Referencing `persistMenuToLocalStorage` in `src/context/ContentContext.tsx`
- **Root Cause**:
  1. `persistMenuToLocalStorage` itself is synchronous and wrapped in `try/catch` blocks (with a delta fallback for the 5 MB `localStorage` quota), so `localStorage` is not throwing.
  2. However, `src/context/ContentContext.tsx` currently runs **both** the MongoDB Atlas API sync (`fetchMongoCatalogueAndSettings`) **and** 6 legacy Firestore `onSnapshot` listeners (`settings/general`, `settings/achievements`, `menu_items`, `baking_classes`, `custom_items`, `settings/admins`) simultaneously on startup, plus unauthenticated `setDoc` writes inside `onSnapshot` callbacks.
- **Minimal Permanent Fix**:
  - Remove the 6 legacy Firestore `onSnapshot`, `setDoc`, and `deleteDoc` calls from `src/context/ContentContext.tsx` so content state is driven cleanly by MongoDB Atlas (`/api/products`, `/api/classes`, `/api/settings`) and `localStorage`, while preserving Firebase Authentication (`src/firebase.ts` and `src/context/AuthContext.tsx`).

---

## 4. Technical Architecture & Serverless Bundling Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Build & Runtime Pipeline                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [npm run build]                                                         │
│     ├──► 1. vite build ──────────────────────────► dist/ (Static SPA)    │
│     └──► 2. esbuild server.ts (bundle local TS) ─► api/index.js (ESM)    │
│                                                                          │
│  [Vercel Production Runtime (/var/task)]                                 │
│     ├──► Static Routes (/((?!api/|assets/).*)) ──► dist/index.html       │
│     └──► API Routes (/api/(.*)) ─────────────────► /var/task/api/index.js│
│             ├── Inlined: server.ts + src/lib/{mongodb,mongoSchema,...}   │
│             ├── External npm: express, mongodb (from node_modules)       │
│             └── Connects to: MongoDB Atlas ("browniegirl" cluster)       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

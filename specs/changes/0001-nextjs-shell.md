# Change 0001: Next.js Application Shell

## Status
Implemented

## Owner
Michi Kono

## Goal

Stand up the Next.js 15 project skeleton so `npm run dev` starts the Firebase emulators and the app, and `npm run check` passes all quality gates against an empty scaffold.

## Context

Phase 0 is complete. All design docs and ADRs are accepted. Phase 1 begins with this slice: creating the project foundation that every subsequent change spec will build on. Nothing in scope here produces user-visible product functionality — this is pure infrastructure.

Relevant docs: `docs/03-architecture.md`, `docs/15-local-development.md`, `docs/16-quality-gates.md`, ADR 0001 (Vercel), ADR 0002 (Firestore), ADR 0003 (Auth), ADR 0004 (Server Actions), ADR 0005 (Integer Cents).

## User-visible behavior

None. The app loads a placeholder page at `localhost:3000` that says the app is coming soon (or redirects to `/sessions` as a stub). No real functionality.

## Non-goals

- No Firebase Auth implementation (spec 0002)
- No Firestore reads or writes
- No session, player, buy-in, or payment logic
- No real pages beyond scaffold structure
- No shadcn/ui component setup beyond initial `init` (can be deferred to first UI spec)
- No CI configuration (GitHub Actions — deferred; Lefthook covers local gates)

## Data model impact

None. No Firestore collections created or written.

## Diagram impact

None. Architecture diagrams already reflect the intended stack.

## API impact

None. No Server Actions, no API routes.

## Security/privacy impact

`.env.local.example` documents all required environment variables with safe demo values. Admin SDK credentials use empty strings locally (emulator requires no credentials). `.env.local` is gitignored. No secrets committed.

## Local development impact

This spec creates the local development environment from scratch. After this spec:

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

...must produce a running app at `localhost:3000` with Firebase emulator UI at `localhost:4000`.

`docs/15-local-development.md` should be verified against the implemented setup and updated if anything differs.

## Quality gates

| Gate | Command | Required for completion | Required for merge |
|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes |
| Lint | `npm run lint` | Yes | Yes |
| Typecheck | `npm run type-check` | Yes | Yes |
| Unit tests | `npm run test` | Yes | Yes |
| Build | `npm run build` | Yes | Yes |
| Local smoke test | `npm run dev` manually | Yes | Yes |
| Aggregate | `npm run check` | Yes | Yes |

Integration tests: not configured in this slice — no Firestore reads/writes exist yet. Will be introduced in spec 0003.
E2E tests: Playwright is configured and `npm run test:e2e` runs, but no test files exist yet. Runner exits with 0 failures. Full E2E coverage deferred to later specs.

## Test plan

No business logic to test in this slice. The quality gates themselves are the test plan:
- `npm run test` must pass (0 test files = 0 failures is acceptable)
- `npm run build` validates that the scaffold type-checks and compiles end-to-end
- Manual smoke test: `npm run dev` starts cleanly, placeholder page loads, emulator UI is reachable

## Acceptance criteria

- [ ] `npm run dev` starts without errors — Next.js at `localhost:3000`, Firebase emulator UI at `localhost:4000`, Firestore at `localhost:8080`, Auth at `localhost:9099`
- [ ] `localhost:3000` loads without errors (placeholder page or stub redirect)
- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes with `strict: true`
- [ ] `npm run test` passes (zero failures; zero test files is acceptable)
- [ ] `npm run build` produces a clean Next.js build
- [ ] `npm run check` runs all of the above in sequence and passes
- [ ] `git commit` triggers Lefthook pre-commit hook: typecheck + lint + unit tests all pass
- [ ] `.env.local.example` documents every required env var with demo values
- [ ] Emulator data is written to `.emulator-data/` (gitignored per worktree)
- [ ] No secrets committed — `.env.local` is gitignored
- [ ] `npm install` runs cleanly from a fresh checkout (including `postinstall` Lefthook install)
- [ ] Spec conformance review completed

## Rollout/deployment notes

No production deployment needed for this slice — it's a scaffold with a placeholder page. Vercel will create a preview deployment automatically on branch push, which serves as a basic smoke test.

Environment variables needed in Vercel before any preview deployment is useful:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (public, demo values are fine for preview)
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` — not needed until spec 0002 (auth)

## Implementation notes

### File structure to create

```
package.json
tsconfig.json
next.config.ts
biome.json
lefthook.yml
firebase.json
.firebaserc
.gitignore                    (update to include .emulator-data/)
.env.local.example
playwright.config.ts
vitest.config.ts
src/
  app/
    layout.tsx
    page.tsx                  (placeholder)
    globals.css
e2e/                          (empty — Playwright reads this dir)
```

### Key configuration decisions

**`package.json` scripts:**
```json
{
  "dev": "concurrently \"npm:dev:emulator\" \"npm:dev:next\"",
  "dev:emulator": "firebase emulators:start --project demo-poker-ledger --import .emulator-data --export-on-exit .emulator-data",
  "dev:next": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "format": "biome format --write .",
  "format:check": "biome format .",
  "lint": "biome lint .",
  "lint:fix": "biome lint --write .",
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "check": "npm run format:check && npm run lint && npm run type-check && npm run test && npm run build",
  "postinstall": "lefthook install"
}
```

**Firebase emulator:** Use `demo-poker-ledger` demo project ID. Demo project IDs (prefix `demo-`) cause the emulator to run without any Firebase credentials — no `.firebaserc` project lookup, no network calls.

**Emulator data persistence:** `--import .emulator-data --export-on-exit .emulator-data` persists emulator state across restarts. `.emulator-data/` is gitignored per worktree so each branch gets isolated data.

**Lefthook pre-commit hooks:**
```yaml
pre-commit:
  commands:
    typecheck:
      run: npm run type-check
    lint:
      run: npm run lint
    test:
      run: npm run test
```

**TypeScript strict config (`tsconfig.json`):**
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- Target: `ES2022` or later
- `moduleResolution: bundler`

**Biome (`biome.json`):**
- 2-space indentation, double quotes
- Import sorting enabled
- Lint rules: recommended + any project-specific additions

**Next.js config (`next.config.ts`):**
- Minimal — no special config needed for scaffold
- `experimental.serverActions` enabled (default in Next.js 15)

### `.env.local.example` contents

```bash
# Firebase client config (safe to expose — identifies the project, does not grant write access)
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-poker-ledger.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-poker-ledger
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-poker-ledger.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=demo-000000000000

# Firebase Admin SDK (server-only — NEVER expose to client or commit)
# Leave blank for local dev — the emulator requires no credentials
FIREBASE_ADMIN_PROJECT_ID=demo-poker-ledger
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

### Dependencies to install

Runtime:
- `next@15`, `react@19`, `react-dom@19`
- `firebase` (client SDK)
- `firebase-admin`
- `tailwindcss`, `@tailwindcss/postcss` (or `postcss`, `autoprefixer`)

Dev:
- `typescript`, `@types/node`, `@types/react`, `@types/react-dom`
- `@biomejs/biome`
- `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- `@playwright/test`
- `lefthook`
- `concurrently`

## Open questions

None. All prerequisite decisions are captured in ADRs.

## Links

- `docs/03-architecture.md` — tech stack and component diagram
- `docs/15-local-development.md` — local dev expectations this spec must satisfy
- `docs/16-quality-gates.md` — gate definitions
- `specs/decisions/0001-use-vercel-for-hosting.md`
- `specs/decisions/0002-use-firestore.md`
- `specs/decisions/0003-auth-model.md`
- `specs/decisions/0004-server-actions-over-api-routes.md`
- `specs/decisions/0005-monetary-amounts-as-integer-cents.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved for implementation |
| 2026-05-02 | Implemented | All gates passed; merged via PR #4 |

# Poker Ledger

## Stack

- **Framework**: Next.js 15, App Router, TypeScript strict
- **Database**: Firestore (Firebase)
- **Auth**: Firebase Auth
- **Lint/Format**: Biome
- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **CI**: GitHub Actions

## Local Development

### First run

```bash
cp .env.local.example .env.local
npm install          # also installs git hooks via postinstall
npm run dev          # starts Firebase emulators + Next.js together
```

Emulator UI: http://localhost:4000  
App: http://localhost:3000

### Subsequent runs

```bash
npm run dev
```

Emulator data is persisted to `.emulator-data/` (gitignored) within each worktree. Switching worktrees switches data sets. No data is lost when you stop and restart.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start emulators + Next.js (one command) |
| `npm run type-check` | TypeScript strict check |
| `npm run lint` | Biome lint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Auto-format all files |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Run E2E tests (Playwright, needs `npm run dev` running) |
| `npm run test:e2e:ui` | Playwright UI mode |

## Pre-commit Hooks (Lefthook)

Runs automatically on every `git commit`:
1. TypeScript type check
2. Biome lint check
3. Unit tests

All three must pass. No bypassing.

## Firebase Emulator

Local dev uses `demo-poker-ledger` — a Firebase demo project that requires no credentials. The emulator starts without any Firebase account.

Emulator ports:
- UI: 4000
- Firestore: 8080
- Auth: 9099

Production uses a real Firebase project (configured via Vercel env vars — set up separately).

## Testing Patterns

- **Co-location**: test files live next to source — `src/foo/bar.test.ts` beside `src/foo/bar.ts`
- **E2E**: lives in `e2e/`
- **Requirement**: all new code ships with tests in the same PR
- **Firebase data layer**: test against the running emulator, not mocks
- **Everything else**: mock at the boundary with `vi.mock()`

## TypeScript Conventions

- `strict: true` — no exceptions
- `noUncheckedIndexedAccess: true` — array/object access returns `T | undefined`
- `exactOptionalPropertyTypes: true` — optional properties must be explicitly `undefined`, not absent
- No `any` — use `unknown` and narrow it

## Code Conventions

- 2-space indentation, double quotes (enforced by Biome)
- Imports auto-sorted by Biome
- File names: `kebab-case.ts`, React components: `PascalCase.tsx`
- No comments unless the WHY is non-obvious

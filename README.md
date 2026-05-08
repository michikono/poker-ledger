# Poker Ledger

A web app for friends running small-stakes home poker games to track buy-ins, cash-outs, and settle up at the end of the night. One person creates a session, shares the link, the table records buy-ins and cash-outs as they happen, and at the end the app computes the **minimal set of payments** to get everyone to net zero — plus optional Venmo deep links so each payment is a single tap away.

It also ships built-in help for first-timers: a hand-rankings cheat sheet and a newbie-friendly *How to play* guide for No-Limit Texas Hold'em, both deep-linkable inside any session URL.

The app does **not** move money. It only tracks the math; players still pay each other through Venmo / cash / however they like.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Hosting | Vercel |
| Database | Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| Styling | Tailwind CSS v4 + shadcn/ui + base-ui |
| Lint / format | Biome |
| Unit / integration tests | Vitest + Testing Library (JSDOM) |
| Emulator-backed tests | Vitest + `@firebase/rules-unit-testing` against the Firebase emulator |
| E2E tests | Playwright |
| Git hooks | Lefthook (pre-commit: typecheck + lint + unit tests; pre-push: fixup-guard) |
| CI | GitHub Actions (typecheck, unit, emulator, e2e) |

See `docs/03-architecture.md` for the architecture and `specs/decisions/` for the ADRs behind these choices.

---

## Quick start

```sh
git clone <repo-url>
cd poker-ledger
npm install                 # also installs lefthook git hooks
cp .env.local.example .env.local   # pre-configured for the local emulator; no edits needed
npm run dev                 # boots Firebase emulators + Next.js together
```

Open <http://localhost:3000>. Emulator UI is at <http://localhost:4000>.

Local development uses `demo-poker-ledger`, a Firebase **demo project** that needs no real credentials and no internet for the data layer. Switching git worktrees gives you isolated emulator data per branch.

For full setup details, signing in with the Auth emulator, and the per-worktree port-offset behavior, see `docs/15-local-development.md`.

---

## Commands

```sh
npm run dev               # Next.js + Firebase emulators (one command)
npm run build             # production build
npm run start             # serve the production build

npm run format            # Biome auto-format
npm run format:check      # Biome format check (no writes)
npm run lint              # Biome lint
npm run lint:fix          # Biome lint --write

npm run type-check        # tsc --noEmit
npm test                  # unit tests (Vitest, JSDOM, no emulator)
npm run test:watch        # Vitest in watch mode
npm run test:emulator     # rules + data-layer tests (needs emulator running)
npm run test:e2e          # Playwright (needs `npm run dev` running)
npm run test:e2e:ui       # Playwright UI mode

npm run check             # aggregate gate: format:check + lint + type-check + test + build

npm run gen:hand-rankings # regenerate the hand-rankings SVGs in public/help/hand-rankings/
```

---

## Repository layout

```
docs/                      Living design + architecture docs (00–17, kept current)
specs/
  changes/                 Numbered change specs — one per implementation slice
  decisions/               Architecture Decision Records (ADRs)
templates/                 Spec / ADR / review / release-checklist templates
prompts/                   Reusable Claude Code workflow prompts
skills/                    Project-local Claude Code skill definitions
src/
  app/
    (app)/                 Authenticated app shell + routes (Google sign-in gated)
    sign-in/               Public sign-in page + server actions
    api/                   API routes
  components/
    help/                  Hand-rankings cheat sheet + How-to-play guide modals
    layout/                AppShell, mobile sheet, side rail, top-right help buttons
    sessions/              Session-related shared UI
    ui/                    shadcn/ui primitives + custom UI components
    icons/                 Custom icons
  lib/
    auth/                  Session/token helpers, admin SDK init, sign-in user derivation
    sessions/              Session-domain logic (transitions, queries, garbage-collect)
    settlement/            Minimal-transactions settlement algorithm
    currency/              Cents parsing/formatting
    venmo/                 Venmo URL builder
    firestore/             Firestore serialization helpers
    errors/                Server-action error code → user message mapping
    help/                  Hand-rankings cheat-sheet data
    firebase/              Client + admin SDK initialization
public/                    Static assets, including help/hand-rankings/*.svg
scripts/                   Dev orchestration (dev.mjs), SVG generator, seed helpers
e2e/                       Playwright tests
firestore.rules            Deny-by-default; reads via Admin SDK only
firestore-rules.test.ts    Rules tests (run via npm run test:emulator)
.github/workflows/         CI (typecheck, lint, unit, emulator, e2e)
CLAUDE.md                  Operating model — branch naming, gates, PR conventions
```

---

## How the app evolves — workflow

Every meaningful change has a corresponding numbered spec in `specs/changes/` before it lands. The spec captures the goal, scope, non-goals, test strategy, and acceptance criteria, gets reviewed before implementation begins, and stays in the repo as a historical record after it ships (marked `Implemented`).

Architecture decisions live in `specs/decisions/` as numbered ADRs — one per durable choice (e.g., "use Firestore", "Server Actions over API routes", "monetary amounts as integer cents").

The living docs in `docs/` describe the system's current state and are updated as it evolves — they are not historical records.

Branches are short-lived and named by intent: `feature/<slice>`, `fix/<bug>`, `docs/<topic>`, `spec/<change-name>`, `chore/<maintenance>`. All work happens in isolated git worktrees, never directly on `main`.

The full operating model — pre-flight checks, PR body conventions, merge strategy, public-repo guardrails — is in `CLAUDE.md`.

---

## Quality gates

Every PR must pass these before merge (most run in CI on every push):

- **Format** — `npm run format:check`
- **Lint** — `npm run lint`
- **Typecheck** — `npm run type-check`
- **Unit tests** — `npm test`
- **Build** — `npm run build`
- **Emulator tests** — `npm run test:emulator` (rules suite + data-layer tests, runs against the Firestore emulator)
- **E2E** — `npm run test:e2e`

`npm run check` runs the fast subset (format + lint + typecheck + unit + build) locally without the emulator. The Lefthook pre-commit hook blocks commits that fail typecheck, lint, or unit tests.

See `docs/16-quality-gates.md` for the full gate definitions.

---

## Worktrees

Multiple worktrees can run in parallel — `npm run dev` picks a per-worktree port offset on first run (persisted to `.devports`) so each worktree gets its own Next.js + emulator stack without colliding on the default ports.

```sh
git worktree add ../worktrees/poker-ledger-feat-x -b feature/feat-x main
cd ../worktrees/poker-ledger-feat-x
npm install
npm run dev
```

After the PR merges:

```sh
cd <main-repo>
git checkout main && git pull
git worktree remove ../worktrees/poker-ledger-feat-x
git branch -D feature/feat-x
```

See `docs/17-worktree-workflow.md` for the full workflow.

---

## License

MIT — see `LICENSE`.

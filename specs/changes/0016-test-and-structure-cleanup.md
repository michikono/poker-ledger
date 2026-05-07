# Change 0016: Test coverage and structural cleanup

## Status
Implemented

## Owner
Michi Kono

## Goal

Close the test-coverage gap at the auth and Firestore-data boundary, eliminate duplicated client-side scaffolding, and remove two structural smells (duplicate root-route page; split Firebase Admin init) — without changing user-visible behaviour.

## Context

A walkthrough of `src/` after change 0014 surfaced three categories of latent risk that the existing test suite does not exercise:

1. **The auth/Firestore boundary is untested.** `app/sign-in/actions.ts::createSession` mints the session cookie, `app/(app)/layout.tsx` is the auth gate that decides whether a request reaches the app, and `lib/sessions/queries.ts` is every Firestore read that backs the sessions index and nav counts. None of these have unit or integration tests today. Their public contract is currently asserted only by E2E `smoke.spec.ts`, which checks unauthenticated redirect to `/sign-in` and nothing else.
2. **Client-side scaffolding is copy-pasted across five components.** `getToken()`, `redirectToSignIn()`, the `GENERIC_ERROR` constant, and `withToken<T>()` appear verbatim in `player-row.tsx`, `payment-list.tsx`, `player-table.tsx`, `session-view.tsx`, and `settling-modal.tsx`. `create-session-dialog.tsx` carries a renamed copy of the same constant. `session-view.tsx::handleErrorCode` is the only file that decodes server-action error codes into messages — every other caller toasts a generic message regardless of the failure mode, producing inconsistent UX.
3. **Two small structural duplicates.** `src/app/page.tsx` and `src/app/(app)/page.tsx` are byte-identical (both `redirect("/sessions")`) and both resolve to `/`. Per Next.js docs this should be a build error, but `main` ships with both files since commit `1cc009e` and CI is green — meaning Next.js (or our config) is silently tolerating it. Track A resolves this by deleting `(app)/page.tsx` and keeping the conventional un-grouped `app/page.tsx`. Separately, `lib/auth/admin.ts` initialises the Firebase Admin app while `lib/firebase/admin.ts` re-imports it `for the side effect` (per its own comment) before calling `getFirestore` and `getAuth`. One module should own initialisation.

This spec is the cleanup pass. It explicitly does not add features and does not overlap with spec 0015 (React-idiom audit), which is scoped to client-React patterns like effects-as-event-handlers and DOM-querying for cross-component coordination.

## User-visible behavior

None — this change is invisible to end users. One indirect improvement: every client-side action that today toasts the generic "Something went wrong" message will, after this change, decode known server-action error codes (e.g., `SESSION_NOT_EDITABLE`, `UNAUTHENTICATED`, `DUPLICATE_PLAYER_NAME`) into the same specific messages already used by `session-view.tsx`. That is a UX-positive consequence, not a feature.

## Non-goals

- New product behaviour, new server actions, new Firestore reads/writes.
- Performance or bundle-size work.
- Migrating off any libraries.
- Refactors covered by spec 0015 (effects-as-event-handlers, `forwardRef`, DOM querying, scroll/focus management). 0015's punch list found exactly one actionable item (F1, already merged in `4542d9e`), so there is no live overlap — but if any 0015-shaped smell surfaces next to code we touch here, leave it.
- Snapshot or visual tests for pure presentation components (`session-row`, `sessions-header`, `app-shell`, `header`, `side-rail`, `user-menu`, `nav-search`, `new-session-button`, `icons/*`). Deferred today, but **not** a permanent exemption: if any of these components gains conditional logic (a `useState`, or an `if` branch on props that changes rendered structure), the PR that adds the logic must also add a test. The deferral covers what's there today, not what's there tomorrow.
- Renaming the `(app)` route group. Considered and rejected during spec review: a folder rename churns 25+ file paths for a cosmetic win. If the rename is wanted, it gets its own dedicated one-line spec.

## Data model impact

None. No Firestore schema changes, no new collections, no new fields, no migrations.

## Diagram impact

None. No diagrams in `/docs` reflect the affected scaffolding code, and the route-group structure is not currently diagrammed.

## API impact

None. No server actions added, removed, or changed in signature. Behaviour of existing actions is preserved; only the *callers'* error-code handling is consolidated.

## Security/privacy impact

Two security-adjacent areas are touched, both *positively*:

1. **`createSession` gains tests.** The action verifies the ID token, mints a session cookie with `httpOnly`, `sameSite: "strict"`, `secure` in production, and a 5-day max-age, then triggers stale-session GC. Tests assert each of these properties for the happy path and assert the action throws (without setting a cookie) on invalid token. This catches future regressions in cookie hardening.
2. **The auth-gate logic gains tests.** `getSessionUser` is extracted from `(app)/layout.tsx` to `lib/auth/session-user.ts` and unit-tested for missing cookie, `verifySessionCookie` throwing, and the three `firstName`-derivation branches (`decoded.name`, `decoded.email`, fallback `"User"`). The layout itself becomes thin glue (`getSessionUser()` → `redirect`/`<AppShell>`). This is the single chokepoint protecting the entire `(app)` subtree; today nothing automated guards its contract.

No new attack surface. No new secrets handled. Firestore rules untouched.

## Local development impact

None. No new env vars, no new dependencies (the data-layer tests reuse `@firebase/rules-unit-testing` and the Firestore emulator that already power `firestore-rules.test.ts`). Local commands unchanged. `.env.local.example` unchanged.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Emulator tests | `npm run test:rules` (renamed to `npm run test:emulator` by track D) | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| E2E smoke | `npm run test:e2e` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

No gates are added or removed. Existing gates must continue to pass on every PR in this spec.

## Tracks

This spec is delivered as five small PRs across four tracks: A, B, C (which bundles D3), D1, D2. All are required for the spec to move to `Implemented`. The tracks are largely independent; see Implementation notes for the suggested order.

### Track A — Structural fixes

Smallest and lowest-risk; ideal first PR.

- **Delete `src/app/(app)/page.tsx`.** The two byte-identical `/` pages both resolve to `/`; Next.js docs say this should be a build error, but `main` has shipped both since commit `1cc009e` and CI is green. Rather than investigate the tolerance further, commit to a specific resolution: keep `src/app/page.tsx` (the conventional, un-grouped `/` entry point) and delete `src/app/(app)/page.tsx`. Both pages do the same `redirect("/sessions")`; both flows (authed → `/sessions`; unauthed → `/sessions` → auth gate → `/sign-in`) work the same after deletion. The existing `e2e/smoke.spec.ts` covers the unauth flow. No new authed E2E case is needed — that's deferred to a future "expand E2E coverage" spec because Playwright has no existing pattern in this repo for injecting a Firebase Auth session, and the auth gate's logic is locked in by track C's `getSessionUser` unit tests.
- **Consolidate Firebase Admin initialisation into a single module.** `lib/firebase/admin.ts` should own `initializeApp` and export `{ adminAuth, adminDb }`. `lib/auth/admin.ts` becomes a thin re-export of `adminAuth` from `lib/firebase/admin`, or is removed entirely with callers updated to import from `lib/firebase/admin` directly. Exactly one module calls `initializeApp`. Add a regression test (`lib/firebase/admin.test.ts`) that (a) imports the module from a fresh Vitest worker and asserts `getApps().length === 1`, and (b) immediately calls `adminDb.collection("__regression__")` and `adminAuth` and asserts neither throws — this catches the harder regression where someone moves a `getFirestore`/`getAuth` call before `initializeApp`. The bare `getApps().length` check alone only catches removal of the existing init guard.

### Track B — Client-scaffolding consolidation

Pre-flight: confirmed during spec review that all five `getToken()` implementations are byte-identical, all five `redirectToSignIn()` implementations are byte-identical, and the two `withToken<T>()` implementations are byte-identical. The two `withToken` copies are declared *inside* their host components (closure-scoped); verified during spec review that neither implementation actually closes over component state — both bodies only call the module-level `getToken()` and `redirectToSignIn()`. Hoisting them to a module-level function is therefore behaviour-preserving.

- Create `lib/auth/client-token.ts` exporting `getToken()`, `redirectToSignIn()`, and `withToken<T>(fn)`. Replace all duplicates in `player-row.tsx`, `payment-list.tsx`, `player-table.tsx`, `session-view.tsx`, `settling-modal.tsx`, and the renamed copy of `GENERIC_ERROR` in `create-session-dialog.tsx`. Call-sites that today inline `getToken` + manual null-check should adopt `withToken` for consistency.
- Create `lib/errors/messages.ts` exporting `GENERIC_ERROR` and `describeErrorCode(code: string): string` (renamed from `handleErrorCode` in `session-view.tsx`; the rename clarifies that it is a pure code → string mapping with no side effects). The function should use an exhaustive `switch` over the union of every server-action error code, with a `never`-typed default branch so that adding a new error code becomes a typecheck failure rather than a silent generic fallback. Every client component that currently toasts `GENERIC_ERROR` should call `describeErrorCode(result.error.code)` instead.

### Track C — Pure-helper extraction

- Create `lib/auth/session-user.ts` exporting `getSessionUser()` (currently a private function inside `app/(app)/layout.tsx`). The function reads the session cookie, calls `adminAuth.verifySessionCookie`, derives `firstName` from `decoded.name` / `decoded.email` / fallback `"User"`, and returns `{ uid, firstName }` or `null`. Update the layout to call the extracted module. Test the extracted module rather than the layout itself — the layout becomes thin glue (`getSessionUser()` → `redirect`/`<AppShell>`) and is left as untested glue per the deferred-presentation policy in non-goals.
- Create `lib/firestore/serialize.ts` exporting `tsToIso(value: unknown): string` and `asSessionStatus(value: unknown): SessionStatus`. These live today as private functions in `app/(app)/sessions/[name]/page.tsx`. Preserve the existing signatures — `asSessionStatus` keeps its hardcoded `"in_progress"` fallback (no new `fallback` parameter) and the function name is unchanged. Internally, delegate to `isSessionStatus` from `lib/sessions/types.ts` rather than re-implement the membership check.
- Update `app/(app)/sessions/[name]/page.tsx` and `app/(app)/layout.tsx` to import from the new modules.

### Track D — New tests at the auth/data boundary

The substantive coverage work, delivered as **three PRs**:

- **D1 — `queries.ts` + emulator config rename.** Emulator-backed tests for `lib/sessions/queries.ts`: `fetchSessionsByStatus`, `fetchAllSessions`, `fetchAllStatusGroups`, `fetchNavCounts`. Cover: empty collection, one session per status, multiple sessions per status, deleted-player edge cases for `playerCount`, ordering by `created_at desc`. These tests need the Firestore emulator and **must not** join the JSDOM unit-test config (which is deliberately emulator-free per `docs/16-quality-gates.md:57`). Same PR also: rename `vitest.rules.config.ts` → `vitest.emulator.config.ts`; rename the npm script `test:rules` → `test:emulator`; extend the include glob to `["firestore-rules.test.ts", "src/**/*.emulator.test.ts"]`; rename the `firestore-rules:` job in `.github/workflows/ci.yml` to `emulator:` (or similar) so the GitHub Actions check name tracks the script name; update `docs/16-quality-gates.md` to match. New tests use the `.emulator.test.ts` suffix.
- **D2 — `sign-in/actions.ts` tests.** `createSession`: happy path (valid token → cookie set with `httpOnly` / `sameSite: "strict"` / `secure` in production / correct `maxAge`), invalid token (verification throws → no cookie set), GC trigger fired exactly once. `signOut`: cookie deleted, `redirect("/sign-in")` invoked. Mock at module boundaries (`adminAuth.createSessionCookie`, `verifyIdToken`, `cookies()`, `archiveStaleSessionsOnLogin`); do not stand up the auth emulator just for this.
- **D3 — `session-user.ts` tests.** Ship in the **same PR** as track C's `getSessionUser` extraction (TDD). Missing cookie → `null`; `verifySessionCookie` throws → `null`; valid session with `decoded.name` → `firstName` is the first whitespace-delimited token of `name`; valid session without `name` but with `email` → `firstName` is the first token of `email`; valid session with neither → `firstName === "User"`.

Tests for the other helpers extracted in tracks B and C ship in the **same PR** that introduces those helpers (TDD applies).

## Test plan

By file, post-change:

| File | Existing tests | After this spec |
|---|---|---|
| `lib/auth/client-token.ts` | (new) | unit: `getToken`, `redirectToSignIn`, `withToken` |
| `lib/auth/session-user.ts` | (new) | unit: all five branches (missing cookie, verification throws, name → firstName, email → firstName, neither → "User") |
| `lib/errors/messages.ts` | (new) | unit: `describeErrorCode` table-driven, including `never`-default exhaustiveness check |
| `lib/firestore/serialize.ts` | (new) | unit: `tsToIso` (Timestamp-shaped, Date, undefined), `asSessionStatus` (valid status, invalid string, non-string) |
| `lib/firebase/admin.ts` | none | unit: single-init regression test (`getApps().length === 1`); also exercised by every emulator-backed test |
| `lib/sessions/queries.ts` | none | emulator-backed (`*.emulator.test.ts`): all four exported functions |
| `app/sign-in/actions.ts` | none | unit (mocked): `createSession`, `signOut` |
| `app/(app)/layout.tsx` | none | not tested directly; `getSessionUser` extracted to `lib/auth/session-user.ts` and tested there |
| `app/(app)/sessions/[name]/page.tsx` | none | helper logic moves to track C; page itself remains untested (data shaping is now in tested modules) |
| The six client files consuming the consolidated helpers (`player-row.tsx`, `payment-list.tsx`, `player-table.tsx`, `session-view.tsx`, `settling-modal.tsx`, `create-session-dialog.tsx`) | existing tests preserved | existing tests preserved; updated where they construct the now-shared helpers |

TDD applies for the extracted helpers and for `describeErrorCode` (pure logic, no I/O). Emulator-backed tests for `queries.ts` are written alongside the (no-op) refactor. Cookie-shape assertions in `createSession` tests are written first against the current implementation to lock in current behaviour.

## Acceptance criteria

Track A:
- [ ] `src/app/(app)/page.tsx` deleted; `src/app/page.tsx` retained as the canonical `/` entry point.
- [ ] The existing `e2e/smoke.spec.ts` (unauth visit to `/` → `/sign-in`) continues to pass.
- [ ] Exactly one module in `src/lib/` calls `initializeApp` from `firebase-admin/app`. Verified by: `grep -rn "initializeApp" src/lib/ | wc -l` returns `1`.
- [ ] `lib/firebase/admin.test.ts` exists and asserts: (a) `getApps().length === 1` after fresh import; (b) `adminDb.collection("__regression__")` and `adminAuth` can be invoked without throwing — the order-of-operations sentry that catches a future regression where someone moves `getFirestore`/`getAuth` before `initializeApp`.

Track B:
- [ ] `grep -rn "async function getToken" src/ | grep -v "lib/auth/client-token"` returns zero matches.
- [ ] `grep -rn "function redirectToSignIn" src/ | grep -v "lib/auth/client-token"` returns zero matches.
- [ ] `grep -rn "async function withToken" src/ | grep -v "lib/auth/client-token"` returns zero matches.
- [ ] `grep -rn "GENERIC_ERROR" src/ | grep -v "lib/errors/messages"` returns zero matches (this also catches the renamed `GENERIC_ERROR_TOAST` in `create-session-dialog.tsx`).
- [ ] Every client component that previously toasted a generic error message after a server-action failure now passes the action's error code through `describeErrorCode`. Verified by: each call-site whose `result.error.code` is currently mapped via `handleErrorCode` *or* mapped to `GENERIC_ERROR` is now routed through `describeErrorCode`.
- [ ] `describeErrorCode`'s default branch is typed `never`, enforcing exhaustiveness.

Track C:
- [ ] `lib/auth/session-user.ts` exports `getSessionUser`; `app/(app)/layout.tsx` imports from it; no private copy remains.
- [ ] `lib/firestore/serialize.ts` exports `tsToIso` and `asSessionStatus`; `app/(app)/sessions/[name]/page.tsx` imports from it; no private copies remain.

Track D:
- [ ] D1: New emulator-backed tests added for `lib/sessions/queries.ts`. `vitest.rules.config.ts` renamed to `vitest.emulator.config.ts`; npm script `test:rules` renamed to `test:emulator`; include glob extended to `["firestore-rules.test.ts", "src/**/*.emulator.test.ts"]`; the `firestore-rules:` job in `.github/workflows/ci.yml` renamed (e.g., to `emulator:`) and its `npm run` invocation updated; `docs/16-quality-gates.md` references updated. `grep -rn "test:rules\|vitest\.rules" .` returns zero matches.
- [ ] D2: New unit tests added for `app/sign-in/actions.ts` (`createSession`, `signOut`).
- [ ] D3: New unit tests added for `lib/auth/session-user.ts` (ships with track C).
- [ ] Tests for `client-token`, `errors/messages`, `firestore/serialize`, and `firebase/admin` ship in the same PR as their respective extraction.

Spec-level:
- [ ] All quality gates pass on every PR.
- [ ] Spec conformance review completed.
- [ ] No regressions in the existing `e2e/smoke.spec.ts`.

## Rollout/deployment notes

None. No env vars to set, no migration steps, no feature flags. Each PR is independently shippable to preview and production via the standard branch → PR → merge workflow.

## Implementation notes

The four tracks are largely independent. The order below is a *preference* (low-risk first), not a dependency graph — implementers may parallelise.

Suggested order:

1. **Track A** — structural fixes. Smallest and lowest-risk.
2. **Track C** — pure-helper extraction with tests (track D's D3 ships here).
3. **Track D1** — `queries.ts` emulator tests + emulator config rename.
4. **Track D2** — `sign-in/actions.ts` tests.
5. **Track B** — client-scaffolding consolidation with tests.

Pitfalls:

- **`createSession` GC behaviour.** The action triggers `archiveStaleSessionsOnLogin` *after* setting the cookie. If GC throws, the action throws too — but the cookie is already set. Tests should lock in the current behaviour (cookie is set even if GC subsequently throws); changing that behaviour is out of scope for this spec.
- **Order-of-imports for Firebase Admin.** The current `lib/firebase/admin.ts` carries a comment about `Next.js module evaluation order` motivating the side-effect import. After consolidation, make sure the *single* init module is the one imported by all callers and that there is no path that calls `getFirestore`/`getAuth` before `initializeApp`. The new `lib/firebase/admin.test.ts` is the regression guard, with two assertions: `getApps().length === 1` (catches removal of the init guard) and a smoke call to `adminDb.collection(...)` and `adminAuth` (catches a future regression where someone reorders the init).
- **`withToken` is currently component-local.** Verified during spec review that neither implementation closes over component state; both bodies only call module-level helpers. Hoisting is therefore safe — but the PR that hoists should include this confirmation in its body so the reviewer doesn't have to re-derive it.
- **`describeErrorCode` exhaustiveness.** Audit every server action's error union once before writing the table-driven test. The `never`-typed default branch makes "added a new error code, forgot to map it" a typecheck failure rather than a silent generic fallback. The codes seen today: `UNAUTHENTICATED`, `SESSION_NOT_FOUND`, `SESSION_NOT_EDITABLE`, `INVALID_STATE_TRANSITION`, `PAYMENT_NOT_FOUND`, `PLAYER_NOT_FOUND`, `BUY_IN_NOT_FOUND`, `INVALID_PLAYER_NAME`, `DUPLICATE_PLAYER_NAME`. Verify this list is complete during implementation.
- **Emulator config rename.** `vitest.rules.config.ts` → `vitest.emulator.config.ts` and `test:rules` → `test:emulator` is a small but cross-cutting change: it touches `package.json` (script), `.github/workflows/ci.yml` (job name and `npm run` invocation), and any docs that reference the script name (notably `docs/16-quality-gates.md`). Search for `test:rules` and `vitest.rules` before declaring the rename complete. The unit-test config (`vitest.config.ts`) **must remain emulator-free** — that's the whole point of the split per `docs/16-quality-gates.md:57`.
- **Track A's Firebase consolidation must not break `firestore-rules.test.ts`** — that file uses `@firebase/rules-unit-testing`, not `lib/firebase/admin`, so it should be unaffected. Verify after the refactor.
- **Tripwire: deferred presentation tests are not a permanent deferral.** The non-goals section excludes snapshot/presentation tests for the layout components today. If during implementation any of those components grows conditional logic (a `useState`, an `if` branch on props that changes rendered structure), it must gain a test in the same PR — not later.

## Open questions

None — all resolved during pass-2 review.

## Links

- `specs/changes/0015-react-idiom-audit.md` — adjacent cleanup spec, scoped to client-React patterns; no overlap.
- `specs/changes/0014-venmo-payment-links-and-player-edits.md` — origin of `session-view.tsx::handleErrorCode`.
- `specs/decisions/0003-auth-model.md` — context for the session-cookie auth flow that `createSession` and the `(app)` layout enforce.
- `specs/decisions/0004-server-actions-over-api-routes.md` — context for the error-code shape returned by every action this spec consolidates handling for.
- `docs/04-security-threat-model.md` — session-cookie hardening expectations that `createSession` tests must lock in.
- `docs/09-test-strategy.md` — TDD/emulator guidance applied here.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-07 | Proposed | Initial draft following structure/test review |
| 2026-05-07 | Proposed | Revised after pass-2 review: dropped optional rename track; verified all duplicates byte-identical; added `getSessionUser` extraction + `firebase/admin` regression test; replaced loose acceptance criteria with executable greps; documented emulator-config rename for `queries.ts` tests. |
| 2026-05-07 | Proposed | Pass-3 review: committed to deleting `(app)/page.tsx` (no investigation step); split track D into D1/D2/D3 PRs; added CI job rename to track D; clarified PR-order is preference, not dependency graph; strengthened `firebase/admin` regression test with order-of-operations smoke call; trimmed Goal; dropped the now-empty Open Questions; dropped the redundant "Spec PRs link this file" pitfall. |
| 2026-05-07 | Accepted | Approved after three review passes. |
| 2026-05-07 | Implemented | All five implementation PRs merged: #57 (track A), #58 (C+D3), #59 (D1), #60 (D2), #61 (B). |

# Change 0007: Session State-Transition Validator

## Status
Implemented

## Owner
Michi Kono

## Goal

Implement a pure-logic validator for session state transitions — `validateTransition({ from, to, previousStatus? })` — that encodes the canonical transition matrix from `docs/07-business-logic.md` as data and is exhaustively unit-tested. Provide a companion helper `getValidTransitions(from, previousStatus?)` for UI consumers.

## Context

The state-transition matrix in `docs/07-business-logic.md` is the canonical authority for session lifecycle. Every state-changing Server Action (`transitionToSettling`, `rollbackSessionStatus`, `archiveSession`, `unarchiveSession`) must enforce this matrix, and the session-view UI must derive its visible buttons from it. Without a centralized validator, each action and each UI surface re-encodes the matrix in prose-driven branches — a guaranteed source of drift.

This spec extracts that matrix into a single pure module before any of the state-changing actions are implemented, so all later work depends on one source of truth. It pairs with spec 0006 (settlement algorithm): 0006 validates *settling preconditions* (balance and cash-out completeness); this spec validates *whether the transition itself is allowed* given the matrix. The two together form the guard layer for `transitionToSettling`.

It is parallel-safe with specs 0005 (create-session) and 0006 (settlement algorithm): no shared files and no imports across these slices.

Relevant docs: `docs/07-business-logic.md` (state transition matrix; rules `valid-state-transitions`, `archive-is-soft-delete`, `unarchive-restores-previous-status`).

## User-visible behavior

None directly. This is an internal library. Behavior becomes user-visible when later specs wire the matching Server Actions and a session-view that renders state-change buttons.

## Non-goals

- The Server Actions themselves (`transitionToSettling`, `rollbackSessionStatus`, `archiveSession`, `unarchiveSession`) — separate specs.
- Firestore reads/writes, transactions, batches, changelog entries, payment-doc deletion, or paid-mark resets — separate specs. This module emits no side effects.
- The settling balance/cash-out precondition check — owned by spec 0006 (`validateSettling`).
- Side-effect metadata for transitions (e.g., "delete payments", "reset paid marks", "skip balance recheck"). The matrix in `docs/07-business-logic.md` already documents these per row; encoding them as data here would balloon scope. A future spec may add a `getTransitionEffects(...)` helper if the action layer benefits.
- UI components — the helper `getValidTransitions` returns a plain array; rendering buttons is the consumer's job.
- Auto-transitions are validated identically to user-triggered transitions (the matrix doesn't differ on actor); but the *intent* of the call is not modeled (no `trigger` enum). If later specs need to distinguish auto vs. manual rollback for changelog `reason` codes, that distinction lives at the action layer, not here.

## Data model impact

None. The library is pure and operates entirely on the `SessionStatus` union already exported from `src/lib/sessions/types.ts`.

## Diagram impact

None. The state diagram and matrix in `docs/07-business-logic.md` are the source of truth and remain unchanged. The validator is a code-side reflection of an already-published diagram.

## API impact

No external API changes. The library exports the following internal TypeScript surface from `src/lib/sessions/transitions.ts`:

```ts
import type { SessionStatus } from "./types";

export type TransitionContext = {
  from: SessionStatus;
  to: SessionStatus;
  // Required only when from === "archived". Ignored otherwise.
  // null or an invalid recoverable state when from === "archived" causes the
  // transition to be rejected with INVALID_STATE_TRANSITION.
  previousStatus?: SessionStatus | null;
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_STATE_TRANSITION" };

export function validateTransition(ctx: TransitionContext): TransitionResult;

// Convenience for UI: which destination statuses are valid from `from`?
// When from === "archived", `previousStatus` determines the single valid destination.
export function getValidTransitions(
  from: SessionStatus,
  previousStatus?: SessionStatus | null,
): SessionStatus[];
```

## Security/privacy impact

None. Pure computation, no data access, no auth touchpoints, no logging.

## Local development impact

None. No new environment variables, processes, or setup steps. No new dependencies.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (Playwright): N/A — no UI surface.

Local smoke test: N/A — pure library; the unit-test suite is the smoke test.

## Test plan

Test-first. Implementation lands only after tests are written and red.

**Matrix coverage (`transitions.test.ts`):**
Exhaustive cross-product `from × to` over `{in_progress, settling, settled, archived}` = 16 cells. Each cell is one test asserting `ok: true` or `ok: false` with code `INVALID_STATE_TRANSITION`. Same-state transitions (e.g., `in_progress → in_progress`) are denied. The matrix in `docs/07-business-logic.md` is the authority; copy each row into a parameterized test.

Allowed transitions to assert:
- `in_progress → settling` ✓
- `in_progress → settled` ✓ (zero-payment shortcut)
- `in_progress → archived` ✓
- `settling → in_progress` ✓
- `settling → settled` ✓
- `settling → archived` ✓
- `settled → settling` ✓
- `settled → archived` ✓
- `archived → in_progress` ✓ (only when `previousStatus === "in_progress"`)
- `archived → settling` ✓ (only when `previousStatus === "settling"`)
- `archived → settled` ✓ (only when `previousStatus === "settled"`)

Denied transitions to assert (sample, not exhaustive — the cross-product test covers all):
- `in_progress → in_progress`, `settling → settling`, `settled → settled`
- `settled → in_progress` (must rollback through settling)
- `archived → archived` (per `archive-is-soft-delete`)
- Any `from → archived` with `previousStatus` ignored (only applies to unarchive direction).

**Unarchive edge cases (`transitions.test.ts`):**
- `from === "archived"`, `to === "in_progress"`, `previousStatus === "in_progress"` → ok.
- `from === "archived"`, `to === "in_progress"`, `previousStatus === "settling"` → denied (mismatched).
- `from === "archived"`, `to === "in_progress"`, `previousStatus === undefined` → denied.
- `from === "archived"`, `to === "in_progress"`, `previousStatus === null` → denied.
- `from === "archived"`, `to === "in_progress"`, `previousStatus === "archived"` → denied (corrupt state).
- `from === "archived"`, `to === "settling"`, `previousStatus === "settling"` → ok.
- `from === "archived"`, `to === "settled"`, `previousStatus === "settled"` → ok.
- `from === "archived"`, `to === "archived"`, regardless of `previousStatus` → denied.

**`getValidTransitions` (`transitions.test.ts`):**
- `getValidTransitions("in_progress")` → `["settling", "settled", "archived"]` (order is stable per implementation; assert as a set).
- `getValidTransitions("settling")` → `["in_progress", "settled", "archived"]`.
- `getValidTransitions("settled")` → `["settling", "archived"]`.
- `getValidTransitions("archived", "in_progress")` → `["in_progress"]`.
- `getValidTransitions("archived", "settling")` → `["settling"]`.
- `getValidTransitions("archived", "settled")` → `["settled"]`.
- `getValidTransitions("archived", null)` → `[]`.
- `getValidTransitions("archived")` (undefined `previousStatus`) → `[]`.
- `getValidTransitions("archived", "archived")` → `[]`.

**Consistency invariant test:**
- For every cell of the cross-product `from × to × previousStatus`, `validateTransition` and `getValidTransitions` must agree: `validateTransition(ctx).ok === getValidTransitions(ctx.from, ctx.previousStatus).includes(ctx.to)`. Encode this as a small loop in the test file so any future drift between the two surfaces fails immediately.

No component or integration tests — this library has no UI or I/O.

## Acceptance criteria

- [ ] `src/lib/sessions/transitions.ts` and `src/lib/sessions/transitions.test.ts` exist.
- [ ] `validateTransition` and `getValidTransitions` exported with the signatures in the **API impact** section.
- [ ] Every row of the transition matrix in `docs/07-business-logic.md` is encoded and tested (16 cross-product cells plus unarchive edge cases).
- [ ] Same-state transitions are denied for all four statuses.
- [ ] `archived → archived` is denied per `archive-is-soft-delete`.
- [ ] Unarchive only succeeds when `to === previousStatus` and `previousStatus` is one of `in_progress | settling | settled`; rejected otherwise.
- [ ] The consistency invariant test passes (the two surfaces never disagree).
- [ ] No Firestore, React, Next.js, or Node-only API imports in `src/lib/sessions/transitions.ts`.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.
- [ ] No regressions to existing tests.

## Rollout/deployment notes

None. Pure library code with no runtime configuration. Ships unused until a later spec wires a Server Action to call it.

## Implementation notes

**Suggested encoding:** a single declarative table mirrors the matrix and is the source of truth for both functions:

```ts
// Pseudocode — implementer choose whatever shape feels cleanest.
const ALLOWED: ReadonlyArray<readonly [SessionStatus, SessionStatus]> = [
  ["in_progress", "settling"],
  ["in_progress", "settled"],
  ["in_progress", "archived"],
  ["settling",    "in_progress"],
  ["settling",    "settled"],
  ["settling",    "archived"],
  ["settled",     "settling"],
  ["settled",     "archived"],
  // archived → previousStatus handled by a separate branch (see below).
];
```

`validateTransition`:
1. If `from === "archived"`: require `previousStatus` ∈ `{in_progress, settling, settled}` and `to === previousStatus`. Else `INVALID_STATE_TRANSITION`.
2. Else: `to !== from` and `[from, to]` must appear in `ALLOWED`. Else `INVALID_STATE_TRANSITION`.

`getValidTransitions`:
- If `from === "archived"`: return `[previousStatus]` if `previousStatus` is a valid recoverable state, else `[]`.
- Else: return every `to` such that `[from, to]` is in `ALLOWED`.

Keep both functions trivially derived from the same table — do not let the two implementations diverge.

**Why no side-effects / no trigger enum here:** the matrix in `docs/07-business-logic.md` documents per-row side effects (delete payments, reset paid marks, skip balance recheck, single vs. dual changelog entries) and trigger reasons (`payment_unmarked`, `manual_rollback`, etc.). Encoding all of that here would push this module into action-layer territory and force every future Server Action to import a fat metadata bundle just to validate a binary question. Validity is the question this module answers; effects are the action's responsibility.

**TypeScript discipline:** the `SessionStatus` union is already authoritative in `src/lib/sessions/types.ts`. Do not redefine it here. The cross-product test is most cleanly written by iterating `["in_progress", "settling", "settled", "archived"] as const` — keep the source of truth single.

## Open questions

None — the matrix is fully specified. Ready for review.

## Links

- `docs/07-business-logic.md` — canonical state-transition matrix and rules
- `docs/05-data-model.md` — `Session.status` and `Session.previous_status` fields
- `docs/09-test-strategy.md` — TDD policy
- `specs/changes/0006-settlement-algorithm.md` — sibling parallel slice covering the *settling preconditions* rule

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Implemented | `src/lib/sessions/transitions.ts` + `transitions.test.ts` landed; `npm run check` green (165 tests) |

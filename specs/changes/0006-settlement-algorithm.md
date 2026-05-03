# Change 0006: Settlement Algorithm

## Status
Implemented

## Owner
Michi Kono

## Goal

Implement the pure-logic settlement library — net-balance computation, shortfall absorption, greedy minimum-transactions matcher, and the `settling` precondition validator — as a self-contained module in `src/lib/settlement/`, fully covered by unit tests.

## Context

The business logic for settlement is fully specified in `docs/07-business-logic.md` (rules `shortfall-absorption-before-settlement`, `minimum-transactions-algorithm`, `settlement-sum-to-zero`, `settling-requires-balance`, `settling-requires-all-cashouts`). The doc explicitly calls this out as the "highest-value TDD target."

The eventual consumer is the `transitionToSettling` server action (a later spec). That action will read player/buy-in/cash-out data inside a Firestore transaction, call into this library to compute Payments, then write Payment docs and update session status — all atomically. Splitting the pure algorithm out now lets us:

- Develop it test-first, in isolation, against the worked examples in `docs/07-business-logic.md`.
- Run it in parallel with spec 0005 (session creation) — no shared files, no Firestore reads/writes, no UI.
- De-risk the part of the system where bugs corrupt money.

Relevant docs: `docs/07-business-logic.md`, `docs/05-data-model.md`, `docs/09-test-strategy.md`.

## User-visible behavior

None directly. This is an internal library. Behavior becomes user-visible when a later spec wires `transitionToSettling` and the settling modal.

## Non-goals

- The `transitionToSettling` server action and Firestore transaction — separate spec.
- Writing Payment documents to Firestore — separate spec.
- Changelog entries — separate spec.
- The settling modal UI, balance preview, or `BALANCE_OUT_OF_RANGE` surfacing — separate spec.
- Auto-settle / auto-unsettle transitions and Payment-mark mutations — separate spec.
- Currency parsing/formatting (`src/lib/currency/`) — separate spec; this library accepts integer cents only.
- Property-based testing infrastructure (e.g., `fast-check`) — randomized tests are done with a hand-rolled seeded RNG; introducing a property-test framework is a future decision.

## Data model impact

None. This library is pure: it accepts plain TypeScript inputs (player records with integer cents) and returns plain TypeScript outputs (a list of `{fromPlayerId, toPlayerId, amountCents}` payments). No Firestore reads or writes, no schema, no indexes.

The library's `PlayerInput` type is structurally compatible with — but not identical to — the eventual Firestore Player + BuyIn aggregation. Mapping from Firestore documents to `PlayerInput` is the consumer's job.

## Diagram impact

None. `docs/07-business-logic.md` already contains the state diagram and algorithm prose; no new diagram is added by this change. The state diagram does not need updating because no transitions or states are introduced.

## API impact

No external API changes. The library exports the following internal TypeScript surface from `src/lib/settlement/`:

```ts
export type PlayerInput = {
  id: string;
  createdAtMs: number;        // epoch ms; used for deterministic tie-breaks
  totalBuyInCents: number;    // sum of all buy-ins (positive integer)
  cashOutCents: number | null; // null = not yet set
};

export type Payment = {
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: number;        // positive integer
};

export type SettlingValidationResult =
  | { ok: true }
  | { ok: false; code: "INVALID_INPUT" | "BALANCE_OUT_OF_RANGE";
      missingCashOutPlayerIds?: string[];
      shortfallCents?: number;
      totalBuyInCents?: number;
      totalCashOutCents?: number; };

export function validateSettling(players: PlayerInput[]): SettlingValidationResult;
export function computeSettlement(players: PlayerInput[]): Payment[];
```

`computeSettlement` assumes `validateSettling` has already returned `{ ok: true }`. If called with invalid input it throws an `Error` (this is a programming-error guard, not user-facing — the consumer must validate first).

## Security/privacy impact

None. Pure computation, no data access, no auth touchpoints, no logging of player data.

## Local development impact

None. No new environment variables, no new processes, no setup steps. The library runs in any Node/Vitest/Next.js context.

No new dependencies. (A property-test framework would have been nice for the `settlement-sum-to-zero` invariant, but is intentionally deferred — see Non-goals — to keep the dependency footprint minimal. We use a hand-rolled seeded RNG instead.)

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (Playwright): N/A — this library has no UI surface and no I/O.

Local smoke test: N/A — there is nothing to exercise in the browser. The unit-test suite is the smoke test. The reviewer should spot-check the worked example from `docs/07-business-logic.md` (A=−$100/$0, B=−$100/$198 → one payment A→B for $98) is included verbatim as a test case.

## Test plan

Test-first. Every rule below is implemented after its tests are written and red.

**`validateSettling` (`validate.test.ts`):**
- Empty player list → `INVALID_INPUT` (no players to settle).
- One or more players have `cashOutCents === null` → `INVALID_INPUT`, `missingCashOutPlayerIds` populated.
- `totalBuyInCents === 0` → `BALANCE_OUT_OF_RANGE` (covers the explicit zero-buyin clause from `settling-requires-balance`).
- `totalCashOutCents > totalBuyInCents` (overage) → `BALANCE_OUT_OF_RANGE`.
- Shortfall boundaries: 0%, 1.99%, 2.00%, 2.01% — first three pass, last fails. Use `totalBuyInCents = 10000` for crisp boundary arithmetic.
- Happy path → `{ ok: true }`.

**`computeSettlement` (`compute.test.ts`):**
Drawn directly from `minimum-transactions-algorithm > Tests required` in `docs/07-business-logic.md`:
- 2-player even (A: −100/+100, B: +100/−100 in net terms) → one payment.
- 2-player uneven amounts → one payment, correct direction and amount.
- 3-player chain (A owes B, B owes C) — verify result has at most 2 payments and balances zero out.
- 5-player ring — verify ≤ 4 payments and net per player ends at zero.
- All-zero nets → empty array.
- Single creditor + multiple debtors.
- With shortfall (uses the worked example: A=10000/0, B=10000/19800 → single payment A→B for 9800).
- Zero-shortfall (sum of buy-ins = sum of cash-outs).
- Ties broken deterministically by `createdAtMs ASC` then `id ASC` — assert exact ordering when two players have identical net.
- Single player → empty array.
- Empty player list (only callable after validate passes — covered by the throw-on-bad-input test below).
- Throw-on-bad-input: passing a player with `cashOutCents: null` throws (programming-error guard).

**Shortfall absorption (covered indirectly via `computeSettlement` tests, plus dedicated unit tests on the internal helper):**
- Worked example from the doc reproduces the exact adjusted nets and final payment.
- Rounding-remainder fix: construct an input where proportional scaling produces a 1¢ residual; assert remainder is distributed by smallest-absolute-net first, then `createdAtMs ASC`, then `id ASC`, until `sum(net) === 0`.
- Boundary: shortfall exactly 2% of total buy-in.
- Edge case: all players are creditors (impossible in practice — total buy-in ≥ 0; covered defensively with an assertion + test).

**Invariant test (`compute.test.ts`):**
- Seeded-random fuzz: generate N=1000 valid inputs (1–10 players, random integer buy-ins ≤ $20,000, random cash-outs satisfying the 2% rule). Assert (a) every result has `sum(payment amounts in) === sum(payment amounts out)` per player up to the original net, (b) `payments.length ≤ players.length − 1`, (c) all amounts are positive integers. Use a small hand-rolled seeded LCG so failures reproduce.

No component or integration tests — this library has no UI surface and no I/O.

## Acceptance criteria

- [ ] `src/lib/settlement/` exists with `types.ts`, `validate.ts`, `compute.ts`, and `index.ts` (barrel).
- [ ] All exported types and functions match the signatures in the **API impact** section.
- [ ] `validateSettling` enforces every clause of `settling-requires-balance` and `settling-requires-all-cashouts` from `docs/07-business-logic.md`.
- [ ] `computeSettlement` implements `shortfall-absorption-before-settlement` followed by `minimum-transactions-algorithm` exactly as specified.
- [ ] Tie-break order is `createdAtMs ASC, id ASC` everywhere it matters (debtor/creditor sort, remainder distribution).
- [ ] All amounts in returned `Payment[]` are positive integers; `from` and `to` are distinct; no payment for a zero-net player.
- [ ] Worked example from `docs/07-business-logic.md` (A: 10000/0, B: 10000/19800 → A→B 9800) is present verbatim as a test case and passes.
- [ ] Seeded-random fuzz test (N=1000) passes the three invariants listed in the test plan.
- [ ] `computeSettlement` throws on input with `cashOutCents: null` (defensive guard).
- [ ] No Firestore, React, Next.js, or Node-only API imports in any `src/lib/settlement/*` file.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.
- [ ] No regressions to existing tests.

## Rollout/deployment notes

None. Pure library code with no runtime configuration. Ships unused until a later spec wires `transitionToSettling` to call it.

## Implementation notes

**Suggested file layout:**
- `src/lib/settlement/types.ts` — `PlayerInput`, `Payment`, `SettlingValidationResult`.
- `src/lib/settlement/validate.ts` — `validateSettling()`.
- `src/lib/settlement/compute.ts` — `computeSettlement()` and the internal `absorbShortfall()` and `greedyMatch()` helpers (un-exported but unit-tested via the public surface plus a `__test__` re-export if needed).
- `src/lib/settlement/index.ts` — barrel; re-exports the public types and functions only.
- `src/lib/settlement/*.test.ts` — co-located.

**Algorithm structure (pseudo, not literal code):**
1. `validateSettling(players)` — sum buy-ins, check non-null cash-outs, check 2% rule, return result. No mutation of input.
2. `computeSettlement(players)`:
   a. Compute raw `net[i] = cashOutCents[i] − totalBuyInCents[i]` for each player.
   b. Compute `shortfall = totalBuyIn − totalCashOut`.
   c. If `shortfall > 0`: scale debtor losses proportionally (`Math.round((-net[i] / totalDebt) * shortfall)`); fix remainder one cent at a time using the documented tie-break order until `sum(net) === 0`.
   d. Greedy match: sort creditors desc by net (tie: createdAtMs ASC, id ASC); sort debtors desc by `-net` (same tie); zip largest-against-largest, emitting `{from, to, amount: min(-debtorNet, creditorNet)}`; deduct and repeat.
3. Assert `sum(net) === 0` as a precondition before greedy match (throw `Error("settlement-sum-to-zero violated")` if not).

**Determinism:** every sort and every remainder-distribution step must use the documented tie-break (`createdAtMs ASC, id ASC`) so tests are stable. Do not rely on JavaScript's stable-sort default; pass an explicit comparator.

**Integer arithmetic only:** every value in this module is `number` representing cents. Never divide without `Math.round`. Never compare `net[i]` to anything but `0` or another integer-cents value. Adding a runtime `Number.isInteger` assertion at the entry point is cheap insurance.

**Determinism in the fuzz test:** use a tiny LCG with a fixed seed (e.g., `seed = 1`, `next = (a*seed + c) mod m`). Don't pull in a PRNG library.

**Tie-break test scaffolding:** construct two players with identical net but different `createdAtMs` and `id` to assert ordering. The cheapest way to expose internal sort order is to construct an input where the ordering decides the destination of a payment (e.g., one creditor and two debtors with equal debt — the first-tie-broken debtor pays the larger half).

## Open questions

None — the algorithm is fully specified in `docs/07-business-logic.md`. Ready for review.

## Links

- `docs/07-business-logic.md` — canonical algorithm and rule definitions (sections: `shortfall-absorption-before-settlement`, `minimum-transactions-algorithm`, `settlement-sum-to-zero`, `settling-requires-balance`, `settling-requires-all-cashouts`)
- `docs/05-data-model.md` — Player, BuyIn, Payment shapes
- `docs/09-test-strategy.md` — test categorization
- `docs/12-mvp-scope.md` — MVP requires "minimum number of transactions necessary to settle all balances"
- `specs/decisions/0005-monetary-amounts-as-integer-cents.md` — integer-cents convention this library obeys

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved for implementation |
| 2026-05-02 | Implemented | Library landed in `src/lib/settlement/`; all gates pass (`npm run check`) |

# 09 — Test Strategy

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define what is tested, how it is tested, and what constitutes adequate coverage. This doc drives TDD practice and quality gate definitions.

---

## Testing philosophy

- Pure logic, validation, authorization, calculations: test-first (TDD).
- API behavior (Server Actions): test-first or test-alongside.
- UI: test critical user flows with Playwright; lighter coverage on static content.
- Do not test framework internals or trivial pass-throughs.

---

## Test layers

| Layer | Tooling | Location | Required |
|---|---|---|---|
| Unit | Vitest + Testing Library | `src/**/*.test.ts(x)` (co-located) | Yes |
| Integration (data layer) | Vitest + Firebase emulator | `src/**/*.integration.test.ts` | Yes — for all Firestore reads/writes |
| E2E | Playwright | `e2e/` | Critical flows only |
| Type safety | TypeScript compiler (`tsc --noEmit`) | — | Yes (via `npm run typecheck`) |

---

## Coverage expectations

- **Settlement calculation logic**: 100% line and branch coverage. This is the highest-value and highest-risk logic in the system.
- **Server-side business rules** (state transitions, balance validation, input validation): full coverage.
- **Firestore read/write paths**: covered by integration tests against the emulator.
- **Critical E2E flows**: create session → add players → record buy-ins → settle up → mark paid.
- **UI components**: not individually coverage-targeted, but critical interactions covered by E2E.

---

## What is not tested

- Framework internals (Next.js routing, React rendering infrastructure)
- Trivial pass-through functions with no logic
- shadcn/ui component internals
- Static UI content (labels, placeholder text)
- Third-party library behavior

---

## Test data strategy

- **Local dev + CI**: use Firebase emulator with the `demo-poker-ledger` demo project. No real Firebase credentials required.
- **Unit tests**: use plain in-memory objects and function calls — no database involved.
- **Integration tests**: each test creates its own data in the emulator and cleans up after itself (`beforeEach` / `afterEach`). Tests are isolated and order-independent.
- **E2E tests**: Playwright seeds sessions and players via the app UI or helper utilities. Emulator is reset between E2E test runs.
- No shared fixture files that accumulate state — each test owns its data.

---

## Mocking strategy

- **Firebase data layer (Firestore, Auth)**: test against the running Firebase emulator. Do not mock Firestore.
- **Everything else**: use `vi.mock()` at the module boundary.
- **Server Actions in unit tests**: call the action function directly with mock Firestore; validate return values and side effects.
- **Server Actions in E2E tests**: drive through the browser UI; let Playwright call the real stack.
- Do not mock the settlement calculation logic — it is pure and should be tested directly.

---

## TDD targets (highest priority)

These must be developed test-first:

1. **Settlement calculation algorithm** (`calculateSettlements`) — see exhaustive case list below
2. **Shortfall absorption** (`absorbShortfall`) — exact 0%, 1%, 2% shortfall; rounding-remainder distribution
3. **2% balance validation** (`isBalancedEnoughToSettle`) — boundary at 0%, 1.99%, 2.00%, 2.01%; total_buy_in = 0
4. **Session state transition validation** (`canTransitionTo`) — every (from, to) pair from the State transition matrix
5. **Player name validation** (`validatePlayerName`) — empty, whitespace, > 50 chars, valid
6. **Buy-in amount validation** (`validateBuyInCents`) — negative, zero, > 2_000_000, valid
7. **Currency input parsing** (`parseDollars`) — every accepted/rejected case in `docs/07 → currency-input-parsing`
8. **Currency display formatting** (`formatCents`) — positive, zero, negative, large values
9. **Session name generation** (`generateSessionName`) — format regex; deterministic via injected RNG; allows same word twice (`bacon-bacon-042`)
10. **Activity log description rendering** — `**$amount**` substring → bold, no other markdown

### Settlement algorithm test cases (high-value)

These cases are non-negotiable. The algorithm is the single highest-risk piece of logic in the system.

- 2 players even (A=+50, B=-50) → 1 transaction
- 2 players uneven (A=+30, B=-30) → 1 transaction
- 3 players, single creditor (A=+100, B=-50, C=-50) → 2 transactions
- 3 players, transitive chain net-zero (A=+50, B=0, C=-50) → 1 transaction (B excluded)
- 5 players ring (A=+10, B=+20, C=+30, D=-25, E=-35) → exactly 4 transactions (one per debtor or creditor minus one)
- All players net-zero → 0 transactions, session goes straight to `settled`
- Single player session → 0 transactions
- With 1% shortfall → absorption applied; resulting net sums to zero exactly; valid transactions
- With 2% shortfall (exact boundary) → absorption applied; valid
- Tied debtors (two debtors with equal -net) → tie broken by `created_at` ASC then `playerId` ASC; deterministic across runs
- Tied creditors → same tie-breaking
- Property test: random valid input → output Payments sum (per debtor) equals their absorbed-net loss; output Payments sum (per creditor) equals their net gain

### Integration / emulator-based tests (data layer)

These require the Firebase emulator. They live in `src/**/*.integration.test.ts`.

- `addBuyIn` writes the buy-in + changelog atomically (verify both exist after success).
- `transitionToSettling` retries on contention. Two parallel calls — exactly one succeeds; the other returns `SESSION_DATA_STALE`.
- `markPaymentPaid` last-payment race — two parallel calls on the last unpaid Payment; one succeeds; session is `settled`; the other is idempotent or sees the post-state.
- `unmarkPayment` while `settled` — same transaction emits `payment_unmarked_paid` + `status_changed`; session is `settling`.
- Manual rollback `settled → settling` resets every Payment's `paid` mark in one transaction; emits one `status_changed` (no individual unmark entries).
- Rollback `settling → in_progress` deletes every Payment doc.
- Player rename does not modify any existing changelog `description`.
- Archive then unarchive of a `settling` session returns to `settling`.
- `displayName.split(' ')[0]` fallback to `"Anonymous"` on a user with no `displayName` — verify changelog `actor_name === "Anonymous"`, never the email.

### E2E (Playwright) — critical flows

E2E coverage is intentionally narrow — three flows must pass; everything else relies on unit/integration coverage.

1. **Happy path**: sign in → create session → add 2 players → record buy-ins for each → set cash-outs → mark as settling → mark all payments paid → session is `settled`.
2. **Rollback flow**: settle a session, unmark a payment, verify auto-unsettle, manually roll back to `in_progress`, verify Payments are gone, re-settle.
3. **Search**: create 3 sessions, search by partial name, navigate via search result.

---

## CI integration

**Current state:** GitHub Actions CI is **not yet configured**. Tests run locally via the pre-commit hook (`lefthook`) and via `npm run check`. CI configuration is deferred to a future change spec — see `docs/16-quality-gates.md` for the current state of automated gates.

**When CI is added** (future spec):
- All unit and integration tests run on every PR push.
- E2E tests run on every PR push (against Playwright + emulator).
- Merge to `main` is blocked if any gate fails.
- Gate configuration lives in `.github/workflows/`.
- Firebase emulator is started in CI using the `demo-poker-ledger` demo project (no credentials required).

---

## Related docs

- `07-business-logic.md`
- `16-quality-gates.md`

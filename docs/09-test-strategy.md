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

1. Settlement calculation algorithm (`calculateSettlements`)
2. 1% balance validation (`isBalancedEnoughToSettle`)
3. Session state transition validation (`canTransitionTo`)
4. Player name validation
5. Buy-in amount validation
6. Session name format and uniqueness logic

---

## CI integration

- All unit and integration tests run on every PR push via GitHub Actions.
- E2E tests run on every PR push (against Playwright + emulator in CI).
- Merge to `main` is blocked if any gate fails.
- Gate configuration lives in `.github/workflows/`.
- Firebase emulator is started in CI using the `demo-poker-ledger` demo project (no credentials required).

---

## Related docs

- `07-business-logic.md`
- `16-quality-gates.md`

# 09 — Test Strategy

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define what is tested, how it is tested, and what constitutes adequate coverage. This doc drives TDD practice and quality gate definitions.

---

## Testing philosophy

- Pure logic, validation, authorization, calculations: test-first (TDD).
- API behavior: test-first or test-alongside.
- UI: test critical user flows; lighter coverage on static content.
- Do not test framework internals or trivial pass-throughs.

## Test layers

| Layer | Tooling | Location | Required |
|---|---|---|---|
| Unit | (TBD) | `__tests__/` or `*.test.ts` | Yes |
| Integration | (TBD) | `__tests__/integration/` | Where feasible |
| E2E | (TBD) | `e2e/` | Critical flows only |
| Type safety | TypeScript compiler | — | Yes (via `typecheck`) |

## Coverage expectations

<!-- Minimum coverage thresholds, if any. Focus on meaningful coverage, not percentage gaming. -->

## What is not tested

<!-- Explicitly document what is out of scope and why. -->

## Test data strategy

<!-- How is test data created? Fixtures, factories, seeded DB? -->

## Mocking strategy

<!-- What is mocked vs. hit for real? External services: mock. Database: real (integration) or in-memory. -->

## CI integration

<!-- Tests run on every push. Failures block merge. -->

## Related docs

- `07-business-logic.md`
- `16-quality-gates.md`

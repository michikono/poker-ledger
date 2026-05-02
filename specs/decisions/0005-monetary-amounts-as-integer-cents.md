# ADR 0005 — Store Monetary Amounts as Integer Cents

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app tracks buy-ins and cash-outs for poker games, including fractional dollar amounts. Quarter-dollar games ($0.25 buy-ins) are a realistic use case. The settlement algorithm sums and subtracts these values to compute net balances and minimum payment amounts.

Floating-point representation of decimal amounts (e.g., `0.1 + 0.2 !== 0.3` in IEEE 754) introduces silent precision errors that compound across calculations. This is unacceptable for financial settlement logic.

## Decision

Store all monetary amounts as **non-negative integers in cents**. `$0.25 = 25`, `$10.00 = 1000`. All arithmetic in the settlement algorithm operates on integers. The display layer divides by 100 and formats as currency.

## Consequences

- No floating-point arithmetic on monetary values anywhere in the system.
- $0.25 games are fully supported without precision issues.
- The settlement algorithm (`calculateSettlements`) operates on integer cents — results are exact.
- The display layer (`formatCents(n: number): string`) is a pure function: `formatCents(25) === "$0.25"`.
- All Server Action inputs that accept monetary amounts use `number` typed as integer cents. The UI layer converts user-entered dollar strings (e.g., `"0.25"`) to cents (`25`) before calling the action.
- Firestore stores cents as `number` — Firestore's `number` type is a 64-bit double, which represents all integers up to 2^53 exactly. At cent precision, this covers amounts up to ~$90 trillion — not a practical limit.

## Alternatives Considered

- **Floating-point dollars**: natural to display, but silent precision errors compound in settlement arithmetic. Rejected.
- **Decimal strings (e.g., `"10.25"`)**: avoids float precision but requires string parsing everywhere and is awkward in Firestore. Rejected.
- **Fixed-point library (e.g., `decimal.js`)**: correct, but adds a dependency and complexity. Integer cents achieves the same correctness with no dependencies. Rejected.

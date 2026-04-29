# 07 — Business Logic

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Document the business rules that govern system behavior. These rules should be expressible as tests. They are the authoritative source for TDD.

---

## Rule format

> **Rule:** [name]
> **Description:** [what it enforces]
> **When violated:** [what happens — error, silent correction, audit log, etc.]
> **Tests required:** Yes

---

## Rules by domain area

### [Domain area 1]

> **Rule:** [name]
> ...

### [Domain area 2]

> **Rule:** [name]
> ...

---

## Authorization rules

<!-- Who can do what? Be explicit. These must all be server-enforced. -->

| Action | Allowed for | Denied for | Notes |
|---|---|---|---|
| | | | |

## Calculation and transformation rules

<!-- Any non-trivial calculations, currency handling, rounding, etc. -->

## Edge cases and invariants

<!-- Business rules that only appear in edge cases. These are high-value TDD targets. -->

## Related docs

- `02-domain-model.md`
- `04-security-threat-model.md`
- `06-api-contract.md`
- `09-test-strategy.md`

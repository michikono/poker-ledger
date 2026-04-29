# Design Review

**Date:**
**Reviewer:**
**Docs reviewed:**

---

## Review purpose

This review adversarially examines the design docs before Phase 1 begins. The goal is to find problems now, not during implementation.

Rate each finding: **Blocking** (must resolve before implementation) or **Advisory** (should resolve but won't block).

---

## Section 1: Ambiguity

> Statements that could be interpreted in more than one way. Implementation teams will make different assumptions.

| # | Location | Finding | Severity | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 2: Contradictions

> Places where two docs say different things, or where a doc contradicts itself.

| # | Location A | Location B | Conflict | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 3: Missing edge cases

> Scenarios not covered by the user flows, business logic, or UX spec. These will surface during implementation and cause spec drift.

| # | Flow/feature | Missing case | Severity | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 4: Hidden product decisions

> Statements that assume a product decision has been made, but it hasn't. These are the most dangerous — implementation proceeds based on an assumption that the product owner hasn't actually made.

| # | Location | Hidden decision | Severity | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 5: Security assumptions

> Security requirements that are implied but not explicitly stated, or security controls that have been assumed but not designed.

| # | Location | Assumption | Risk | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 6: Local development assumptions

> Features or behaviors that would be difficult or impossible to run locally. Dependencies on deployed infrastructure. Gaps in `.env.example`.

| # | Location | Issue | Severity | Resolution |
|---|---|---|---|---|
| | | | | |

---

## Section 7: Missing deterministic gates

> Behaviors described in the docs that have no clear test strategy. Business rules without tests. Auth rules without enforcement checks.

| # | Location | Untestable behavior | Resolution |
|---|---|---|---|
| | | | |

---

## Section 8: Unnecessary scope

> Features or complexity included in the design that are not needed for the MVP. Every extra feature is a liability.

| # | Location | Unnecessary item | Recommendation |
|---|---|---|---|
| | | | |

---

## Section 9: Implementation risk

> Design decisions that will be disproportionately hard to implement, change later, or test. Flag them early.

| # | Location | Risk | Severity | Mitigation |
|---|---|---|---|---|
| | | | | |

---

## Summary

**Blocking findings:**
- [ ] ...

**Advisory findings:**
- [ ] ...

**Recommended actions before Phase 1:**
1. ...

**Overall assessment:**
[ ] Design baseline is ready for Phase 1
[ ] Design baseline is NOT ready — blocking issues must be resolved first

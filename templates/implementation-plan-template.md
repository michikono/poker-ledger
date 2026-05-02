# Implementation Plan

**Change spec:** `specs/changes/NNNN-<name>.md`
**Date:**
**Implementer:**

---

## Purpose

Break the accepted change spec into a concrete, ordered list of steps. Identify every file to touch, every test to write, and every gate to run.

---

## Files to create

| File | Purpose |
|---|---|
| | |

## Files to modify

| File | What changes |
|---|---|
| | |

## Files to delete

| File | Why |
|---|---|
| | |

---

## Tests to write

List tests in TDD order (write test first, then implement):

| Test | Type | File | Behavior being tested |
|---|---|---|---|
| | Unit | | |
| | Integration | | |

---

## Quality gates to run

| Gate | Command | Expected result |
|---|---|---|
| Format | `npm run format:check` | Pass |
| Lint | `npm run lint` | Pass |
| Typecheck | `npm run typecheck` | Pass |
| Tests | `npm test` | Pass |
| Build | `npm run build` | Pass |
| Aggregate | `npm run check` | Pass |

---

## Local verification steps

Steps a developer should take to manually verify the change locally:

1. ...
2. ...

---

## Implementation order

Ordered steps (each step should be small enough to commit independently):

1. [ ] ...
2. [ ] ...
3. [ ] ...

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| | | | |

---

## Rollback notes

If the implementation needs to be reverted:
- Steps to reverse data model changes
- Steps to reverse env var additions
- Steps to restore previous behavior

---

## Spec conformance checklist

Before marking the change spec `Implemented`:

- [ ] All acceptance criteria from the change spec are met
- [ ] All quality gates pass (or failures documented)
- [ ] All tests written and passing
- [ ] Relevant docs updated
- [ ] No out-of-scope changes included
- [ ] Deviations from the spec documented and justified

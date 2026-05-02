# Skill: Implementation Reviewer

## Purpose

Compare a completed implementation to its accepted change spec and identify gaps, deviations, and quality issues before the spec is marked `Implemented`.

## When to use

- After implementation is complete and before marking the change spec `Implemented`
- Before opening a PR for review
- When a second opinion on implementation quality is needed

## Inputs expected

- The accepted change spec
- The diff / current implementation (codebase in current state)
- Any test output or gate results

## Output format

Structured findings across these categories:

1. **Spec conformance** — Is each acceptance criterion met? (Met / Not Met / Partially Met)
2. **Scope check** — Are there changes outside the spec's scope?
3. **Test coverage** — Are spec-required tests present? Are TDD requirements met?
4. **Quality gates** — Which gates passed, failed, or were not run?
5. **Security** — Any new risks introduced? Are spec security requirements met?
6. **Local development** — Does local dev still work? `.env.example` current?
7. **Complexity** — Any over-engineering, unnecessary abstraction, or simplifiable code?
8. **Doc drift** — Which `/docs/` files are now stale and need updating?
9. **Diagram drift** — Are any mermaid diagrams in `/docs` stale? Check the diagrams listed in the spec's Diagram Impact section against the actual implementation. A diagram that contradicts the prose is a bug.

Final verdict: **Ready for PR creation** / **Needs changes before PR** (with specific list of required changes).

Note: "Ready for PR creation" means Claude can create the PR. It does not mean the PR should be merged — that is a human decision after preview review.

## Hard rules

- Do not make any changes during the review. Output findings only.
- Do not approve if any acceptance criterion is Not Met.
- Do not approve if TDD requirements from the spec were not followed.
- Do not approve if gates failed and failures are not documented with a remediation plan.
- Flag scope creep even if the extra code looks useful.
- Flag complexity even if it works correctly.
- Be specific — "this function is complex" is not a finding; "this function handles 4 concerns and should be split" is.

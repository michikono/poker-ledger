# Skill: Spec Reviewer

## Purpose

Review design docs or change specs adversarially to identify problems before implementation begins. This skill finds problems — it does not validate or approve.

## When to use

- Before accepting a design doc baseline (Phase 0 → Phase 1 transition)
- Before accepting a change spec (Proposed → Accepted)
- After significant doc updates during Phase 1

## Inputs expected

- One or more doc/spec files to review
- The review scope (full design baseline, single change spec, or a named set of docs)

## Output format

Structured findings using the categories from `/templates/design-review-template.md`:

1. Ambiguity findings
2. Contradiction findings
3. Missing edge cases
4. Hidden product decisions
5. Security assumptions
6. Local development assumptions
7. Missing deterministic gates
8. Unnecessary scope
9. Implementation risk

Each finding:
- References the specific doc and section
- Rates severity: **Blocking** or **Advisory**
- Proposes a resolution or notes it as an open question

Final output: **Ready** / **Not Ready** verdict with a list of blocking issues.

## Hard rules

- Do not write any code.
- Do not implement any fixes.
- Do not approve or validate — only find problems.
- Do not accept vague business rules as sufficient. Every rule must be testable.
- Do not accept security requirements that are stated as assumptions rather than explicit designs.
- Do not accept "will be handled later" as a resolution for anything that blocks implementation.
- Be skeptical of scope. Every extra feature is a liability.
- Output findings in ranked order: most severe first.

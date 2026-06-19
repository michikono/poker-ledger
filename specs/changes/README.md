# Change Specs

This directory contains versioned change specs for all implementation slices.

## Naming convention

```
NNNN-<short-slug>.md
```

Examples:
- `0001-nextjs-shell.md`
- `0002-auth-model.md`
- `0003-user-onboarding-flow.md`

## Lifecycle statuses

| Status | Meaning |
|---|---|
| Proposed | Drafted, not yet reviewed |
| Accepted | Reviewed and approved for implementation |
| In Progress | Actively being implemented |
| Implemented | **Merged via this PR.** Set in the implementation PR itself (Status line + a history row), not as a separate post-merge edit. |
| Superseded | Replaced by a later spec (link to replacement) |

`## Status` must always equal the latest row of the spec's `## Status history` table. Transitions move forward through the ranks (forward skips like `Proposed → Implemented` are allowed); a backward move must carry an annotation (e.g. `In Progress (rebase)`); `Superseded` is terminal. These invariants are enforced by `scripts/spec-status-guard.mjs` (spec 0031), which runs in `pre-commit`, `npm run check`, and CI.

## Rules

- A change spec must reach `Accepted` before implementation begins (enforced at the PR boundary by `scripts/pr-spec-reference.mjs`).
- One accepted change spec is implemented at a time.
- Scope is strictly bounded by the spec — no additions without updating the spec first.
- The implementation PR marks the spec `Implemented` (status flip + history row) **in the PR**, and updates durable docs in the same change — don't leave the flip as a post-merge step.
- Do not delete specs — they are historical records.

## Template

See `/templates/change-spec-template.md`.

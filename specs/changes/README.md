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
| Implemented | Implementation accepted and merged |
| Superseded | Replaced by a later spec (link to replacement) |

## Rules

- A change spec must reach `Accepted` before implementation begins.
- One accepted change spec is implemented at a time.
- Scope is strictly bounded by the spec — no additions without updating the spec first.
- After implementation, the spec is marked `Implemented` and durable docs are updated.
- Do not delete specs — they are historical records.

## Template

See `/templates/change-spec-template.md`.

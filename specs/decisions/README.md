# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for durable technical and architectural choices.

## Naming convention

```
NNNN-<short-slug>.md
```

Examples:
- `0001-use-vercel-for-hosting.md`
- `0002-use-server-mediated-database-access.md`
- `0003-use-server-actions-for-mutations.md`

## When to create an ADR

Create an ADR for:
- Durable architectural choices (framework, database, auth provider, API style)
- Major dependency additions
- Vendor coupling decisions
- Any decision that weakens local development capability
- Any decision that weakens deterministic testing capability
- Any deviation from the conventions defined in `CLAUDE.md`

## ADR format

See `/templates/adr-template.md`.

## Rules

- ADRs are permanent records. Mark as `Superseded` and link to the replacement rather than deleting.
- ADRs should be short: context, decision, consequences, alternatives considered.
- Every durable decision made during Phase 1 implementation must be documented in an ADR.

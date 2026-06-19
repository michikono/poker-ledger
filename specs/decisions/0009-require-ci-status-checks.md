# 0009 — Require CI status checks (including the spec gate) on `main`

- Status: Accepted
- Date: 2026-06-19
- Deciders: Michi Kono

## Context

Change spec 0031 added two deterministic guards and wired them into a CI job named **`Spec Status & Reference`** (the "spec gate"):

- `scripts/spec-status-guard.mjs` — validates that every `specs/changes/NNNN-*.md` is internally consistent (valid status enum, `## Status` matches the latest history row, legal transitions, monotonic dates).
- `scripts/pr-spec-reference.mjs` — fails a PR that lands tracked source without an `Accepted`+ spec behind it.

These run locally (`pre-commit`, `npm run check`) and in CI. But CI jobs only *block a merge* when they are configured as **required status checks** in the branch's protection settings. Until that configuration exists, the spec gate — and the pre-existing jobs (`Type Check & Lint`, `Unit Tests`, `Emulator Tests`, `E2E Tests`) — are **advisory**: a PR can go red and still be merged (including via auto-merge), which defeats the point of a deterministic gate.

That configuration lives only in GitHub repo settings, not in any tracked file, so it is invisible in the codebase and easy to lose or silently change. This ADR records the decision and its rationale so the protection posture is documented alongside the rest of the operating model (spec 0031 flagged "make `spec-gate` a required check" as a deferred, owner-owned decision).

## Decision

On the `main` branch, mark all five CI jobs as **required status checks** that must pass before a PR can merge:

- `Spec Status & Reference`
- `Type Check & Lint`
- `Unit Tests`
- `Emulator Tests`
- `E2E Tests`

Additionally:

- **No bypass.** The protection applies to everyone, administrators included — classic branch protection: "Do not allow bypassing the above settings" enabled; rulesets: an empty Bypass list. There is no admin escape hatch around a red gate.
- **Up-to-date branches** are required before merging, consistent with the existing "rebase onto latest `origin/main` before enabling auto-merge" step in CLAUDE.md. Auto-merge defers to these gates rather than bypassing them.

This change is made entirely in GitHub settings; no tracked file changes. The required-check identifiers are the **job names** from `.github/workflows/ci.yml`, so renaming a job there is a breaking change to branch protection and must be done deliberately.

## Consequences

- A PR that touches tracked source without an `Accepted` spec, or whose spec status is self-inconsistent, **cannot merge** — the spec-first and status-integrity rules are now enforced mechanically, not just by review.
- The same hard gate now applies to type-checking, lint, unit, emulator, and e2e — green CI is a true precondition for merge.
- **Coupling to job names.** Required checks are matched by the workflow job name; renaming `Spec Status & Reference` (or any of the five) in `ci.yml` silently removes that required check until branch protection is updated to match. Treat job renames as a two-step change.
- A genuinely stuck PR (e.g. a flaky emulator/e2e job) has no admin override, so the remedy is to fix or re-run the job, not to force-merge. This is the intended trade-off of the no-bypass posture.
- Auto-merge still works — it simply waits for all five checks before merging.

## Alternatives considered

- **Keep the gate advisory (status quo).** Rejected: the gate exists but never blocks, so wrong-status specs and spec-less code can still merge — the exact failure spec 0031 set out to prevent.
- **Require only the spec gate.** Rejected: the other four jobs were already running; leaving them non-blocking means a PR can merge with failing tests or lint. If all are run anyway, all should gate.
- **Allow admin bypass.** Rejected for now in favor of the strict posture; a single committer with bypass rights reintroduces the silent-merge risk. Revisit if a recurring flaky-CI problem makes an escape hatch necessary (and document that reversal as a follow-up ADR).

## Impact on local development

None. This is a remote (GitHub) merge gate only. Local development, `npm run check`, and the `pre-commit` hooks are unchanged; the same checks simply now also block merges.

## Impact on quality gates

Promotes the five CI jobs from advisory to **merge-blocking** required checks. Adds no new gate or code path; it changes enforcement, not the checks themselves.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-19 | Accepted | Owner enabled required status checks on `main` for all five CI jobs (incl. the spec gate from spec 0031) and chose the no-bypass posture. Recorded here because the configuration lives only in GitHub settings. |

---
name: spec
description: Drive this repo's spec-first workflow end-to-end for any non-trivial change (including UI-only tweaks like a button color). Drafts an Accepted change spec from the template, then implements it on a worktree with TDD, quality gates, and an auto-merged PR. Use whenever the user asks for a code or behavior change and no Accepted change spec exists yet.
---

# Spec-driven change

This skill runs the operating model in `CLAUDE.md` as an explicit, ordered procedure so the spec gate is never skipped. It **references** the source-of-truth docs — it does not restate them. Read those as you go; do not duplicate their content.

## Non-negotiable framing

- **No code edits until an `Accepted` spec exists.** "Non-trivial" is about user-visible effect and risk, not diff size — a button color, label, or spacing change still needs a spec (CLAUDE.md rule #1). Only docs-only and pure-scaffolding changes are exempt.
- **One spec at a time**; do not expand scope beyond it (rules #2–#3). If scope must grow, stop and update the spec first.
- Human acceptance of the spec is required — this skill **pauses** for it and never self-accepts.

## Procedure

### 1. Understand before drafting
- Read `CLAUDE.md`, the relevant `/docs` (architecture, domain model, UX spec, API contract, data model — `docs/02`–`docs/08`), and `templates/change-spec-template.md`.
- Skim `skills/change-spec-writer.md` and `prompts/02-create-change-spec.md` for the drafting standard.

### 2. Draft the change spec — then STOP
- Pick the next `NNNN` (highest in `specs/changes/` + 1). Create `specs/changes/NNNN-<slug>.md` from `templates/change-spec-template.md`, status `Proposed`.
- Fill every required section: Goal, Context, User-visible behavior, Non-goals (explicit), Data/Diagram/API/Security/Local-dev impact, Quality gates table, Test plan (TDD targets), Acceptance criteria (each individually verifiable), Open questions.
- For UI changes, state how the mobile-first hard requirements (CLAUDE.md "Mobile-first UX") are met.
- **Present the spec and stop.** Wait for the human to accept it (resolve blocking Open questions first). Do not edit code yet.

### 3. On acceptance — set up the worktree
- Mark the spec `Accepted` (update Status + a Status-history row).
- Create/enter a worktree on a feature branch (`docs/spec/feature/fix/chore` per the slug). Follow `skills/worktree-guide.md` and `docs/17-worktree-workflow.md`.
- **Confirm `pwd` and `git branch --show-current` (≠ `main`) before the first edit** (rule #11). Never edit from the main checkout.

### 4. Implement against the spec
- TDD (red → green → refactor) for pure logic, validation, authorization, calculations, data transforms; test-alongside for Server Actions / API behavior (`docs/16` "TDD expectations").
- Stay within the spec's scope and Non-goals. Match surrounding code style (Biome-enforced; see CLAUDE.md "Conventions").
- Ship tests in the same change.

### 5. Gates, then PR + auto-merge
- Run `npm run check` (format, lint, type-check, test, build). It must pass, or document failures with a remediation plan.
- Then follow the completion flow in `skills/worktree-guide.md`: `git fetch origin` + rebase onto the latest `origin/main`, push, `gh pr create` (PR body: spec link, summary, acceptance criteria, gates run, local-dev impact, deployment notes, known limitations), then `gh pr merge <n> --auto --rebase`.
- If a clean rebase isn't possible at PR time because CI / a dependency PR is still in flight, **schedule a follow-up** (`/schedule`) to rebase and enable auto-merge once it clears — don't leave the PR un-mergeable.

### 6. Review and close out
- Run the spec-conformance review (`prompts/04-review-implementation.md` / `skills/implementation-reviewer.md`): compare to the spec, flag deviations / missing gates / missing tests / scope creep / local-dev regressions; confirm diagrams match prose.
- **Mark the spec `Implemented` in the implementation PR itself** — update the `## Status` line *and* add a `## Status history` row (`Implemented` = "merged via this PR"). Don't leave this as a post-merge step: `scripts/spec-status-guard.mjs` requires `## Status` to match the latest history row, so the flip is part of the change. Update affected `/docs` in the same PR so durable docs reflect reality.

## Hard rules

- Refuse to start editing code until step 2's spec is `Accepted`.
- Never expand scope beyond the accepted spec without updating it first.
- Mobile-first is mandatory for every UI change (CLAUDE.md "Mobile-first UX").
- No new dependencies without justification in the spec or an ADR.
- Never commit/push to `main`; never force-merge or bypass branch protection.
- Scan staged content for secrets before committing (the `pre-commit` `secret-scan` enforces this; don't rely on it alone).

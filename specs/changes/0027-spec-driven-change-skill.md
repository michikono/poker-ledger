# Change 0027: Invokable `/spec` spec-driven-change skill

## Status
Implemented

## Owner
Michi Kono

## Goal

Provide an invokable `/spec` Claude Code skill that drives this repo's spec-first workflow end-to-end — read context, draft a change spec from the template, pause for acceptance, implement against it with tests, run gates, open a PR and enable auto-merge — so the process the usage report found Claude skipping becomes a single, hard-to-skip command.

## Context

The 2026-06-11 report's top friction was Claude bypassing the mandatory spec-first process; its top recommendation was a Custom Skill that standardizes "audit → draft spec → implement with tests → pass gates → open PR." The repo already has the pieces as guidance (`skills/change-spec-writer.md`, `skills/implementation-planner.md`, `skills/implementation-reviewer.md`, `prompts/02`–`prompts/04`) but nothing invokable that *chains* them into one runnable path. `/spec` composes the existing guidance; it does not duplicate it.

This change depends on **ADR 0008** (track a shared `.claude/skills/` directory), which it carries: an invokable skill must live under `.claude/skills/`, and that directory is currently gitignored. ADR 0008 extends the ADR 0007 exception so the skill is shared and travels into worktrees.

It also assumes the rules clarified in **change 0026** (spec-first triviality, worktree-entry confirmation, the hardened auto-merge flow), which the skill encodes as concrete steps.

## User-visible behavior

Typing `/spec <intent>` makes Claude run the operating model as an explicit sequence:

1. **Refuse to edit code until a spec exists.** First read CLAUDE.md, the relevant `/docs`, and `/templates/change-spec-template.md`.
2. **Draft the spec.** Pick the next `NNNN`, write `specs/changes/NNNN-slug.md` from the template (Status `Proposed`), and present it for acceptance. Stop and wait — acceptance is human-controlled.
3. **On acceptance:** mark the spec `Accepted`; create/confirm a worktree and feature branch; confirm `pwd` + `git branch --show-current` (≠ main) before editing.
4. **Implement against the spec** with TDD for pure logic/validation/authorization/calculations, test-alongside for API behavior.
5. **Gates + PR.** Run `npm run check`; on green, `git fetch origin` + rebase onto `origin/main`, push, `gh pr create`, then `gh pr merge --auto --rebase` (per the change 0026 flow, including the scheduled-rebase fallback if blocked by in-flight CI).
6. **Review + close out.** Run the spec-conformance review (`prompts/04`) and mark the spec `Implemented` after merge.

The value is that each step is named and ordered, so the spec gate cannot be silently skipped, and the "trivial-looking change" loophole is closed by step 1.

## Non-goals

- **The enforcement hooks** that would mechanically block edits lacking a spec — change 0028. `/spec` is a guided path, not a guard.
- **Migrating the existing `skills/*.md` library into invokable skills.** Only `/spec` is added now; the SKILL.md references the existing docs rather than replacing them.
- **Bypassing human acceptance.** The skill must pause at step 2 for the spec to be accepted; it never self-accepts and proceeds.
- **Duplicating the operating model** into the skill. The SKILL.md links to CLAUDE.md, `/templates`, `/prompts`, and `/skills` as the single source of truth.

## Data model impact

None.

## Diagram impact

None in `/docs`. The skill may contain its own short ordered step list; that is internal to the skill, not a `/docs` mermaid diagram.

## API impact

None.

## Security/privacy impact

Governed by ADR 0008: the skill is world-readable and must be secret-free, with no per-user or machine-specific paths and no embedded grant of outward-facing commands. The skill *describes* `gh pr create`/auto-merge; the permission to run those stays in tier-1/tier-3 settings.

## Local development impact

None negative. Because ADR 0008 tracks `.claude/skills/`, the skill travels into every worktree, so `/spec` is consistently available. No env var, dependency, or service change.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Skill smoke test | Manual — see Test plan | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

The skill is markdown plus a `.gitignore`/ADR change — no new code path, hence no new automated test surface. Behavior is verified by the manual smoke test.

## Test plan

No automated tests (markdown skill + config). Manual smoke test:

1. After adding the `.gitignore` exception and the skill, confirm `/spec` is discoverable (appears in the available-skills list) and invokable.
2. Invoke `/spec <trivial intent>` and confirm it **refuses to edit code first**, reads the template, drafts `specs/changes/NNNN-slug.md` as `Proposed`, and **pauses for acceptance** instead of implementing.
3. Confirm the drafted spec uses all required template sections.
4. Confirm the skill, when continued, confirms worktree/branch before editing and references the change-0026 auto-merge flow (does not invent its own).
5. Confirm a fresh worktree created from this branch contains `.claude/skills/spec/SKILL.md` (i.e. it is tracked and travels).
6. `npm run check` passes.

## Acceptance criteria

- [ ] `.gitignore` has the `!.claude/skills/` + `!.claude/skills/**` exceptions (ADR 0008).
- [ ] ADR 0008 is `Accepted`.
- [ ] `.claude/skills/spec/SKILL.md` exists, is tracked, and drives the read → draft → accept → implement → gates → PR → auto-merge → review sequence.
- [ ] The skill **references** `/templates/change-spec-template.md`, the relevant `/skills/*.md`, `/prompts`, and CLAUDE.md rather than duplicating them.
- [ ] The skill pauses for human acceptance before implementing and confirms worktree/branch before editing.
- [ ] `skills/README.md` documents the `skills/` (reference) vs `.claude/skills/` (invokable) distinction and lists `/spec`.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No deployment impact. On merge, `/spec` becomes available to anyone who clones the repo or creates a worktree.

## Implementation notes

- Keep the SKILL.md lean: an ordered procedure with links, not a re-statement of the operating model. The single source of truth stays in CLAUDE.md / `/templates` / `/prompts`.
- Use the standard SKILL.md frontmatter (name, description) so it is discovered as an invokable skill.
- The skill's PR/auto-merge step must defer to change 0026's documented flow (fetch/rebase first, scheduled-rebase fallback) — do not encode a divergent procedure.
- Sequence: land ADR 0008 + the `.gitignore` change with the skill in this slice; recommended after 0026 so the skill can reference the finalized rules.

## Open questions

1. Should `/spec` also offer a "spec-only" mode (draft + accept, stop before implementing) for when the user wants to batch-author specs? Non-blocking; default to the full path with an explicit stop at acceptance, which already covers it.
2. Whether to add a thin `.claude/skills/` README documenting the secret-free constraint inline. Non-blocking; ADR 0008 + `skills/README.md` cover it.

## Links

- `specs/decisions/0008-track-claude-skills.md` (carried by this slice)
- `specs/decisions/0007-commit-shared-claude-settings.md`
- `skills/change-spec-writer.md`, `skills/implementation-planner.md`, `skills/implementation-reviewer.md`, `skills/worktree-guide.md`
- `prompts/02-create-change-spec.md`, `prompts/03-implement-change-spec.md`, `prompts/04-review-implementation.md`
- `templates/change-spec-template.md`
- Change 0026 (operating-model rules), Change 0028 (enforcement hooks)
- 2026-06-11 `/insights` usage report

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft. Depends on ADR 0008 and the rules in change 0026. |
| 2026-06-18 | Accepted | Owner accepted. Tracks `.claude/skills/` via ADR 0008. |
| 2026-06-18 | Implemented | `.gitignore` exempts `.claude/skills/`; `/spec` skill added; `skills/README.md` documents reference-vs-invokable; CLAUDE.md points to `/spec`. Sequenced after 0028 per owner. |

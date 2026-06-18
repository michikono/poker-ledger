# Change 0026: Operating-model deltas + hardened auto-merge flow

## Status
Accepted

## Owner
Michi Kono

## Goal

Close the recurring process gaps surfaced by the 2026-06-11 usage report by making the spec-first rule, worktree-entry confirmation, settings hygiene, and a hardened `gates → fetch/rebase → enable auto-merge` flow explicit in CLAUDE.md and the supporting docs/skills — integrating only the deltas, not duplicating rules that already exist.

## Context

The 2026-06-11 `/insights` report flagged four recurring frictions:

1. **Spec skipped for "trivial-looking" edits.** Claude jumped straight to editing code for a button-color change instead of drafting the required spec, then had to revert. The lesson is not "add a spec rule" (rules #1–#3 already require one) but that the *triviality boundary* was misjudged: a UI-only tweak still needs a spec.
2. **Worktree created but session anchored to main.** Claude set up a worktree but kept editing in the main checkout, so changes didn't land where expected. `skills/worktree-guide.md` already says "verify before doing anything," but CLAUDE.md itself does not mandate confirming you are *inside* the worktree before editing.
3. **Wildcard Bash permission re-added.** A dangerous arbitrary-execution grant (`Bash(node *)`) was re-introduced via a validation command. No CLAUDE.md rule distinguishes a safe argument-wildcard from an arbitrary-execution wildcard.
4. **Auto-merge flow undocumented.** The "enable auto-merge after every PR" practice lives only in user memory, not in CLAUDE.md, and it omits two preconditions the user now requires: the branch must be current with `main` before auto-merge (GitHub blocks auto-merge when the branch is behind a protected base), and if a clean rebase isn't possible at PR time (CI/another PR still in flight) a follow-up rebase must be **scheduled** rather than dropped.

This slice is the rules layer. The invokable `/spec` skill (change 0027) and the enforcement hooks (change 0028) build on the rules established here.

## User-visible behavior

"User" here is Claude Code and any contributor reading the operating model. After this change:

- **Spec-first triviality is closed.** The spec-first rules state explicitly that UI-only or otherwise "small-looking" changes (e.g. a color/spacing tweak) are **not** exempt; the only exemptions remain the already-listed docs-only and scaffold-only changes.
- **Worktree entry is confirmed.** A rule requires, after creating or entering a worktree, confirming `pwd` and `git branch --show-current` (≠ `main`) before the first edit, and never editing from the main checkout while implementing a slice.
- **Settings permission hygiene is defined.** A rule forbids wildcard grants that permit *arbitrary code execution* — bare interpreters/shells (`Bash(node *)`, `Bash(python *)`, `Bash(sh *)`, `Bash(bash *)`, `Bash(eval *)`) and unscoped runners (`Bash(npx *)`, `Bash(* *)`) — while permitting argument-wildcards scoped to a specific safe subcommand (e.g. `Bash(npm test *)`). It also requires settings keys at their schema-correct nesting and that `.claude/settings.json` parses before commit.
- **Auto-merge flow is documented and hardened.** The standard completion flow becomes: run gates → `git fetch origin` and rebase the branch onto latest `origin/main` → `gh pr create` → `gh pr merge <n> --auto --rebase`. If a clean rebase is not possible at PR time because CI or a dependency PR is still in flight, Claude **schedules a follow-up** (via `/schedule`) to rebase-and-enable-auto-merge once the blocker clears, rather than leaving the PR un-mergeable.
- **The Claude-merge prohibition is removed.** Old rule #12 ("Claude must not merge PRs") is rewritten to permit creating PRs and enabling auto-merge under branch protection; the "a human merges" language in CLAUDE.md, `docs/17-worktree-workflow.md`, and `skills/worktree-guide.md` is updated to match. Rules #11 (never push to `main`) and #13 (never force-push) still hold.

## Rule change: remove the Claude-merge prohibition

CLAUDE.md rule #12 currently reads "Claude may create PRs (`gh pr create`); Claude must not merge PRs unless explicitly instructed." The owner has decided this prohibition is wrong — Claude is trusted to manage the full change lifecycle, including merging. This spec **removes the merge prohibition** (it does not merely reconcile its wording). Rule #12 is rewritten **in place** (keeping the slot, so rule numbering 1–14 is stable) to:

> **12.** Claude may create PRs (`gh pr create`) and enable auto-merge (`gh pr merge --auto`). Merges are governed by GitHub branch protection (required status checks and any required reviews); Claude must not bypass those protections or force-merge.

The statements that echo the old prohibition are updated in the same pass so the operating model is internally consistent:

- CLAUDE.md "Git & worktree workflow" section ("a human merges").
- `skills/worktree-guide.md` ("Never merge a PR. Merging is human-controlled.").
- `docs/17-worktree-workflow.md` prose and the lifecycle flowchart's "Human merges?" decision node.

Rules #11 (never commit/push to `main`) and #13 (never force-push) are unaffected and still hold — removing the merge prohibition does not loosen those.

## Non-goals

- **The enforcement hooks** that mechanically block/warn on these rules — that is change 0028. This slice is documentation only.
- **The `/spec` invokable skill** — change 0027.
- **Rewriting unaffected CLAUDE.md sections** or restating rules already present; only deltas are added.
- **Adding outward-facing commands** (`gh pr merge`, `git push`) to the shared `.claude/settings.json` allowlist. ADR 0007 forbids that; the auto-merge *procedure* is documented, the *permission* stays in tier-1/tier-3.
- **Configuring GitHub branch protection.** This spec documents the flow that assumes protection exists; it does not change repo settings on GitHub.

## Data model impact

None.

## Diagram impact

- `docs/17-worktree-workflow.md` — the worktree lifecycle `flowchart` is updated so the path after `npm run check` includes `git fetch + rebase onto origin/main` before `gh pr create`, and a branch for "rebase blocked by in-flight CI → schedule follow-up rebase." The prose and diagram must stay in lockstep (the diagrams rule).

## API impact

None.

## Security/privacy impact

None directly. The settings-hygiene rule reduces the chance of granting an over-broad arbitrary-execution permission on a public, world-readable settings file, which is a mild security improvement. No auth, data exposure, or secret handling changes.

## Local development impact

None. Process/documentation only; no setup, env var, or local-only behavior changes.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Doc-consistency review | Manual — see Test plan | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

This is a documentation change: no new code, hence no new automated test surface. The substantive verification is the manual doc-consistency review below.

## Test plan

No automated tests (pure documentation). Verification is a manual doc-consistency review:

1. Each of the four deltas appears in CLAUDE.md and reads consistently with the surrounding rules (no contradiction with rules #1–#14).
2. The rule #12 reconciliation is applied exactly as accepted; no other Non-negotiable rule is silently altered.
3. `docs/17-worktree-workflow.md` prose **and** the mermaid `flowchart` both reflect the fetch/rebase-before-auto-merge step and the scheduled-rebase fallback (diagrams rule).
4. `skills/worktree-guide.md` reflects the same auto-merge flow and the reconciled "enable auto-merge ≠ merge" stance.
5. `npm run check` passes (markdown does not break format/lint/build).

## Acceptance criteria

- [ ] Spec-first rules state explicitly that UI-only / "trivial-looking" changes are not exempt; exemptions remain docs-only and scaffold-only.
- [ ] CLAUDE.md requires confirming `pwd` + `git branch --show-current` (≠ main) after entering a worktree and before the first edit.
- [ ] CLAUDE.md defines the arbitrary-execution wildcard prohibition vs. permitted scoped argument-wildcards, schema-correct nesting, and "settings.json must parse before commit."
- [ ] CLAUDE.md documents the `gates → fetch/rebase → gh pr create → gh pr merge --auto` flow, including the scheduled-rebase fallback when blocked by in-flight CI.
- [ ] Rule #12's merge prohibition is removed (rewritten in place to permit creating PRs + enabling auto-merge under branch protection); the "a human merges" / "Never merge a PR" statements in CLAUDE.md, `docs/17-worktree-workflow.md`, and `skills/worktree-guide.md` are updated to match.
- [ ] `docs/17-worktree-workflow.md` prose and flowchart updated in lockstep.
- [ ] `skills/worktree-guide.md` updated to match.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No deployment impact. Documentation takes effect on merge to `main`.

## Implementation notes

- Touch only the relevant CLAUDE.md sections: "Non-negotiable rules" (#1/#12 clarifications), "Git & worktree workflow," and "Quality gates"/a settings note. Keep edits surgical.
- Reference the user-memory practices (rebase + `--force-with-lease`, never merge main into a branch, auto-merge every PR) so CLAUDE.md becomes the canonical source rather than memory.
- For the scheduled-rebase fallback, point at the `/schedule` skill as the mechanism; do not hard-code timing — derive it from the blocker (e.g. CI ETA).
- Suggested implementation order: 0026 first (establishes the rules), then 0027 and 0028 can proceed in parallel.

## Open questions

1. Rule #12 — **resolved at acceptance:** the merge prohibition is removed (see "Rule change" above), not reconciled. Owner trusts Claude through merge.
2. Whether to also note the auto-merge flow in `docs/16-quality-gates.md` or keep it solely in `docs/17`/CLAUDE.md — non-blocking; default to `docs/17` to avoid duplication.

## Links

- `CLAUDE.md`
- `docs/17-worktree-workflow.md`, `docs/16-quality-gates.md`
- `skills/worktree-guide.md`
- `specs/decisions/0007-commit-shared-claude-settings.md`
- Change 0027 (`/spec` skill), Change 0028 (enforcement hooks) — build on these rules
- 2026-06-11 `/insights` usage report

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft from the 2026-06-11 usage report. |
| 2026-06-18 | Accepted | Owner accepted; rule #12 merge prohibition removed (not reconciled). |

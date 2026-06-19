# Change 0030: Edit-guard worktree-aware branch resolution

## Status
Implemented

## Owner
Michi Kono

## Goal

Stop the Claude `PreToolUse` edit-guard from falsely denying legitimate source edits when a Claude session is anchored to the `main` checkout but the file being edited lives in a feature-branch worktree.

## Context

Change 0028 shipped the edit-guard at `scripts/claude-edit-guard.mjs`. Its `main()` resolves the "current branch" with `git -C <payload.cwd> branch --show-current`, where `payload.cwd` is the Claude **session** working directory — not the directory of the file being edited. The guard then `decide()`s: if the target is tracked source and the branch is `main`, it hard-denies with "Editing tracked source while on `main`".

This is wrong whenever a session is launched from the main checkout (`~/code/poker-ledger`, branch `main`) but the user is legitimately editing a file inside a worktree on a feature branch (e.g. `~/code/worktrees/poker-ledger-0029/scripts/foo.mjs` on `chore/0029-package-manager-guard`). The guard reads the session cwd's branch (`main`) and denies the edit, making it impossible to use Write/Edit on any `src/`, `scripts/`, or `firestore.rules` file in such a session.

This was discovered while implementing change 0029 (package-manager guard): the guard blocked every `scripts/` edit, and the files had to be written via `Bash` heredoc as a workaround. That workaround is exactly the kind of friction 0028's hooks were meant to remove.

The bug is purely in the **branch-resolution** step (which directory we ask git about), and in the parallel `readSpecs(cwd)` call, which reads `specs/changes` relative to the session cwd rather than the worktree that actually contains the file. The pure decision logic (`decide()`, `hasAcceptedSpecForBranch()`, `branchSpecNumber()`, `isSourcePath()`) is correct and stays unchanged.

## User-visible behavior

- Editing a tracked source file (`src/**`, `scripts/**`, `firestore.rules`) that lives inside a feature-branch worktree is **allowed** (or warned, per the existing no-spec heuristic) even when the Claude session was started from the `main` checkout. Write/Edit work directly; no heredoc workaround.
- Genuinely editing tracked source whose own worktree is on `main` is still **denied** with the existing message — the guard now keys the decision on the file's worktree, so a real on-`main` edit is detected by the file's location, not the session cwd.
- The Accepted-spec presence check reads `specs/changes` from the worktree root that contains the edited file, so the warning reflects the right repo.
- When the file's directory is not inside any git worktree (missing/new path outside a repo), the guard falls back to the existing session-cwd lookup; if neither resolves a branch, the guard stays silent (allow), exactly as before.

## Non-goals

- No change to the pure decision logic: `decide()`, `hasAcceptedSpecForBranch()`, `branchSpecNumber()`, `isSourcePath()` keep their current behavior and existing unit tests.
- No change to the deny-on-`main` policy itself — a real edit to a file whose worktree is `main` is still denied.
- No change to the lefthook hooks (`secret-scan`, `settings-guard`) or any other hook from 0028.
- No change to the `.claude/settings.json` wiring of the hook.

## Data model impact

None.

## Diagram impact

None.

## API impact

None.

## Security/privacy impact

The edit-guard is a local, bypassable, defense-in-depth convenience hook (per 0028 and `docs/16`), not a security boundary. This change narrows a false-positive; it does not weaken the guard: a genuine source edit on a `main` worktree is still denied, because the decision is now keyed on the file's own worktree branch rather than a possibly-unrelated session cwd. No auth, data exposure, or secrets handling is touched.

## Local development impact

Strictly positive: removes a friction that blocked Write/Edit on source files in multi-worktree sessions. No env vars, setup, or local-only behavior change. No new dependencies (uses `node:path` `dirname`, already-imported `node:child_process`/`node:fs`).

## Quality gates

Required gates for this change:

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests and a UI smoke test are N/A — this is a Node tooling script with no app surface. Manual verification: drive the guard with a crafted payload (session cwd `main`, file path inside a feature-branch worktree) and confirm it does not deny.

## Test plan

TDD on the extracted pure resolvers (no real git in unit tests — git access is injected as a function):

- `resolveBranch({ filePath, cwd, gitBranch })`:
  - returns the **file worktree's** branch when the file's directory resolves a branch, even though `cwd`'s branch would be `main` (the regression case).
  - falls back to the `cwd` branch when the file's directory resolves no branch (untracked/missing/outside a repo).
  - uses `cwd` when `file_path` is absent.
  - returns `""` when neither resolves (preserves the existing "not a git repo → stay silent" path).
- `resolveSpecsRoot({ filePath, cwd, gitToplevel })`:
  - returns the file's worktree toplevel when resolvable.
  - falls back to `cwd` when the file's directory has no toplevel.
- A combined assertion: feeding `resolveBranch`'s feature-branch result into `decide()` yields `allow`/`warn`, never `deny` — the end-to-end proof of the fix.

Existing tests for `isSourcePath`, `branchSpecNumber`, `hasAcceptedSpecForBranch`, and `decide` remain green and unchanged.

## Acceptance criteria

- [ ] Branch resolution is keyed on the directory of the edited file (`git -C <dirname(file_path)> rev-parse --abbrev-ref HEAD`), with a documented fallback to the session-cwd lookup when the file path resolves no branch.
- [ ] The Accepted-spec check reads `specs/changes` from the file's worktree root (`git -C <dirname(file_path)> rev-parse --show-toplevel`), falling back to `cwd`.
- [ ] A new unit test covers "session cwd is `main` but file is in a feature-branch worktree → not `deny`".
- [ ] `decide()`, `hasAcceptedSpecForBranch()`, `branchSpecNumber()`, `isSourcePath()` are unchanged and their existing tests still pass.
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.
- [ ] Relevant docs updated (`docs/16-quality-gates.md` guard description, if it specifies cwd-based branch resolution).

## Rollout/deployment notes

None — local tooling script. Takes effect for new Claude sessions once merged to `main` (the committed `.claude/settings.json` already wires the hook).

## Implementation notes

- Extract two pure, testable resolvers that take an injected git accessor:
  - `resolveBranch({ filePath, cwd, gitBranch })` — try `gitBranch(dirname(filePath))` first; if falsy, `gitBranch(cwd)`.
  - `resolveSpecsRoot({ filePath, cwd, gitToplevel })` — try `gitToplevel(dirname(filePath))` first; else `gitToplevel(cwd)`; else `cwd`.
- Keep the real git calls in thin impure wrappers (`gitBranchOf(dir)`, `gitToplevelOf(dir)`) that `try/catch → ""`. Switch the branch call to `rev-parse --abbrev-ref HEAD` (works inside any worktree subdir).
- `readSpecs` takes the resolved root and joins `specs/changes` (unchanged otherwise).
- In `main()`: if `resolveBranch` returns `""`, `process.exit(0)` (preserves the prior "git failed → silent" behavior).
- Pitfall: `git -C <dir>` requires `<dir>` to exist; for a brand-new file in a brand-new directory the dirname may not exist yet → `gitBranchOf` returns `""` and we fall back to cwd. Acceptable.

## Open questions

None blocking.

## Links

- `scripts/claude-edit-guard.mjs`, `scripts/claude-edit-guard.test.mjs`
- `specs/changes/0028-lifecycle-enforcement-hooks.md` — shipped the guard
- `specs/changes/0029-package-manager-guard.md` — where the false-positive was discovered
- `docs/16-quality-gates.md` — guard documentation
- `specs/decisions/0007-*` — settings tiers (hook wiring)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft |
| 2026-06-19 | Accepted | Accepted; branch resolution to use `git rev-parse --abbrev-ref HEAD` (avoids detached-HEAD fallback-to-main false positive) |
| 2026-06-19 | Implemented | Worktree-aware `resolveBranch`/`resolveSpecsRoot` + tests; docs/16 updated; gates green |

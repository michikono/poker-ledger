# Change 0028: Lifecycle enforcement hooks

## Status
Accepted

## Owner
Michi Kono

## Goal

Promote process enforcement that has been applied ad hoc into automatic lifecycle hooks — hard-blocking the deterministic violations (staged secrets, arbitrary-execution wildcard permissions, editing source on `main`) and warning on the heuristic one (no Accepted spec for the current branch) — so violations are caught mechanically instead of by manual vigilance.

## Context

The 2026-06-11 report recommended Hooks for the lifecycle steps the repo enforces by hand. The repo already uses lefthook (`post-checkout` bootstrap, `pre-commit` typecheck/lint/test, `pre-push` fixup-guard) and a shared `.claude/settings.json` (the one place Claude Code hooks can be committed and shared, per ADR 0007).

CLAUDE.md already *mandates* several of these checks in prose — "scan staged content for secrets before every commit," "never add wildcard Bash permissions" (formalized in change 0026), "always work in a worktree feature branch, never main." This change makes them executable.

The user chose **block the deterministic cases, warn on the heuristic case**:

- Deterministic (hard block): staged secrets; arbitrary-execution wildcard grants in `.claude/settings.json`; editing tracked source while on `main`.
- Heuristic (warn only): editing source on a feature branch that has no matching Accepted spec — spec-to-branch matching is a heuristic and must not hard-block legitimate fast work.

This change enforces the rules established in change 0026; it should land after it.

## User-visible behavior

Two hook layers:

**A. lefthook (`pre-commit`) — applies to every contributor and to Claude:**

- `secret-scan` — scans the **staged diff** for high-signal secret patterns (`PRIVATE KEY`, `AKIA`, `AIza`, `sk_live_`, `ghp_`, `xox[bp]-`, and similar). Any match **blocks the commit** with the offending file/line. Bypassable only with `git commit --no-verify` (documented escape hatch for false positives).
- `settings-guard` — when `.claude/settings.json` is staged: (a) fail if it does not parse as JSON; (b) fail if its allowlist contains an arbitrary-execution wildcard grant (`Bash(node *)`, `Bash(npx *)`, `Bash(sh *)`, `Bash(bash *)`, `Bash(eval *)`, `Bash(* *)`, etc.), per the change-0026 definition. Scoped argument-wildcards (`Bash(npm test *)`) pass.

**B. Claude Code hooks (`PreToolUse` on `Edit|Write`, committed in `.claude/settings.json`) — Claude sessions only:**

- `branch-guard` (hard block) — if the edit target is tracked source (e.g. under `src/`) and `git branch --show-current` is `main`, **deny** the edit with a message directing work to a worktree feature branch. Catches both the "editing on main" and the "worktree created but session anchored to main" frictions.
- `spec-presence` (warn only) — on a feature branch, if no `Accepted` spec in `specs/changes/` plausibly matches the branch (by slug), emit a **non-blocking** warning reminding to create/accept a spec first. Never blocks.

Escape hatches (`LEFTHOOK=0`, `git commit --no-verify`) remain, and are documented.

## Non-goals

- **Treating hooks as a security boundary.** They are local, bypassable convenience/consistency checks (same caveat as change 0025). They reduce accidental violations; they do not guarantee anything against a determined actor. CI and review remain the real gates.
- **Adding a new dependency** (e.g. `gitleaks`, `husky`). The scans are implemented with small in-repo Node scripts using `git` + pattern matching, unit-tested with vitest — no new package. A heavier scanner would need its own ADR.
- **Hard-blocking the heuristic spec check.** Per the chosen policy, spec-presence is warn-only.
- **CI-side duplication.** These are local hooks; CI already runs the aggregate gates. (A later spec may mirror secret-scan into CI; out of scope here.)
- **Re-implementing the existing `pre-commit` gates or `fixup-guard`.** Only the new guards are added.

## Data model impact

None.

## Diagram impact

None. Hook behavior is described in prose in `docs/16-quality-gates.md`.

## API impact

None.

## Security/privacy impact

Net positive but **not** a guarantee: the staged-content secret scan reduces the chance of committing a credential to this public repo, and the settings-guard reduces the chance of granting arbitrary execution on a world-readable settings file. Both are local and bypassable (`--no-verify`, `LEFTHOOK=0`); they are defense-in-depth, not a boundary. This is documented so the checks are not mistaken for a guarantee.

## Local development impact

- `pre-commit` gains two fast guards (`secret-scan`, `settings-guard`) — pure greps/JSON-parse over staged content, negligible latency.
- New scripts (`scripts/secret-scan.mjs`, `scripts/settings-guard.mjs`, `scripts/claude-edit-guard.mjs` or equivalent) with co-located vitest tests.
- `.claude/settings.json` gains a `hooks` block (shared, secret-free).
- `docs/16-quality-gates.md` documents the new guards and their escape hatches.
- Escape hatches: `LEFTHOOK=0 git commit …` / `git commit --no-verify` for the lefthook guards; the Claude hooks affect only Claude sessions and are bypassed by the user editing directly.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests (scan/guard logic) | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Hook smoke test | Manual — see Test plan | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Unlike 0025/0026, this change introduces real pure logic (pattern matching, JSON validation, slug matching) and therefore **carries unit tests** (TDD): the detection functions are tested independently of the git/lefthook integration.

## Test plan

**TDD unit tests (co-located):**

- `secret-scan`: matches each high-signal pattern; does not match benign lookalikes (e.g. the placeholder `demo-api-key`, the `.env.local.example` placeholders); handles multi-file staged input.
- `settings-guard`: flags each arbitrary-execution wildcard form; passes scoped argument-wildcards (`Bash(npm test *)`); rejects malformed JSON.
- `claude-edit-guard` (branch-guard + spec-presence logic): blocks a `src/**` edit when branch is `main`; allows on a feature branch; emits a warning (not a block) when no matching Accepted spec is found; matches a spec by slug when present.

**Manual smoke test (integration):**

1. Stage a file containing a fake `AKIA…`/`ghp_…` token → `git commit` is blocked; remove it → commit passes.
2. Stage a `.claude/settings.json` adding `Bash(node *)` → commit blocked; a scoped wildcard passes; malformed JSON blocked.
3. On `main`, have Claude attempt an `Edit` to a `src/**` file → blocked with the worktree message; on a feature branch → allowed.
4. On a feature branch with no matching spec, have Claude edit `src/**` → non-blocking warning appears; with a matching Accepted spec → no warning.
5. Confirm `LEFTHOOK=0` / `--no-verify` bypass the lefthook guards.

## Acceptance criteria

- [ ] `lefthook.yml` has `pre-commit` `secret-scan` and `settings-guard` commands wired to the new scripts.
- [ ] `.claude/settings.json` has a `hooks` block with `PreToolUse` `Edit|Write` guards: branch-guard (block on main for source edits) and spec-presence (warn only).
- [ ] Detection logic lives in small in-repo Node scripts with passing co-located vitest unit tests; no new npm dependency.
- [ ] Arbitrary-execution wildcard definition matches change 0026; scoped argument-wildcards are allowed.
- [ ] `docs/16-quality-gates.md` documents the new guards, that they are not a security boundary, and the `LEFTHOOK=0` / `--no-verify` escape hatches.
- [ ] Manual smoke test in the Test plan passes.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

- No deployment impact — local hooks only. CI clones do not install hooks (consistent with change 0025); CI relies on the aggregate gates.
- After merge, existing worktrees pick up the lefthook changes on the next `npm install` (hook regeneration); the Claude hooks apply as soon as the updated `.claude/settings.json` is present.

## Implementation notes

- Implement detection as pure functions exported from the scripts so they can be unit-tested without spawning git; the thin CLI wrapper reads staged content / args and calls them.
- For `secret-scan`, scan `git diff --cached` content, not whole files, to keep it fast and avoid flagging already-committed history.
- For `settings-guard`, parse the staged blob (`git show :.claude/settings.json`) so it validates exactly what will be committed.
- For the Claude `PreToolUse` hooks, keep the command portable (git + node, no per-user paths); return a deny decision for branch-guard and a non-blocking message for spec-presence. Confirm the exact hook output contract against the current Claude Code hooks schema during implementation.
- Keep spec-presence conservative to avoid warning fatigue — match by branch slug against `Accepted` specs; when in doubt, stay silent rather than nag on every edit.
- Sequence: land after change 0026 (it enforces those rules) and ideally alongside/after change 0027.

## Open questions

1. Exact `PreToolUse` hook output contract (deny vs. warn) — confirm against the installed Claude Code version during implementation. Non-blocking for spec acceptance; resolve before coding.
2. Should spec-presence warn at most once per session to reduce noise? Non-blocking; default to per-edit but conservative matching, revisit if noisy.
3. Which directories count as "tracked source" for branch-guard — default to `src/**`; consider including `firestore.rules`, `scripts/**`. Non-blocking; finalize in implementation.

## Links

- `lefthook.yml`, `.claude/settings.json`
- `docs/16-quality-gates.md`
- `specs/decisions/0007-commit-shared-claude-settings.md`
- Change 0025 (lefthook `post-checkout`) — hook precedent and the "hooks are not a security boundary" note
- Change 0026 (operating-model rules this enforces), Change 0027 (`/spec` skill)
- 2026-06-11 `/insights` usage report

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft. Enforces the rules in change 0026; chosen policy: block deterministic, warn heuristic. |
| 2026-06-18 | Accepted | Owner accepted; policy confirmed: block deterministic, warn heuristic. |

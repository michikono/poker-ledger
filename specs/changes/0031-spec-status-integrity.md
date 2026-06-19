# Change 0031: Spec-status integrity enforcement

## Status
Implemented

## Owner
Michi Kono

## Goal

Stop change specs from drifting into the wrong lifecycle status by (1) adding a deterministic spec-status linter that fails fast on malformed or inconsistent status, and (2) moving the terminal `Implemented` transition inside the implementation PR (gated in CI) instead of relying on a post-merge manual step that is routinely skipped.

## Context

Specs in `specs/changes/` repeatedly end up in the wrong state. Two structural causes, not carelessness:

1. **Status lives in two hand-edited places** — the `## Status` line and the last row of the `## Status history` table — and nothing checks they agree, so they drift.
2. **The terminal transition happens after merge, outside every gate.** The `/spec` skill's last step is "after the PR merges, mark `Implemented`." By then auto-merge has fired and the session is often over, so the flip is the easiest step to drop. This is the dominant cause of specs stuck in `Accepted`/`In Progress`.

The repo already has the right idiom for deterministic guards: small dependency-free `scripts/*.mjs` cores with co-located vitest, wired into `npm run check` and the lefthook `pre-commit` block (`secret-scan` — spec 0028, `lockfile-guard` — spec 0029). This change reuses that idiom for spec status, and adds a CI-side gate (CI exists at `.github/workflows/ci.yml`, running on `pull_request`).

This is the first slice (#1 + #2) of the broader "ensure specs are in the correct state" effort. Periodic reconciliation of already-merged specs left in a non-terminal status (#3) is an explicit non-goal here.

## User-visible behavior

"User" here is a contributor or Claude Code working in the repo (dev-tooling; no app surface changes).

**A. Spec-status linter (`scripts/spec-status-guard.mjs`) — local, runs in `npm run check` and `pre-commit`:**

For every `specs/changes/NNNN-*.md` (spec files only; `README.md` and non-`NNNN` files are skipped), the guard fails with a clear, per-file message when:

- The `## Status` value is not one of the allowed enum: `Proposed`, `Accepted`, `In Progress`, `Implemented`, `Superseded`.
- The `## Status` value does not equal the **Status** cell of the latest (last) row in the `## Status history` table. (Kills the two-places drift.)
- A transition between consecutive `## Status history` rows is illegal (see transition graph below).
- The `Date` cells in `## Status history` are not non-decreasing (monotonic) top-to-bottom.
- The `## Status` section or `## Status history` table is missing/unparseable on a spec file.

It passes silently when every spec is well-formed and self-consistent. Bypassable via the same escape hatches as the other lefthook guards (`LEFTHOOK=0`, `git commit --no-verify`); `npm run check` has no bypass.

**B. PR spec-reference gate (CI, on `pull_request`):**

A new CI job resolves the PR's referenced spec from **two deterministic signals available in the PR**: the head branch slug (e.g. `spec/0031-...`, `feature/0031-...`, `fix/0031-...`, `chore/0031-...`) and the set of `specs/changes/NNNN-*.md` files the PR changes vs. `origin/main`. It **fails the PR** when:

- The branch carries a spec number but no matching `specs/changes/NNNN-*.md` exists, **or** the matching spec's status is still `Proposed` (code must not land for an unaccepted spec). The branch-slug number, when present, is authoritative.
- The branch carries **no** spec number, the PR changes tracked source (`src/**`, `scripts/**`, `firestore.rules`), **and** the PR does not also change an `Accepted`/`In Progress`/`Implemented` spec file — i.e. a code change with no spec reference at all. (This accommodates auto-generated branch names like `claude/...` that don't encode a number but still carry the spec in the diff.)

It passes when: the branch-slug spec is `Accepted`+; or the PR changes an `Accepted`+ spec file; or the PR is docs-/scaffold-only (touches no tracked source) regardless of branch name.

Known limitation (first slice): when the reference comes from a changed spec file rather than the branch slug, the gate confirms *an* Accepted spec is present in the diff, not that it semantically governs the code. The branch-slug path remains the precise binding. Tightening this (e.g. a `Spec:` PR trailer) is a later enhancement.

**C. Redefined `Implemented` + process docs:**

`Implemented` is redefined as **"merged via this PR"**: the implementation PR sets the spec to `Implemented` itself (Status line + a history row), rather than leaving it `Accepted`/`In Progress` for a post-merge edit. `specs/changes/README.md`, `CLAUDE.md`, and the `/spec` skill (`.claude/skills/spec/SKILL.md`) are updated so step 6 flips the status **in the PR**, and the lifecycle table documents the redefinition. This matches what specs 0029/0030 already did in practice (Implemented set in-branch, referencing the PR).

### Transition model (used by the linter)

Statuses are ranked `Proposed (0) < Accepted (1) < In Progress (2) < Implemented (3)`. A consecutive history transition is **legal** when any of:

- it is **forward or same rank** — `rank(to) ≥ rank(from)`. This intentionally allows skipping a rank (e.g. `Proposed → Implemented` for a one-shot slice, `Accepted → Implemented` skipping In Progress), which real specs legitimately do.
- `to` is `Superseded` — reachable from any active state.
- it is a **backward** move whose target cell carries an explicit annotation (a parenthetical, e.g. `In Progress (rebase)`) — a documented, deliberate revert. Spec 0005's `Implemented (premature) → In Progress (rebase)` is the motivating real case.

A transition is **illegal** when it moves backward in rank with **no** annotation on the target (a silent backslide, e.g. `Implemented → Accepted`), or when it leaves `Superseded` (terminal).

This model is deliberately permissive on *forward skips* and strict on *silent backslides* — discovered during implementation: the original strict graph (`Proposed → Accepted → … `) false-positived on 4 existing specs that skip `Accepted` in their history and on 0005's annotated revert. The high-value invariants remain the enum check, the `## Status` ↔ latest-row consistency check, and monotonic dates.

## Non-goals

- **Periodic / post-merge reconciliation (#3)** of specs left in a non-terminal status after their branch already merged. That requires a scheduled job or an on-`main` check and is a separate follow-up slice.
- **Auto-correcting status.** Both guards only *detect and report*; they never rewrite a spec.
- **Validating spec *content*** beyond the status fields (e.g. completeness of Acceptance criteria, presence of a Test plan). Out of scope.
- **Inferring a spec reference from the PR body.** The first slice keys off the branch slug + changed files only, for CI determinism. A `Spec:` trailer convention can be a later enhancement.
- **A new runtime/dev dependency.** Pure in-repo node + vitest, matching 0028/0029.
- **Changing branch protection / required-checks configuration on GitHub.** The spec adds the CI job; whether it becomes a *required* check is a repo-settings decision noted in Rollout, not made here.

## Data model impact

None.

## Diagram impact

None. (Tooling/process change; no domain, data, API, architecture, or user-flow diagram is affected.)

## API impact

None.

## Security/privacy impact

None. No auth, data exposure, or secret handling is touched. The linter reads tracked markdown; the CI gate reads branch name and changed-file paths. Both are local/CI checks, not security boundaries (same caveat as 0028/0029).

## Local development impact

- `npm run check` gains `node scripts/spec-status-guard.mjs` at the front of the chain (next to `lockfile-guard`); negligible latency (parses ~30 small markdown files).
- `lefthook.yml` `pre-commit` gains a `spec-status-guard` command.
- New scripts with co-located vitest: `scripts/spec-status-guard.mjs` (+ `.test.mjs`) and `scripts/pr-spec-reference.mjs` (+ `.test.mjs`) for the pure core of the CI gate.
- `.github/workflows/ci.yml` gains a job that runs the PR spec-reference gate (and may also run the spec-status linter for belt-and-suspenders).
- Docs updated: `docs/16-quality-gates.md` (document both guards; correct the stale "GitHub Actions CI is not yet configured" line, which is now false), `specs/changes/README.md` (lifecycle redefinition), `CLAUDE.md` + `.claude/skills/spec/SKILL.md` (Implemented-in-PR).
- No env vars, dependencies, or service changes.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Spec-status guard (self) | `node scripts/spec-status-guard.mjs` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

This change introduces real pure logic (status parsing, consistency, transition/monotonic validation, branch-slug + changed-file evaluation) and therefore **carries unit tests (TDD)**: the detection cores are tested independently of git/lefthook/CI.

## Test plan

TDD on the pure cores (no real git/filesystem in unit tests — inputs are injected):

**`spec-status-guard` core** — given a spec's parsed `{ statusLine, historyRows }`:
- passes a well-formed, self-consistent spec (e.g. Proposed→Accepted→Implemented with matching `## Status`);
- fails when `## Status` ∉ enum;
- fails when `## Status` ≠ last history-row status;
- fails on an illegal transition (`Implemented → Accepted`, `Accepted → Proposed`);
- fails on non-monotonic dates;
- fails when the status section or history table is missing/unparseable;
- the markdown parser correctly extracts the `## Status` value and the history table rows from the real existing spec format (fixture lifted from an existing spec), and **skips `README.md` / non-`NNNN` files**.
- A meta-assertion: running the guard over the **actual** `specs/changes/` tree passes (all current specs are already consistent).

**`pr-spec-reference` core** — given `{ branchName, changedFiles, specsIndex }`:
- passes when the branch spec number maps to an `Accepted`/`In Progress`/`Implemented` spec;
- fails when the branch spec number maps to a `Proposed` or missing spec;
- fails when no spec number in the branch **and** `changedFiles` include tracked source (`src/**`, `scripts/**`, `firestore.rules`);
- passes when no spec number but the change is docs-/scaffold-only (no tracked source);
- `branchSpecNumber` slug extraction reuses/aligns with the existing `claude-edit-guard` heuristic.

**Manual smoke test (integration):**
1. Temporarily set an existing spec's `## Status` to disagree with its history table → `npm run check` and `git commit` both fail with the file named; revert → both pass.
2. Introduce an illegal transition / out-of-order date in a scratch fixture → guard fails.
3. Simulate the CI gate locally (`node scripts/pr-spec-reference.mjs` with a crafted branch/changed-files input) for: Proposed spec → fail; Accepted spec → pass; code change on a no-spec branch → fail; docs-only on a no-spec branch → pass.

## Acceptance criteria

- [ ] `scripts/spec-status-guard.mjs` exists with a pure, exported core and a thin CLI; co-located `scripts/spec-status-guard.test.mjs` passes.
- [ ] The linter enforces: valid enum; `## Status` equals the latest history-row status; legal transitions per the graph above; monotonic history dates; well-formed status section/table — and skips `README.md` / non-`NNNN` files.
- [ ] `spec-status-guard` is wired into both `npm run check` and the lefthook `pre-commit` block.
- [ ] `scripts/pr-spec-reference.mjs` exists with a pure, exported core and co-located passing tests; it fails a PR whose branch references a `Proposed`/missing spec, and a no-spec-number branch that changes tracked source without also changing an Accepted+ spec file; it passes when the branch slug OR a changed spec file resolves an Accepted+ spec, and for docs-only changes.
- [ ] `.github/workflows/ci.yml` runs the PR spec-reference gate on `pull_request`.
- [ ] `specs/changes/README.md` lifecycle table redefines `Implemented` as "merged via this PR"; `CLAUDE.md` and `.claude/skills/spec/SKILL.md` are updated so the `Implemented` flip happens in the implementation PR.
- [ ] `docs/16-quality-gates.md` documents both guards and corrects the stale "GitHub Actions CI is not yet configured" statement.
- [ ] No new runtime/dev dependency added.
- [ ] Running the guards over the current repo state passes (no false positives on existing specs).
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.

## Rollout/deployment notes

Dev-tooling/process only; no deployment, env vars, or migration. Lands as a normal feature-branch → PR → auto-merge. The new CI job runs on the PR for this change itself (good first exercise). Whether to make it a **required** status check in GitHub branch protection is a repo-settings decision left to the owner after it has run green a few times — documented here, not changed by this spec.

## Implementation notes

Suggested order:

1. **`spec-status-guard` first** (pure parse + checks), TDD; lift a fixture from a real existing spec so the parser matches the actual format (`## Status` followed by the value on the next non-blank line; `## Status history` markdown table with `| Date | Status | Notes |`). Treat the **last** data row as authoritative for the `## Status` consistency check.
2. Wire it into `package.json` `check` (front of chain, beside `lockfile-guard`) and `lefthook.yml` `pre-commit`.
3. **`pr-spec-reference`** core, TDD; reuse the branch-slug → spec-number extraction from `scripts/claude-edit-guard.mjs` (`branchSpecNumber`) to stay consistent. The CLI computes `changedFiles` via `git diff --name-only origin/main...HEAD` and reads the head branch from CI env (`GITHUB_HEAD_REF`), falling back to `git branch --show-current`.
4. Add the CI job to `ci.yml` (needs `fetch-depth: 0` or an explicit `origin/main` fetch so the diff base exists).
5. **Docs/process**: redefine `Implemented` in `specs/changes/README.md`; update `CLAUDE.md` "How work flows" and `.claude/skills/spec/SKILL.md` step 6 to flip status in the PR; document both guards in `docs/16` and fix the stale CI line.

Pitfalls:
- The linter must tolerate the existing spec format exactly (e.g. revision notes appended after the status word, as in 0018 — `Implemented (revised ...)`). Normalize by matching the leading enum word of the `## Status` value and of each history-row Status cell.
- Keep the guard fail-open on unexpected I/O errors only where appropriate; a *parse* failure on a spec file is a real failure (it means the file is malformed), not a silent pass.
- The CI diff base requires fetching `origin/main`; ensure the job does so.

## Open questions

1. Should the spec-status linter also run as its own CI step, or is `npm run check` (already implied by the quality job pattern) sufficient? **Resolved (non-blocking):** run it inside the existing flow plus the dedicated PR gate.
2. Should a branch with **no** spec number that touches tracked source be a hard CI failure or a warning? **Resolved at acceptance: hard fail** (deterministic, matches the spec-first rule). Escape hatch: name the branch with its spec number, or keep the change docs-only.
3. Should `Implemented → Superseded` be permitted (a shipped spec later superseded)? **Resolved at acceptance: yes** — the graph allows `* → Superseded` from any state, including `Implemented`.

## Links

- `scripts/secret-scan.mjs`, `scripts/settings-guard.mjs`, `scripts/lockfile-guard.mjs` — guard idiom reused here
- `scripts/claude-edit-guard.mjs` — `branchSpecNumber` slug heuristic reused by the PR gate
- `.github/workflows/ci.yml` — where the PR gate lands
- `specs/changes/README.md` — lifecycle statuses (redefined here)
- `CLAUDE.md` "How work flows", `.claude/skills/spec/SKILL.md` — Implemented-in-PR
- `docs/16-quality-gates.md` — guard documentation
- Specs 0028 (lifecycle enforcement hooks), 0029 (package-manager guard) — pattern precedents

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-19 | Proposed | Initial draft from the recurring wrong-status problem; first slice (#1 linter + #2 in-PR transition gate), reconciliation (#3) deferred. |
| 2026-06-19 | Accepted | Owner accepted. Resolved: no-spec-number PR touching tracked source = hard fail; `Implemented → Superseded` permitted. |
| 2026-06-19 | Accepted | Refined the transition model during implementation: the strict forward-only graph false-positived on 4 existing specs (one-shot `Proposed → Implemented`) and 0005's annotated revert, so it is now rank-based (forward skips allowed; silent backslides rejected; annotated backslides allowed; `Superseded` terminal). |
| 2026-06-19 | Implemented | `spec-status-guard` + `pr-spec-reference` scripts with co-located tests; wired into `npm run check`, lefthook `pre-commit`, and a new CI `spec-gate` job. `Implemented` redefined as "merged via this PR" in `specs/changes/README.md`, `CLAUDE.md`, and the `/spec` skill. `docs/16` documents both guards and the now-current CI state. Status set in this PR per the new convention. |

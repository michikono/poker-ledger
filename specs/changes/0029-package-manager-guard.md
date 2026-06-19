# Change 0029: Package-manager guard (pnpm contamination)

## Status
Proposed

## Owner
Michi Kono

## Goal
Make a wrong-package-manager install (notably `pnpm install`) fail fast instead of silently drifting `node_modules` off the committed `package-lock.json`, so every worktree resolves the pinned toolchain (e.g. Biome 2.4.14) deterministically.

## Context

During the 0026–0028 work, multiple freshly-created worktrees came up with a contaminated `node_modules`: `@biomejs/biome` resolved to **2.5.0** instead of the repo-pinned **2.4.14**, which broke `lint` and `format:check`. Recovery required `npm ci`. It was intermittent — some worktrees (e.g. 0027) were clean — which points at a non-deterministic trigger running `pnpm install` rather than the intended `npm install`.

Root cause has two independent layers:

1. **Why the drift is *possible* (repo-side).** `package.json` pins Biome with a caret: `"@biomejs/biome": "^2.4.14"`. `package-lock.json` pins the exact `2.4.14`, and `npm install` / `npm ci` honor it. **pnpm ignores `package-lock.json`**, re-resolves the caret range against the registry, and picks the newest match — `2.5.0`. There is no `packageManager` field, no `engines` constraint, and no `.npmrc` `engine-strict`, so nothing declares "this repo is npm-only" or stops a foreign manager.
2. **What *triggers* it (environmental, per-machine).** Something on the machine runs `pnpm install` on fresh worktrees intermittently. It is **not in the tracked repo** — `git grep pnpm` hits only prose in `specs/changes/0025`. The committed `post-checkout` hook (spec 0025) correctly runs `npm install`, which is *not* the culprit. The likely sources are a per-machine Orca/Corepack/shell setup step outside version control. Because that layer is per-machine, the durable fix has to live in the repo as a guard, not as a fix to one machine's config.

This change targets layer (1) — the repo-side defenses that make the contamination impossible to apply silently and impossible to commit — and **documents** the layer (2) investigation so the environmental trigger can be retired separately.

Relates to: spec `0025` (worktree bootstrap hook), spec `0028` (lifecycle enforcement hooks — same `.mjs` guard + lefthook pattern), `docs/16-quality-gates.md`, `docs/17-worktree-workflow.md`.

## User-visible behavior

"User" here is a developer / Claude Code working in the repo (this is dev-tooling, no app surface changes).

- Running `pnpm install` (or `yarn install`) in the repo **fails immediately** with a clear message: use `npm`. No `pnpm-lock.yaml` / `yarn.lock` is written, no `node_modules` drift occurs.
- If a `pnpm-lock.yaml` or `yarn.lock` somehow appears in the tree, a deterministic guard fails `npm run check` and the pre-commit hook, with a remediation message (`rm pnpm-lock.yaml && npm ci`).
- A drift check confirms the installed Biome version matches the pinned version; a mismatch fails fast with `npm ci` as the remedy.
- `npm install` / `npm ci` continue to work exactly as today.

## Non-goals

- **Migrating the repo to pnpm.** This repo standardizes on npm (single committed `package-lock.json`); the guard enforces that, it does not reconsider it.
- **Fixing the per-machine pnpm trigger itself.** That lives outside version control; this spec only *detects/blocks* it and records the investigation. Eliminating the trigger (if found to be an Orca/Corepack setup step) is follow-up work, not gated here.
- **Adding a new runtime dependency.** Per rule #5, the manager guard is a hand-written script, not the `only-allow` package.
- **Repinning unrelated dependencies** or auditing every caret range. Biome is the observed offender; broad de-caret-ing is out of scope.

## Data model impact

None.

## Diagram impact

None. (Tooling/process change; no domain, data, API, architecture, or user-flow diagram is affected.)

## API impact

None.

## Security/privacy impact

None directly. Mild supply-chain hardening: pinning the package manager and refusing foreign lockfiles narrows how an unexpected dependency version can enter `node_modules`. No secrets, auth, or data exposure surface is touched.

## Local development impact

- New `preinstall` script in `package.json` runs on every `npm install` (and would run — then abort — under `pnpm`/`yarn`). Must be a no-op under npm and must not break CI installs.
- Adds `"packageManager": "npm@<pinned>"` and an `engines.npm` constraint; adds `.npmrc` with `engine-strict=true` and `package-manager-strict` settings as appropriate.
- `docs/15-local-development.md` and `docs/17-worktree-workflow.md` updated to state npm-only and describe the guard + recovery (`npm ci`).
- Must verify the guard does **not** trip the spec-0025 `post-checkout` `npm install` path on a fresh worktree.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (fresh worktree + attempted `pnpm install`) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

TDD, matching the spec-0028 guard pattern (co-located `*.test.mjs`, pure node, no new dependency):

- **`scripts/package-manager-guard.mjs`** (the `preinstall` guard) — unit tests assert it:
  - exits `0` when `npm_config_user_agent` indicates npm,
  - exits non-zero with a useful message when the agent indicates pnpm or yarn,
  - exits `0` when the agent is absent/unknown (don't break unusual-but-valid environments / CI).
- **`scripts/lockfile-guard.mjs`** (drift + foreign-lockfile check, wired into `check` and pre-commit) — unit tests assert it:
  - fails when `pnpm-lock.yaml` or `yarn.lock` exists,
  - fails when installed `@biomejs/biome` version ≠ the version pinned in `package-lock.json`,
  - passes on a clean npm-resolved tree.
- Tests drive behavior via injected env / fixture paths, not the real filesystem state, so they're deterministic.

## Acceptance criteria

- [ ] `pnpm install` and `yarn install` abort via `preinstall` before writing a lockfile or mutating `node_modules`.
- [ ] `package.json` has `"packageManager": "npm@<version>"` and `engines.npm`; `.npmrc` enforces `engine-strict`.
- [ ] A foreign lockfile (`pnpm-lock.yaml` / `yarn.lock`) fails `npm run check` and the pre-commit hook with a remediation message.
- [ ] A Biome version mismatch vs. the lockfile fails fast with `npm ci` as the remedy.
- [ ] Fresh-worktree `post-checkout` `npm install` (spec 0025) still succeeds end-to-end.
- [ ] Investigation of the environmental pnpm trigger is recorded (findings section in this spec, or a follow-up note) — including whether it is a Corepack/Orca per-machine setup step.
- [ ] All guard scripts have co-located unit tests; no new runtime dependency added.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.
- [ ] `docs/15` and `docs/17` updated.

## Rollout/deployment notes

Dev-tooling only; no deployment, env vars, or migration. Lands as a normal feature-branch → PR → auto-merge. After merge, the next fresh worktree is the smoke test.

## Implementation notes

Suggested order:

1. **Investigate the trigger first** (cheap, informs scope): on a fresh `git worktree add`, check whether anything runs `pnpm` — inspect Corepack (`corepack` enabled? `packageManager` honored?), any global git template hooks, and Orca per-machine setup. Record findings in a "## Investigation findings" section here. The repo-side guards below stand regardless of what's found.
2. **`preinstall` manager guard** — `scripts/package-manager-guard.mjs`, detect via `process.env.npm_config_user_agent`. Wire as `"preinstall": "node scripts/package-manager-guard.mjs"`. Keep it dependency-free and fail-open on unknown agents (so CI/odd shells aren't bricked).
3. **`packageManager` + engines + `.npmrc`** — add the field, `engines.npm`, and `engine-strict=true`. Pick the npm version already in use locally; don't over-constrain Node.
4. **Lockfile/drift guard** — `scripts/lockfile-guard.mjs`; add to the `check` chain and the lefthook `pre-commit` block next to `secret-scan` / `settings-guard`.
5. **Consider de-car-eting Biome** to `2.4.14` (exact) as belt-and-suspenders — cheap, and it removes the specific resolve that bit us. Note in the spec if done.
6. **Docs** — update `docs/15` and `docs/17`; mention recovery is `npm ci`.

Pitfall: the `preinstall` guard must not fire during the legitimate `npm install` in the 0025 `post-checkout` hook — verify on a real fresh worktree.

## Investigation findings (in progress)

The trigger fired **on this spec's own worktree** (`chore/0029`) during authoring — concrete confirmation, not a guess:

- Immediately after `git worktree add`, two untracked files appeared: `pnpm-lock.yaml` and `pnpm-workspace.yaml`. The workspace file contained an `allowBuilds:` block listing native deps (`esbuild`, `lefthook`, `sharp`, `re2`, `protobufjs`, `@firebase/util`) — i.e. a pnpm process ran `install` in the worktree.
- `pnpm-lock.yaml` resolved `@biomejs/biome@2.5.0` (and its `cli-*` platform packages), drifting `node_modules` off the lockfile-pinned `2.4.14`.
- This **silently blocked the first commit**: the lefthook pre-commit `lint` step ran under Biome 2.5.0 and failed, so the spec commit never landed even though the run looked successful at a glance. Recovery was `rm pnpm-lock.yaml pnpm-workspace.yaml && npm ci`, which restored Biome 2.4.14 and let the commit through.

Implication confirmed: the contamination is real, intermittent, and **per-worktree at creation time**. The `pnpm-workspace.yaml` emission strongly suggests Corepack or a per-machine setup step invoking `pnpm install` outside version control. The repo-side guards in this spec (preinstall block + foreign-lockfile/drift detection) would have failed fast with a clear remedy instead of a confusing lint failure. Pinning the actual machine trigger remains step 1 of implementation.

## Open questions

- Should a foreign-lockfile or version-drift be a **hard** CI failure (blocks merge) or a **warning**? Recommendation: hard for foreign lockfiles, hard for Biome drift, since both are deterministic and the remedy is one command.
- Is Corepack enabled on the dev machine, and is it the trigger? Resolve during step 1.

## Links

- `specs/changes/0025-worktree-bootstrap-hook.md` — `post-checkout` `npm install` (the correct path)
- `specs/changes/0028-lifecycle-enforcement-hooks.md` — guard-script + lefthook pattern reused here
- `docs/16-quality-gates.md`, `docs/17-worktree-workflow.md`, `docs/15-local-development.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft — root cause (caret + pnpm ignoring lockfile) identified; trigger is environmental/per-machine |

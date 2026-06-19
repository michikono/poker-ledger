# Change 0025: Auto-install dependencies on fresh worktree checkout

## Status
Implemented

## Owner
Michi Kono

## Goal

When a new worktree is created (`git worktree add`, including via Orca), automatically run `npm install` so the worktree is immediately runnable — without relying on a per-machine tool hook (e.g. Orca's repo setup command) to trigger it.

## Context

The worktree-first workflow (`docs/17-worktree-workflow.md`) means a new worktree is created routinely. Each worktree has its own `node_modules` — they are **not** shared across worktrees — so a freshly added worktree cannot run `npm run dev`/tests until dependencies are installed.

Today that install is triggered by Orca's per-repo "setup" hook (`pnpm install`, since corrected to `npm install`). That trigger lives in a per-machine tool config: it doesn't travel with a clone, isn't version-controlled, and was the source of a recent breakage (wrong package manager). The bootstrap *logic* already lives in the repo (`npm install` → `postinstall` runs `lefthook install`); only the *trigger* lives outside it.

Git already fires the `post-checkout` hook on `git worktree add` (verified: the hook runs with the previous HEAD as all-zeros and the branch flag set). Worktrees share the main checkout's hooks (the common `.git/hooks` dir), and this repo's lefthook-generated hooks resolve the lefthook binary via an **absolute path into the main checkout's `node_modules`** — so the hook works even in a worktree that has no `node_modules` of its own. That closes the only chicken-and-egg concern and lets the trigger move into the repo via lefthook.

This is a developer-experience change only. No product, API, data-model, or security surface is affected.

## User-visible behavior

- A developer adds a worktree (`git worktree add …` or Orca "new worktree"). After files are checked out, `post-checkout` runs and, because the new worktree has no `node_modules`, it prints a short notice and runs `npm install`. When the command returns, the worktree is ready to `npm run dev`.
- Ordinary branch switches inside an existing worktree (`git checkout <branch>`, `git switch`) are **not** affected: `node_modules` already exists there, so the hook is a no-op and adds no latency.
- The install runs synchronously as part of the checkout, so `git worktree add` / Orca worktree creation blocks until it completes (the desired "ready when it returns" behavior). It can be skipped with `LEFTHOOK=0`.
- Orca's per-repo setup hook becomes redundant and should be blanked (manual, out of band — see Non-goals).

## Non-goals

- **Editing Orca's setup hook for the user.** Orca exposes no CLI to edit hook scripts; blanking the `npm install` setup command is a one-time manual UI action the user performs. This spec only makes the repo self-sufficient so that hook is no longer needed.
- **Reinstalling on every branch switch when the lockfile changes.** The guard is intentionally "is `node_modules` missing", not "did `package-lock.json` change". Keeping deps current after a lockfile change on an existing worktree stays a manual `npm install` — avoids surprising, slow reinstalls on routine branch hops.
- **`npm ci` semantics.** We use `npm install` to match the repo's documented bootstrap and to stay forgiving (a hard `npm ci` failure mid-checkout is worse than a lenient install). Reconsider if reproducibility on fresh worktrees becomes a concern.
- **Background/async install.** Installing in the background would make the worktree report "ready" while deps are still landing, creating races. Synchronous is intentional.
- **Migrating existing worktrees.** They already have `node_modules`; nothing to do.

## Data model impact

None.

## Diagram impact

None. Worktree setup is described in prose in `docs/17-worktree-workflow.md`.

## API impact

None.

## Security/privacy impact

None. `post-checkout` is a local, non-network hook running an install the developer would run anyway. Note (informational): git hooks are not a security boundary — anyone who can write the repo's `lefthook.yml` could already run code via the existing `pre-commit`/`pre-push` hooks. This adds no new trust assumption.

## Local development impact

Primary surface of the change.

**Edited files:**
- `lefthook.yml` — add a `post-checkout` hook with one command (`bootstrap-deps`) that runs `npm install` only when `node_modules` is absent.
- `docs/17-worktree-workflow.md` — document that a fresh worktree auto-installs deps via the `post-checkout` hook, that this supersedes the need for an external (Orca) setup trigger, and the `LEFTHOOK=0` escape hatch.

**Mechanics:**
- `lefthook install` (run by `postinstall`) generates `.git/hooks/post-checkout` in the shared common git dir, so it applies to the main checkout and every worktree.
- Because the generated hook resolves lefthook via the main checkout's absolute `node_modules` path, a worktree with no `node_modules` still runs the hook successfully.
- The hook is a no-op for the main checkout and for any worktree that already has `node_modules`.

**No change to:** `package.json` (the `postinstall → lefthook install` chain already installs hooks), CI (CI clones fresh — hooks aren't installed in a clone, and the guard is `node_modules`-absent regardless), production/Vercel (never runs `git worktree add`).

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Hook smoke test | Manual — see Test plan | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

No new automated test surface: the change is a single declarative hook entry whose behavior is git/lefthook integration, covered by the manual smoke test below. No pure logic is introduced that would warrant a unit test.

## Test plan

**Manual smoke test (required):**
1. From this worktree, edit `lefthook.yml`, then run `npx lefthook install` to regenerate the shared hooks. Confirm `.git/hooks/post-checkout` now exists.
2. Create a throwaway worktree: `git worktree add /tmp/pl-hook-smoke -b tmp/hook-smoke`. Confirm the `post-checkout` notice prints and `npm install` runs, and that `/tmp/pl-hook-smoke/node_modules` is populated when the command returns.
3. Inside an existing worktree (with `node_modules` present), run `git switch -c tmp/branchswitch` / `git switch -`. Confirm the hook is a no-op (no install, no added latency).
4. Clean up: `git worktree remove /tmp/pl-hook-smoke --force` and delete the temp branches.

## Acceptance criteria

- [ ] `lefthook.yml` has a `post-checkout` hook with a single `bootstrap-deps` command guarded on `node_modules` absence, running `npm install`.
- [ ] After `lefthook install`, `.git/hooks/post-checkout` exists and is wired to lefthook.
- [ ] `git worktree add` on a fresh worktree triggers `npm install` and leaves `node_modules` populated.
- [ ] An ordinary branch switch in a populated worktree does not trigger an install.
- [ ] `docs/17-worktree-workflow.md` documents the auto-install behavior and the `LEFTHOOK=0` escape hatch.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

- No deployment impact. The hook only fires under local `git`/worktree operations.
- After merge, existing worktrees pick up the hook the next time anyone runs `npm install` (regenerating shared hooks). They already have `node_modules`, so no behavior change for them.
- Follow-up (manual, out of band): blank Orca's per-repo "setup" command for poker-ledger, now redundant.

## Implementation notes

- Keep the guard simple and arg-free: test `[ -d node_modules ]` rather than parsing the git hook's branch-flag argument. This avoids depending on lefthook's positional-argument templating and is robust — the only state that matters is "does this checkout have dependencies yet".
- Inline the `run` block (consistent with the existing `fixup-guard` style in `lefthook.yml`) rather than adding a separate script file; the logic is two lines.
- Synchronous by design — see Non-goals.

## Open questions

Resolved at acceptance:
1. Guard on lockfile change vs. `node_modules` absence — **absence.** Simpler, no per-branch-switch surprises (see Non-goals).
2. `npm ci` vs `npm install` — **`npm install`.** Matches documented bootstrap; forgiving on mid-checkout failure.

## Links

- `docs/17-worktree-workflow.md`
- `lefthook.yml`
- `package.json` — `postinstall` (`lefthook install`)
- Change 0008 (per-worktree dev ports) — related worktree devx

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-10 | Proposed | Initial draft |
| 2026-06-10 | Accepted | Open questions resolved (node_modules-absence guard; npm install). Verified post-checkout fires on `git worktree add` and lefthook resolves via the main checkout's absolute node_modules path. |
| 2026-06-19 | Implemented | Implementation merged to `main` (commits `6068206`, `e8b4143`). Status header was stale; corrected as a bookkeeping fix. |

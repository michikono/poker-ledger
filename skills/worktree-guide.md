# Skill: Worktree Guide

## Purpose

Guide the complete Git worktree lifecycle: creating, working in, committing, pushing, creating PRs, and cleaning up. PR creation and enabling auto-merge are part of the standard completion flow. Merges are deferred to GitHub branch protection (required checks/reviews) — Claude never force-merges or bypasses protections.

## When to use

- When starting a new change spec
- When unsure which worktree to be in
- When finishing and pushing a completed change
- When creating a PR after pushing
- When recovering from a stale or confused worktree state

## Inputs expected

- The change spec or branch name
- The current working directory and git state

## Output format

Step-by-step shell commands with explanations, using the conventions from `docs/17-worktree-workflow.md`.

For creation: output exact commands. For PR creation: output the `gh pr create` command and report the PR URL. For recovery: diagnose state first, then output repair commands.

## Standard lifecycle

**Create:**
```sh
git checkout main && git pull
mkdir -p ../worktrees
git worktree add ../worktrees/poker-ledger-NNNN -b feature/NNNN-name main
cd ../worktrees/poker-ledger-NNNN
```

**Verify before doing anything:**
```sh
pwd
git branch --show-current    # must not be main
git worktree list
```

**Gate and commit:**
```sh
npm run check
git add <specific files>
git commit -m "Description"
```

**Push:**
```sh
git push -u origin feature/NNNN-name
```

**Create PR + enable auto-merge (Claude does this):**
```sh
git fetch origin && git rebase origin/main    # auto-merge is blocked if the branch is behind main
git push --force-with-lease                    # only if the rebase moved commits
gh pr create \
  --base main \
  --head feature/NNNN-name \
  --title "Describe the change" \
  --body-file /tmp/pr-body.md
gh pr merge <number> --auto --rebase           # defers the merge to branch-protection gates
# Report the PR URL. If a clean rebase isn't possible now (CI in flight),
# schedule a follow-up (/schedule) to rebase + enable auto-merge once it clears.
```

**Clean up (only after the PR actually merges — auto-merge may be pending on CI):**
```sh
cd <main-repo-path>
git checkout main && git pull
git worktree remove ../worktrees/poker-ledger-NNNN
git branch -d feature/NNNN-name
```

**Recovery:**
```sh
git worktree list                          # diagnose
git worktree prune                         # clean stale metadata
git worktree remove --force <path>         # force-remove if needed
```

## Hard rules

- Always verify current branch before running commands: `git branch --show-current`.
- **If current branch is `main`, stop immediately.** Do not commit, push, or create PRs from `main`.
- Never run Claude Code from the main repo directory when implementing a feature branch.
- Always use `git add <specific files>` rather than `git add .` — review what is staged.
- **PR creation + enabling auto-merge is the standard completion flow.** After push, rebase onto the latest `origin/main`, create the PR with `gh pr create`, report the URL, and enable auto-merge with `gh pr merge --auto --rebase`.
- **Rebase onto `main` before enabling auto-merge.** GitHub blocks auto-merge when the branch is behind a protected base. If a clean rebase isn't possible at PR time (CI/another PR in flight), schedule a follow-up rebase rather than leaving the PR un-mergeable.
- **Never force-merge or bypass branch protection.** `gh pr merge --auto` defers to GitHub's required checks/reviews; never `--admin`/force a merge or merge a PR that hasn't satisfied its protections.
- **Never force-push** unless explicitly instructed with a documented justification.
- Never `git worktree remove` without checking `git status` in the worktree first — unsaved work will be lost.
- If `git worktree list` shows a `[gone]` indicator, run `git worktree prune` before creating a new worktree at the same path.
- Do not delete the worktree or feature branch until the PR has actually merged (auto-merge may still be pending on CI).

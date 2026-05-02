# Skill: Worktree Guide

## Purpose

Guide the complete Git worktree lifecycle: creating, working in, committing, pushing, creating PRs, and cleaning up. PR creation is part of the standard completion flow. Merging is always human-controlled.

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

**Create PR (Claude does this; human merges):**
```sh
gh pr create \
  --base main \
  --head feature/NNNN-name \
  --title "Describe the change" \
  --body-file /tmp/pr-body.md
# Report PR URL. Stop here — do not merge.
```

**Clean up (only after human merges):**
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
- **PR creation is part of the standard completion flow.** After push, create the PR with `gh pr create` and report the URL.
- **Never merge a PR.** Merging is human-controlled by default. Only merge if the user explicitly instructs it in the current session.
- **Never force-push** unless explicitly instructed with a documented justification.
- Never `git worktree remove` without checking `git status` in the worktree first — unsaved work will be lost.
- If `git worktree list` shows a `[gone]` indicator, run `git worktree prune` before creating a new worktree at the same path.
- Do not delete the worktree or feature branch until the human confirms the PR has been merged.

# Prompt: Worktree Start

Paste this into Claude Code when you want help creating or verifying a new worktree for a specific change.

---

I am starting work on the following change:

**Change spec:** `specs/changes/[NNNN-name].md`
**Intended branch name:** `[feature/NNNN-name]`

Help me set up a clean worktree for this change.

1. Verify that `main` is up to date:
   ```sh
   git checkout main
   git pull
   ```

2. Verify the change spec status is `Accepted` in `specs/changes/[NNNN-name].md`. If it is not `Accepted`, stop and explain what is missing.

3. Verify that no existing worktree or branch for this change already exists:
   ```sh
   git worktree list
   git branch -a | grep NNNN
   ```

4. Create the worktree:
   ```sh
   mkdir -p ../worktrees
   git worktree add ../worktrees/poker-ledger-NNNN -b feature/NNNN-name main
   ```

5. Confirm the worktree is correctly set up:
   ```sh
   git worktree list
   ```

6. Remind me to `cd` into the worktree before running Claude Code:
   ```sh
   cd ../worktrees/poker-ledger-NNNN
   ```

7. Update the change spec status to `In Progress` and add an entry in the Status History section.

Output:
- Confirmation that the worktree is ready
- The exact path to `cd` into
- Any pre-implementation notes from the change spec I should review before starting

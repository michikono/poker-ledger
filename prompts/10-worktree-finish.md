# Prompt: Worktree Finish

Paste this into Claude Code when you are ready to finish, push, and create a PR for a completed change. Claude will create the PR and report the URL. Claude will not merge.

---

I have finished implementing the following change and want to push and create a PR.

**Change spec:** `specs/changes/[NNNN-name].md`
**Branch:** `feature/NNNN-name`
**Worktree path:** `../worktrees/poker-ledger-NNNN`

Work through these steps in order. Stop and report if any step fails.

---

**Step 1: Verify location and branch**

```sh
pwd
git branch --show-current
git worktree list
```

Confirm:
- You are inside the correct worktree directory
- The current branch is `feature/NNNN-name` and is **not** `main`

If the branch is `main`, stop immediately and do not proceed.

---

**Step 2: Run gates**

```sh
npm run check
```

If `npm run check` does not exist yet, run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` individually. Report each result.

If any gate fails, stop and describe the failure before continuing. Do not push if gates fail without documented justification.

---

**Step 3: Spec conformance check**

Review the acceptance criteria in the change spec. Confirm each criterion is met. List each criterion and its status (Met / Not Met / N/A).

---

**Step 4: Commit state**

```sh
git status
git diff
```

Stage and commit any remaining changes:

```sh
git add <specific files>
git commit -m "Describe the change clearly"
```

Do not use `git add .` — stage specific files and review what is being committed.

---

**Step 5: Secrets check**

```sh
git log -p | grep -iE 'password|secret|token|key|api_key' | grep -v '\.example'
```

If anything suspicious appears, stop and flag it before pushing.

---

**Step 6: Push branch**

```sh
git push -u origin feature/NNNN-name
```

This triggers a Vercel preview deployment.

---

**Step 7: Create PR body**

Write the PR body to `/tmp/pr-body.md` with this structure:

```markdown
## Change spec
[path to specs/changes/NNNN-name.md — or "scaffold-only / docs-only" if no spec]

## Summary
[what this change does and why, in 2–4 sentences]

## Acceptance criteria
[copy the checklist from the change spec, or list explicit criteria for scaffold/docs changes]

## Gates run
[list each gate and its result]
- Format check: Pass / Fail / Not configured
- Lint: Pass / Fail / Not configured
- Typecheck: Pass / Fail / Not configured
- Unit tests: Pass / Fail / Not configured
- Build: Pass / Fail / Not configured
- Aggregate (npm run check): Pass / Fail / Not configured

## Local development impact
[any changes to setup, env vars, or local commands — or "None"]

## Deployment notes
[env vars to add to Vercel, migration steps, or "None"]

## Known limitations
[anything intentionally deferred, incomplete, or not yet implemented]
```

---

**Step 8: Create PR**

```sh
gh pr create \
  --base main \
  --head feature/NNNN-name \
  --title "[title matching the change spec goal]" \
  --body-file /tmp/pr-body.md
```

If `gh` is not installed:
```sh
brew install gh
gh auth login
```

After the PR is created, report the PR URL.

**Do not merge the PR.** The human reviews the PR and the Vercel preview, then merges.

---

**Step 9: Report**

Output:
- PR URL
- Summary of gates run and their results
- Any open issues or known limitations noted in the PR body
- Reminder that merge is a human step

---

**Step 10: Post-merge cleanup (run only after the human merges)**

After you are told the PR has been merged:

```sh
cd <absolute-path-to-main-repo>
git checkout main
git pull
git worktree remove ../worktrees/poker-ledger-NNNN
git branch -d feature/NNNN-name
```

Then update the change spec status to `Implemented` and run `/prompts/05-update-core-docs.md` if docs need updating.

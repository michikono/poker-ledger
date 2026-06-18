# Release Checklist

**Change spec:** `specs/changes/NNNN-<name>.md`
**Branch:** `feature/NNNN-<name>`
**Date:**

---

## Stage 1: PR creation readiness (Claude Code)

Verify before running `gh pr create`:

- [ ] Correct worktree confirmed: `pwd` matches expected path
- [ ] Branch is **not** `main`: `git branch --show-current` = `feature/NNNN-<name>`
- [ ] `git worktree list` shows the expected worktree and branch
- [ ] `git status` is clean — no unintended uncommitted changes
- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run check` (aggregate) passes
- [ ] Local smoke test: app starts, core flows work end-to-end
- [ ] No secrets committed: `git log -p | grep -iE 'password|secret|token|key' | grep -v '\.example'`
- [ ] `.env.example` updated for any new environment variables
- [ ] Change spec updated to `In Progress` or `Implemented`
- [ ] Spec conformance review completed (implementation matches accepted spec)
- [ ] Missing or failing gates documented in change spec with remediation plan

PR body prepared and includes:
- [ ] Linked change spec (or "scaffold-only / docs-only")
- [ ] Summary of what changed and why
- [ ] Acceptance criteria from the spec
- [ ] Gates run and their results
- [ ] Local development impact
- [ ] Deployment notes (env vars, migrations)
- [ ] Known limitations

**Claude Code creates the PR with `gh pr create`, reports the PR URL, and enables auto-merge with `gh pr merge --auto --rebase` (after rebasing onto the latest `origin/main`).**

---

## Stage 2: Preview review (human)

After the PR is open:

- [ ] PR URL accessible and PR body is accurate
- [ ] Vercel preview deployment created (check PR or Vercel dashboard)
- [ ] Preview deployment loads without errors
- [ ] Preview smoke test: core user flows work in preview
- [ ] Preview environment variables confirmed (check Vercel dashboard)

---

## Stage 3: Merge readiness (branch-protection gate)

Satisfied before the PR auto-merges to `main`:

- [ ] All Stage 1 items complete
- [ ] All Stage 2 items complete
- [ ] No breaking changes to API or data model (or migration plan in place and documented)
- [ ] Production environment variables confirmed in Vercel dashboard
- [ ] Durable docs updated: affected `/docs` files reflect new system state
- [ ] Change spec marked `Implemented`
- [ ] ADRs created for any durable architectural decisions made during this change

**GitHub auto-merges the PR** once branch-protection checks (and any required reviews) pass. Claude enables auto-merge; it never force-merges or bypasses protections.

---

## Stage 4: Post-merge verification (human)

- [ ] `main` merge triggers production deployment (check Vercel dashboard)
- [ ] Production deployment confirms healthy
- [ ] Production smoke test: core user flows work in production
- [ ] No unexpected errors in Vercel logs
- [ ] Monitoring/alerting shows normal behavior
- [ ] Worktree removed: `git worktree remove ../worktrees/poker-ledger-NNNN`
- [ ] Feature branch deleted: `git branch -d feature/NNNN-<name>`

---

## Rollback trigger

If any post-merge step fails:
1. Go to Vercel dashboard → Deployments.
2. Select the previous production deployment.
3. Click "Promote to Production."
4. Document what failed and create a follow-up fix spec.

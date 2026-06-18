# 14 — Release Process

> This doc defines the checklist-driven process for releasing changes to preview and production.

---

## PR creation checklist

Before Claude Code creates a PR:

- [ ] Confirmed working in the correct worktree: `pwd` and `git worktree list` verified
- [ ] Confirmed branch is **not** `main`: `git branch --show-current`
- [ ] `git status` is clean — all intended changes committed
- [ ] `npm run check` (aggregate gate) passes — or failures documented
- [ ] Local smoke test completed
- [ ] No secrets in committed files (`git log -p | grep -iE 'password|secret|token|key' | grep -v '\.example'`)
- [ ] `.env.example` updated for any new environment variables
- [ ] Change spec updated to `In Progress` or `Implemented`
- [ ] Implementation reviewed against change spec (spec conformance check)
- [ ] Missing or failing gates documented in change spec with remediation plan
- [ ] PR body prepared with: change spec link, summary, acceptance criteria, gates run, local dev impact, deployment notes, known limitations

Claude Code creates the PR with `gh pr create`, reports the PR URL, and (after rebasing onto the latest `origin/main`) enables auto-merge with `gh pr merge --auto --rebase`. The merge is deferred to GitHub branch protection; Claude never force-merges or bypasses it.

After PR is open:

- [ ] PR URL reported and accessible
- [ ] Vercel preview deployment created and URL confirmed
- [ ] Preview smoke test completed
- [ ] Preview environment variables confirmed (check Vercel dashboard)

---

## Preview release checklist

Before requesting PR review (human step — verify Claude's work):

- [ ] PR body is complete and accurate
- [ ] Vercel preview loads without errors
- [ ] Core user flows work in preview
- [ ] Gates listed in PR body match actual results

---

## Production release checklist

Satisfied before the PR auto-merges to `main` (enforced via branch protection where possible):

- [ ] All PR creation checklist items complete
- [ ] All preview checklist items complete
- [ ] PR reviewed
- [ ] All required deterministic gates pass (check PR body for gate results)
- [ ] Preview deployment reviewed and approved
- [ ] Vercel production environment variables confirmed
- [ ] No breaking changes to existing API or data model (or migration plan in place)
- [ ] Docs updated: affected `/docs` files reflect new system state
- [ ] Change spec marked `Implemented`
- [ ] ADRs created for any durable architectural decisions made

**GitHub auto-merges the PR** once branch-protection checks (and any required reviews) pass. Claude enables auto-merge; it never force-merges or bypasses protections.

After merge:

- [ ] Production deployment confirmed in Vercel dashboard
- [ ] Production smoke test completed
- [ ] No unexpected errors in logs
- [ ] Worktree and feature branch cleaned up

---

## Rollback notes

Vercel supports instant rollback to any previous production deployment via the dashboard.

If a database migration was included:
- Ensure the migration is reversible or a rollback script exists.
- Coordinate rollback timing with data team if data may be affected.

---

## Environment variable checklist

- [ ] All variables in `.env.example` are set in Vercel (preview + production)
- [ ] No variables have default values that differ between preview and production unexpectedly
- [ ] New variables added in this release are documented in `.env.example`

---

## Documentation checklist

- [ ] `/docs` files updated to reflect current system state
- [ ] API contract updated if endpoints changed
- [ ] Data model doc updated if schema changed
- [ ] Local development doc updated if setup steps changed
- [ ] Quality gates doc updated if new gates were introduced

---

## Quality gate checklist

- [ ] Format: `npm run format:check`
- [ ] Lint: `npm run lint`
- [ ] Typecheck: `npm run typecheck`
- [ ] Tests: `npm test`
- [ ] Build: `npm run build`
- [ ] Aggregate: `npm run check`

---

## Local development verification checklist

- [ ] Fresh install (`rm -rf node_modules && npm install`) succeeds
- [ ] Dev server starts (`npm run dev`)
- [ ] Application loads in browser
- [ ] Core user flows work end-to-end locally
- [ ] No console errors in browser
- [ ] Environment variable setup in `15-local-development.md` is still accurate

---

## Related docs

- `13-dev-lifecycle.md`
- `15-local-development.md`
- `16-quality-gates.md`

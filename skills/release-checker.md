# Skill: Release Checker

## Purpose

Verify release readiness at each stage of the worktree-first PR workflow. The three stages have different owners and different blockers.

## When to use

- Before Claude creates a PR (Stage 1: PR creation readiness)
- Before the PR auto-merges (Stage 2: merge readiness)
- After merge, to verify production (Stage 3: production release readiness)

## Inputs expected

- The branch/worktree to check
- The change spec for this release
- Access to run commands locally

## Output format

A checklist report using `/templates/release-checklist-template.md`, scoped to the requested stage:

- Each item: Pass / Fail / Needs verification
- Specific failure details for every Fail item
- Prioritized blockers
- Stage-specific verdict

---

## Stage 1: PR creation readiness (Claude Code)

**Verdict options: Ready to create PR / Not ready (with blockers)**

Checks:
1. **Worktree and branch** — run `pwd`, `git branch --show-current`, `git worktree list`. Confirm branch is not `main`.
2. **Git state** — `git status` is clean.
3. **Quality gates** — run each: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check`.
4. **Secrets scan** — check committed content for secrets.
5. **Environment variables** — `.env.example` is current.
6. **Spec conformance** — each acceptance criterion is met or deviation is documented.
7. **PR body** — body is prepared with all required sections.

**Hard rules for this stage:**
- Do not create a PR if the current branch is `main`.
- Do not create a PR if gates failed without documented remediation.
- Do not create a PR if secrets may have been committed.
- Do not create a PR without a complete PR body.

---

## Stage 2: Merge readiness (branch-protection gate)

**Verdict options: Ready to merge / Not ready (with blockers)**

Checks:
1. **Stage 1 complete** — all PR creation checks passed.
2. **Preview deployment** — exists, loads, smoke test passed, preview URL confirmed.
3. **Preview env vars** — confirmed in Vercel dashboard.
4. **API/data model** — no breaking changes, or migration plan in place.
5. **Production env vars** — all required variables set in Vercel production.
6. **Docs updated** — affected `/docs/` files reflect current system state.
7. **Spec status** — change spec is `Implemented`.
8. **ADRs** — created for any durable architectural decisions.

**Hard rules for this stage:**
- Merge is deferred to GitHub branch protection (required checks and any required reviews). Never force-merge or bypass protections.
- Do not report "Ready to merge" if the preview deployment has not been reviewed.
- Do not report "Ready to merge" if docs are stale.

---

## Stage 3: Production release readiness (post-merge verification)

**Verdict options: Production healthy / Issues found (with details)**

Checks:
1. **Production deployment** — Vercel dashboard shows deployment healthy.
2. **Production smoke test** — core user flows work in production.
3. **Error logs** — no unexpected errors in Vercel logs.
4. **Monitoring** — no anomalous alerts or behavior.
5. **Cleanup** — worktree removed, feature branch deleted.

**Hard rules for this stage:**
- If production smoke test fails, flag it immediately.
- Rollback trigger: Vercel dashboard → select previous deployment → Promote to Production.
- Document any production issue as a follow-up fix spec.

---

## General hard rules (all stages)

- Run commands and report actual results — do not estimate or assume.
- Be specific about every failure: name the file, the gate, and the exact error.
- Do not conflate stages — "ready to create PR" does not mean "ready to merge."
- **Never force-merge or bypass branch protection.** Auto-merge defers to GitHub's required checks and reviews.

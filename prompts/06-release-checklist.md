# Prompt: Release Checklist

Paste this into Claude Code when you are ready to check release readiness. Specify which stage: PR creation, merge, or post-production. Claude creates PRs; humans merge.

---

Run a release readiness check for the following branch/change:

**Stage:** [PR creation / Merge / Post-production]
**Branch:** `[feature/NNNN-name]`
**Change spec:** `specs/changes/[NNNN-name].md`

Use the skill at `/skills/release-checker.md` and work through the stage-specific checklist at `/templates/release-checklist-template.md`.

**If checking PR creation readiness (Stage 1):**

1. **Worktree and branch** — run `pwd`, `git branch --show-current`, `git worktree list`. Confirm branch is not `main`. If it is `main`, stop immediately.
2. **Git status** — is the working tree clean?
3. **Quality gates** — run each: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check`. Report each result.
4. **Local smoke test** — confirm app starts and core flows work locally.
5. **Secrets** — scan: `git log -p | grep -iE 'password|secret|token|key' | grep -v '\.example'`
6. **Environment variables** — is `.env.example` current?
7. **Spec conformance** — are all acceptance criteria met?
8. **PR body** — is the body ready with all required sections?

If all Stage 1 items pass: create the PR with `gh pr create`, report the PR URL, and stop. **Do not merge.**

**If checking merge readiness (Stage 2):**

9. **Preview deployment** — is the Vercel preview deployed and reviewed?
10. **Spec status** — is the change spec marked `Implemented`?
11. **Docs** — are all affected `/docs/` files updated?
12. **Production env vars** — are all required variables set in Vercel?

Report Stage 2 findings for human review. **Do not merge on Claude's behalf.**

**If checking post-production (Stage 3):**

13. **Production deployment** — is Vercel showing a healthy production deployment?
14. **Production smoke test** — do core user flows work in production?
15. **Error logs** — are there unexpected errors in Vercel logs?

Output a checklist with Pass / Fail / Needs verification for each item in the requested stage. If any item is Fail, describe what must be fixed before proceeding.

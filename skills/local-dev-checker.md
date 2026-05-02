# Skill: Local Dev Checker

## Purpose

Verify that local development works exactly as documented in `docs/15-local-development.md`. Find gaps between the documentation and reality.

## When to use

- After a change that modifies setup, environment variables, or dependencies
- Before declaring a change spec complete (local dev regression check)
- When onboarding a new developer to verify the docs are accurate
- Periodically to ensure local dev hasn't drifted from docs

## Inputs expected

- `docs/15-local-development.md`
- `.env.example`
- Current `package.json`
- Access to run commands

## Output format

A step-by-step verification using `/templates/local-dev-checklist-template.md`:

Each step: Pass / Fail / Not applicable
For failures: exact error, likely cause, proposed fix

Final verdict: **Local development works** / **Issues found** (with prioritized list).

## Checks performed

1. `.env.example` exists and documents all required variables
2. `npm install` succeeds
3. `npm run dev` starts without errors
4. App loads in browser at `localhost:3000`
5. No unexpected console errors
6. `npm test` passes
7. `npm run build` succeeds
8. `npm run check` passes
9. Core user flows from `docs/01-user-flows.md` work end-to-end locally
10. External service dependencies documented and accessible

## Hard rules

- Actually run commands — do not assume they work.
- Check that `.env.example` documents every variable used in the codebase (not just the ones in the template).
- If local dev requires an external service, verify it is documented, justified in an ADR, and accessible for local use.
- Do not declare local dev working if any required env var is undocumented.
- Report doc inaccuracies as findings, not just command failures.

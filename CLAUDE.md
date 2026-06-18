# CLAUDE.md — Project operating model

Mandatory rules for Claude Code in this repository. This file is the rules plus pointers; detailed process lives in `/docs`, `/templates`, and `/prompts`.

---

## Public repository

**This repository is public on GitHub.** Every commit, branch name, file content, PR title, and PR body is world-readable. Treat every action as if it will be screenshotted and shared.

Implications for Claude Code:

- **Commit only the shared, secret-free `.claude/settings.json`; never commit any other per-user state.** `.gitignore` allows that one file (`.claude/*` then `!.claude/settings.json`) and ignores everything else under `.claude/` — transcripts, agent configs, MCP credentials, and `.claude/settings.local.json`. The committed `settings.json` holds only project-wide, shareable configuration (permission rules for the standard dev gates, etc.) — never secrets, tokens, or per-user/machine-specific paths, and never outward-facing or destructive actions in its allowlist (`git push`, `gh pr create`, `curl`, `kill`/`pkill`). Personal per-repo overrides go in `.claude/settings.local.json` (ignored); cross-project preferences go in your user-level `~/.claude/settings.json`. Treat `.claude/settings.json` like any other public tracked file. Never grant a wildcard that permits arbitrary code execution — bare interpreters/shells (`Bash(node *)`, `Bash(sh *)`, `Bash(bash *)`) or unscoped runners (`Bash(npx *)`); scope every grant to a specific subcommand (`Bash(npm test *)` is acceptable). Keep keys at their schema-correct nesting and ensure the file parses as JSON before committing. See ADR 0007.
- **Never commit secrets, credentials, tokens, service-account JSON, or private keys.** `.env*` is gitignored except `.env.local.example` (which must contain only placeholder values like `demo-api-key`). Before any commit, scan staged content for high-signal secret patterns (`PRIVATE KEY`, `AKIA`, `AIza`, `sk_live_`, `ghp_`, `xox[bp]-`, etc.).
- **No internal hostnames, IP addresses, real customer data, or third-party identifiers** (Slack channel IDs, internal Linear/Jira IDs, employee names beyond the LICENSE author) anywhere in tracked files. Test fixtures use RFC 2606 reserved domains (`@example.com`).
- **Branch names, commit messages, and PR titles/bodies are public.** Do not embed internal context, team names, or anything that wouldn't be appropriate on a public-facing page.
- **`firestore.rules` denies all client writes by default.** Server Actions go through the Admin SDK with verified ID tokens. Never relax these defaults to "make a test work" — fix the test path instead.
- **The `demo-poker-ledger` Firebase project ID is intentional** — it's a Firebase emulator demo project that requires no real credentials. Real production project IDs and config land only in Vercel env vars (`vercel env`), never in tracked files.

When in doubt, ask before committing. The cost of pausing is low; the cost of an exposed secret on a public repo is much higher (history rewrites are visible, search engines and clones cache aggressively).

---

## Non-negotiable rules

1. **Every non-trivial change has an `Accepted` change spec** in `/specs/changes/` before work begins. Implement one spec at a time. "Non-trivial" is about user-visible effect and risk, **not** diff size: any change to app behavior or UI — including small visual tweaks like a button color, label, or spacing — needs a spec. Only docs-only and pure-scaffolding changes are exempt. A change looking like a one-liner is not a reason to skip the spec.
2. **Do not expand scope beyond the accepted spec.** If scope needs to grow, stop and update the spec first.
3. **If a spec is ambiguous or proves wrong, stop and fix the spec before coding.**
4. **Keep changes small and reviewable** — prefer multiple small PRs over one large one.
5. **No new dependencies** without justification in the change spec or an ADR.
6. **Never commit secrets** — scan staged content before every commit. Keep `.env.local` out of Git; keep `.env.local.example` safe and current.
7. **Full local development must keep working** after every change. Anything that can't run locally needs an ADR.
8. **Every change includes deterministic gates** where feasible, and is not "done" until `npm run check` passes (or failures are documented with remediation notes).
9. **Before large changes, summarize intended files and approach and wait for confirmation.**
10. **After implementing a spec, review the implementation against it** before declaring done.
11. **Never commit or push to `main`.** All work happens on feature branches in worktrees.
12. **Claude may create PRs (`gh pr create`) and enable auto-merge (`gh pr merge --auto`).** Merges are governed by GitHub branch protection (required status checks and any required reviews); never bypass those protections or force-merge.
13. **Never force-push** unless explicitly instructed and the justification is documented.
14. **Mobile-first is mandatory for every UI change** (see below). Desktop-only patterns require an ADR.

---

## Mobile-first UX

This app is **primarily managed on mobile**. Every button, modal, menu, input, and layout must be designed at the smallest target viewport first, then enhanced for larger screens. Desktop polish never compromises a thumb-friendly mobile experience.

### Hard requirements (no exceptions without an ADR)

1. **Design at 360 × 640 first.** Open the new surface at that viewport. If it doesn't work there, it isn't done. Only after it works on mobile may you add `md:`/`lg:` enhancements.
2. **No horizontal page scroll on mobile.** A surface that overflows the viewport at 360px width is a defect. Native HTML `<table>` elements are forbidden below the `md` breakpoint — use a stacked card layout (or a list of summary rows with an expand-to-detail interaction) and reveal the table only at `md+`.
3. **Tap targets ≥ 44 × 44 px** (Apple HIG / WCAG 2.5.5). Use the `touch` size variant on `Button`/`Input` for any control a user taps with a thumb. The `xs`/`sm` sizes are dense desktop affordances — they are never the only way to perform a primary action, and they may not appear unaccompanied below `md`.
4. **One body type size per row.** A row of related information should not mix more than one body font size and one supporting label size. Use `tabular-nums` for numbers but keep the size consistent with the surrounding text.
5. **Inputs must not trigger iOS auto-zoom.** That means `text-base` (16px) on mobile; you may step down to `md:text-sm` for desktop density. The shared `<Input>` already handles this — don't override it.
6. **Modals are full-bleed on mobile.** A modal that exceeds 90% of the viewport height must scroll its body, not the whole page, and the primary action must remain reachable (sticky footer or visible without scrolling). The `<HelpModal>` pattern is the reference.
7. **No layout that depends on hover.** Every interaction must be reachable by tap. Tooltips are supplemental, not load-bearing.
8. **Action rows degrade gracefully.** If a header has more than one secondary action, collapse them into a "More" menu on mobile rather than wrapping a row of small chips.
9. **Safe-area aware.** Sticky bottom controls respect `env(safe-area-inset-bottom)`.
10. **Test on a real mobile viewport before declaring done.** Either Playwright with a mobile project, or DevTools device emulation on a representative phone (iPhone SE 375 × 667 minimum). Type-checking and unit tests do not verify mobile fitness — manual verification is required.

A deviation from any rule above requires an ADR in `/specs/decisions/` titled `NNNN-<surface>-mobile-deviation.md` stating which rule is relaxed, the surface, the user need that justifies it, and the explicit fallback for mobile users.

**Design tokens:** the shared primitives in `src/components/ui/` are the source of truth for sizing. If you reach for `size="sm"` on a primary mobile CTA or `h-8 w-24` on a thumb-typed currency input, fix the primitive — don't sprinkle one-off classes.

---

## How work flows

Spec-driven development. Each meaningful slice gets a change spec in `/specs/changes/` (status `Accepted`) before work starts; after it's accepted and merged, update `/docs` to reflect reality.

- **Durable docs** (`/docs`) are living — they reflect current state, keep them current.
- **Change specs** (`/specs/changes`) are historical — mark `Implemented`/`Superseded`, never rewrite. Statuses: `Proposed` → `Accepted` → `In Progress` → `Implemented` (or `Superseded`). Required sections: see `/templates/change-spec-template.md`. Every spec states its test strategy.
- **ADRs** (`/specs/decisions/`) record durable architectural choices, major dependencies, vendor coupling, or deviations from local-dev/testing expectations. Numbered sequentially; short (context, decision, consequences, alternatives); mark `Superseded`, never delete.
- **Tests:** TDD for pure logic, validation, authorization, data transforms, and calculations; test-alongside for API behavior; critical user flows get deterministic coverage. All new code ships with tests in the same PR.
- **Review before done:** compare to the spec; flag deviations, missing gates, missing tests, security issues, scope creep, and local-dev regressions; update affected docs. See `/prompts/04-review-implementation.md` and `/skills/implementation-reviewer.md`.

---

## Git & worktree workflow

All work happens in isolated worktrees on feature branches — never on `main`. Full lifecycle: `docs/17-worktree-workflow.md`.

- **Branch names:** `docs/<topic>`, `spec/<change-name>`, `feature/<slice-name>`, `fix/<bug-name>`, `chore/<maintenance-name>`. Commit messages are clear and specific.
- **Enter the worktree before editing.** After creating or switching to a worktree, confirm `pwd` and `git branch --show-current` (≠ `main`) before the first edit. Never edit from the main checkout while implementing a slice — a worktree that is set up but not entered is the most common cause of changes landing in the wrong place.
- **Before opening a PR:** confirm working directory, branch (≠ `main`), and worktree; gates pass (or failures documented); no secrets staged; change spec linked (unless docs- or scaffold-only).
- **PRs & auto-merge:** Claude creates PRs with `gh pr create`, reports the URL, then enables auto-merge with `gh pr merge --auto --rebase`. **Before enabling auto-merge**, `git fetch origin` and rebase the branch onto the latest `origin/main` — GitHub blocks auto-merge when the branch is behind a protected base. If a clean rebase isn't possible at PR time because CI or a dependency PR is still in flight, **schedule a follow-up** (via `/schedule`) to rebase-and-enable-auto-merge once the blocker clears, rather than leaving the PR un-mergeable. Auto-merge defers the actual merge to GitHub's branch-protection gates (it does not bypass them). The PR body must cover: change spec link, summary, acceptance criteria, gates run, local-development impact, deployment notes, known limitations. Requires the GitHub CLI — if `gh` is missing, prompt to install rather than skip.
- **Before merging to `main`,** run the release checklist: `templates/release-checklist-template.md`.

---

## Quality gates

`npm run check` is the aggregate gate (`format:check`, `lint`, `type-check`, `test`, `build`) and must pass before any change is declared done. Per-gate criteria and the full list: `docs/16-quality-gates.md`; each change spec states explicit pass/fail criteria.

Categories: formatting, lint, typecheck, unit tests (before completion); integration tests, build, secrets scan (before merge); local smoke test + spec-conformance review (before declaring done); preview smoke test (after merge to `main`). Pre-commit hooks (Lefthook) run type-check + lint + unit tests on every commit — all must pass, no bypassing.

---

## GitHub / Vercel lifecycle

Feature-branch push → Vercel preview deployment; merge to `main` → production deployment. Local dev uses `.env.local`; deployments use `vercel env`. Don't `vercel deploy` manually for the normal flow, and never treat a preview deploy as a substitute for local gates.

---

## Diagrams

Mermaid diagrams in `/docs` are living — each must match the prose in its own file, or be removed. When a change touches the domain model, data model, API contract, architecture, or a user flow, update the corresponding diagram in `docs/01`–`docs/06`. The spec-conformance review checks that diagrams reflect the implemented state.

---

## Conventions

Stack, setup, commands, and local-dev details live in `README.md` and `docs/15-local-development.md`.

- **TypeScript:** `strict` (no exceptions), `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any` — use `unknown` and narrow it.
- **Style (Biome-enforced):** 2-space indent, double quotes, auto-sorted imports. Files `kebab-case.ts`; React components `PascalCase.tsx`. No comments unless the WHY is non-obvious.
- **Tests:** co-located (`foo.test.ts` beside `foo.ts`); E2E in `e2e/`. Test the Firebase data layer against the running emulator; mock everything else at the boundary with `vi.mock()`.

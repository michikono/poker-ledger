# CLAUDE.md — Project operating model

This file defines mandatory rules for Claude Code in this repository. Read it fully at the start of every session.

---

## Public repository

**This repository is public on GitHub.** Every commit, branch name, file content, PR title, and PR body is world-readable. Treat every action as if it will be screenshotted and shared.

Implications for Claude Code:

- **Never commit per-user state.** `.claude/` is gitignored and must stay that way. Do not add files to `.claude/` and stage them, do not edit `.gitignore` to remove the `.claude/` entry, and do not propose committing Claude Code transcripts, agent configs, MCP credentials, or local settings under any path.
- **Never commit secrets, credentials, tokens, service-account JSON, or private keys.** `.env*` is gitignored except `.env.local.example` (which must contain only placeholder values like `demo-api-key`). Before any commit, scan staged content for high-signal secret patterns (`PRIVATE KEY`, `AKIA`, `AIza`, `sk_live_`, `ghp_`, `xox[bp]-`, etc.).
- **No internal hostnames, IP addresses, real customer data, or third-party identifiers** (Slack channel IDs, internal Linear/Jira IDs, employee names beyond the LICENSE author) anywhere in tracked files. Test fixtures use RFC 2606 reserved domains (`@example.com`).
- **Branch names, commit messages, and PR titles/bodies are public.** Do not embed internal context, team names, or anything that wouldn't be appropriate on a public-facing page.
- **`firestore.rules` denies all client writes by default.** Server Actions go through the Admin SDK with verified ID tokens. Never relax these defaults to "make a test work" — fix the test path instead.
- **The `demo-poker-ledger` Firebase project ID is intentional** — it's a Firebase emulator demo project that requires no real credentials. Real production project IDs and config land only in Vercel env vars (`vercel env`), never in tracked files.

When in doubt, ask before committing. The cost of pausing is low; the cost of an exposed secret on a public repo is much higher (history rewrites are visible, search engines and clones cache aggressively).

---

## Project operating model

### Phase 0: Upfront design

Work happens exclusively in `/docs`. No application code is written during this phase.

The goal is to eliminate ambiguity, force product and technical decisions, define local-development expectations, define deterministic quality gates, and freeze MVP scope before any implementation begins.

Output: an accepted design baseline with all major open questions resolved.

### Phase 1: Spec-driven development (SDD)

Every meaningful implementation slice must have a corresponding **change spec** in `/specs/changes/` with status `Accepted` before work begins.

Claude Code implements one accepted change spec at a time. Scope is bounded by the spec — no additions, no "while I'm here" improvements.

After implementation is accepted, durable docs in `/docs` are updated to reflect current reality.

### Durable docs vs. historical change specs

`/docs` files are **living documents** — they reflect the current state of the system and are updated as the system evolves.

`/specs/changes` files are **historical records** — they capture what was intended and why. They are not deleted or modified after implementation; they are marked `Implemented` or `Superseded`.

### ADRs

Architecture Decision Records live in `/specs/decisions/`. Create one for any durable architectural choice, major dependency addition, vendor coupling, or deviation from local-development or testing expectations. Number them sequentially (`0001-use-vercel-for-hosting.md`). ADRs are short: context, decision, consequences, alternatives.

### Worktree-based development

All work happens in isolated Git worktrees, not directly on `main`. Each change spec or design effort gets its own worktree and branch. See `docs/17-worktree-workflow.md`.

### Local-first development

The application must run fully locally. Any feature or dependency that prevents local development requires an ADR justification.

### Deterministic quality gates

Every implementation change must pass defined gates before being declared complete. Gates must be explicit in each change spec. See `docs/16-quality-gates.md`.

### GitHub/Vercel lifecycle

- Feature branch push → Vercel preview deployment
- Merge to `main` → Vercel production deployment
- Environment variables: `.env.local` locally, `vercel env` for deployments

---

## Non-negotiable rules

1. **Do not write application code until upfront design docs are accepted.**
2. **Do not make non-trivial implementation changes without a corresponding accepted change spec.**
3. **Do not expand scope beyond the accepted change spec.** If scope needs expanding, stop and create or update the spec.
4. **If a spec is ambiguous, stop and update the spec before coding.**
5. **If implementation reveals a spec is wrong, stop and propose a spec correction before continuing.**
6. **Keep changes small and reviewable.** Prefer multiple small PRs over one large one.
7. **Prefer boring, explicit, maintainable choices.** Avoid cleverness.
8. **Do not add dependencies unless justified** in the change spec or an ADR.
9. **Never commit secrets.** Check before every commit.
10. **Keep `.env.local` out of Git.** Keep `.env.example` safe and current.
11. **Full local development must remain supported** after every change.
12. **Any feature that cannot be run locally must be explicitly justified in an ADR.**
13. **Every implementation change must include deterministic gates** where feasible.
14. **Before large changes, summarize intended files and approach** and wait for confirmation.
15. **After implementing a change spec, review implementation against the spec** before declaring done.
16. **Do not mark a change implemented until relevant gates pass** or failures are explicitly documented with remediation notes.
17. **Never commit or push directly to `main`.** All work happens on feature branches in worktrees.
18. **Claude Code may create GitHub PRs. Claude Code must not merge PRs** unless explicitly instructed by the user.
19. **Never force-push** unless explicitly instructed and the justification is documented.
20. **Mobile-first is mandatory for every UI change.** See "Mobile-first UX" below — desktop-only patterns require an ADR.

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

### Documenting deviations

A deviation from any rule above requires an ADR in `/specs/decisions/` titled `NNNN-<surface>-mobile-deviation.md`. The ADR must state which rule is being relaxed, the specific surface, the user need that justifies it, and the explicit fallback for mobile users.

### Design tokens

The shared primitives in `src/components/ui/` are the source of truth for sizing. If you find yourself reaching for `size="sm"` on a primary mobile CTA or `h-8 w-24` on an input that's expected to receive thumb-typed currency, fix the primitive — don't sprinkle one-off classes.

---

## Deterministic quality gates

### Target gate categories

| Gate | When required |
|---|---|
| Formatting check | Before local completion; before merge |
| Linting | Before local completion; before merge |
| Typechecking | Before local completion; before merge |
| Unit tests | Before local completion; before merge |
| Integration tests | Before merge where feasible |
| Build check | Before merge |
| Security/secrets scan | Before merge where feasible |
| Local smoke test | Before declaring implementation done |
| Production/preview smoke test | After merge to main |
| Spec conformance review | Before declaring implementation done |

### Rules

- Gates must be automated as soon as the app framework exists.
- Tests must be added before or alongside implementation where practical.
- Pure business logic must be developed test-first when possible.
- If a gate is not yet available, the change spec must say why and define when it will be introduced.
- Claude must not claim a change is complete until relevant gates pass or failures are explicitly documented.

Once the app framework exists, `npm run check` is the aggregate gate and must pass before any implementation is declared done.

---

## TDD guidance

- Use TDD for: pure logic, validation, authorization decisions, data transformations, calculations.
- Use test-first or test-alongside for: API behavior.
- UI tests can be lighter initially, but critical user flows must eventually have deterministic coverage.
- Do not use TDD dogmatically for scaffolding or trivial static content.
- Every change spec must state the expected test strategy.

---

## Git workflow

- `main` is production. Never commit directly to `main`. Never push directly to `main`.
- All work happens in isolated worktrees on feature branches.
- Branch naming conventions:
  - `docs/<topic>` — design doc work
  - `spec/<change-name>` — spec authoring
  - `feature/<slice-name>` — implementation
  - `fix/<bug-name>` — bug fixes
  - `chore/<maintenance-name>` — maintenance
- Commit messages must be clear and specific.
- Push feature branches to GitHub to trigger Vercel preview deployments.
- **Claude Code may create GitHub PRs** using the GitHub CLI (`gh pr create`). This is part of the standard implementation workflow.
- **Claude Code must not merge PRs.** Merging is human-controlled by default. Do not merge unless explicitly instructed.
- **Claude Code must not force-push** unless explicitly instructed and the justification is documented.

---

## Worktree workflow

### Creating a worktree

```sh
git checkout main
git pull
mkdir -p ../worktrees
git worktree add ../worktrees/poker-ledger-0001 -b feature/0001-nextjs-shell main
cd ../worktrees/poker-ledger-0001
```

### Finishing a worktree

```sh
# 1. Verify location
pwd
git branch --show-current
git worktree list

# 2. Run gates
npm run check

# 3. Commit and push
git status
git add <specific files>
git commit -m "Initialize Next.js shell"
git push -u origin feature/0001-nextjs-shell

# 4. Create PR (Claude Code may do this)
gh pr create \
  --base main \
  --head feature/0001-nextjs-shell \
  --title "Initialize Next.js shell" \
  --body-file /tmp/pr-body.md
```

Claude Code reports the PR URL after creation. **Claude Code does not merge the PR.** Merging is performed by the human after review.

After the PR is merged by a human:

```sh
cd <main-repo-path>
git checkout main
git pull
git worktree remove ../worktrees/poker-ledger-0001
git branch -d feature/0001-nextjs-shell
```

### Recovery and maintenance

```sh
git worktree list                            # list all worktrees
git worktree prune                           # prune stale metadata
git worktree remove --force <path>           # force-remove a stale worktree
```

**Avoid confusion:** Always `cd` explicitly to the correct worktree before running Claude Code or making changes. Run `git worktree list` if unsure which directory you are in.

---

## Local development workflow

- The app must be fully runnable locally.
- `.env.example` documents all required environment variables (no secrets).
- `.env.local` holds local secrets and must not be committed.
- Local dev must not depend on deployed infrastructure unless an ADR justifies the exception.
- Any external service dependency must be documented in `docs/15-local-development.md`.

Expected commands (once app framework exists):

```sh
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check           # aggregate: all gates
```

---

## Vercel lifecycle

- Pushes to feature branches create Vercel preview deployments automatically.
- Merging to `main` creates a Vercel production deployment automatically.
- Local development uses `.env.local`.
- Vercel deployments use Vercel environment variables (managed via `vercel env`).
- Do not use manual `vercel deploy` for normal workflow.
- The Vercel CLI is used for: linking projects, pulling env vars locally, manual inspection.
- Preview deployments are **not** a substitute for local deterministic gates.

---

## Design-doc workflow

1. Fill `/docs` files before any implementation.
2. Track unresolved decisions in `docs/11-open-questions.md`.
3. Freeze scope in `docs/12-mvp-scope.md`.
4. Define local development expectations in `docs/15-local-development.md`.
5. Define deterministic gates in `docs/16-quality-gates.md`.
6. Define the worktree lifecycle in `docs/17-worktree-workflow.md`.
7. Do not begin implementation while major open questions remain.
8. Design docs must be concise but decision-heavy — no fluff.

---

## Change-spec workflow

### Lifecycle statuses

- `Proposed` — drafted, not yet reviewed
- `Accepted` — reviewed and approved for implementation
- `In Progress` — actively being implemented
- `Implemented` — implementation accepted and merged
- `Superseded` — replaced by a later spec

### Required sections in every change spec

See `/templates/change-spec-template.md` for the full template. Mandatory sections:

- Status
- Owner
- Goal
- Context
- User-visible behavior
- Non-goals
- Data model impact
- API impact
- Security/privacy impact
- Local development impact
- Quality gates (explicit pass/fail criteria for each gate)
- Test plan
- Acceptance criteria
- Rollout/deployment notes
- Implementation notes
- Open questions
- Links to relevant docs/ADRs
- Status history

---

## ADR workflow

- ADRs go in `/specs/decisions/`.
- Number sequentially: `0001-use-vercel-for-hosting.md`.
- Required for: durable architectural choices, major dependencies, vendor coupling, deviations from local-dev or testing expectations.
- Keep them short: context, decision, consequences, alternatives considered.
- ADRs are permanent records — mark `Superseded` rather than deleting.

---

## Review workflow

After implementation, before declaring a change spec `Implemented`:

1. Compare implementation to the accepted change spec.
2. Identify deviations and document them.
3. Identify missing deterministic gates.
4. Identify missing or incomplete tests.
5. Identify security issues.
6. Identify unnecessary complexity or scope creep.
7. Identify local development regressions.
8. Propose any needed updates to durable docs.
9. Do not mark `Implemented` until the review passes.

Use `/prompts/04-review-implementation.md` and `/skills/implementation-reviewer.md`.

---

## Mermaid diagram maintenance

Mermaid diagrams in `/docs` are **living diagrams** — they must stay in sync with the system, just like the prose around them.

### When to create a diagram

Create a mermaid diagram whenever a doc describes:
- A user flow or decision path → `flowchart`
- Entity relationships or domain model → `erDiagram`
- System architecture or component boundaries → `graph` or `C4Context`
- Data flow or API interaction → `sequenceDiagram`
- A lifecycle or state machine → `stateDiagram-v2`
- A timeline or ordered process → `flowchart` or `sequenceDiagram`

### When to update a diagram

Update any affected diagram when:
- A change spec adds, removes, or modifies entities → update `docs/02-domain-model.md` and `docs/05-data-model.md`
- A change spec adds or changes API endpoints → update `docs/06-api-contract.md`
- A change spec changes the architecture or component boundaries → update `docs/03-architecture.md`
- A change spec changes a user flow → update `docs/01-user-flows.md`

### Rules

- Diagrams must match the prose in the same doc. A diagram that contradicts its text is worse than no diagram.
- Keep diagrams minimal — show structure and relationships, not implementation detail.
- Use node labels that match the terminology in the domain model and API contract.
- Do not create a diagram for content that is adequately expressed in prose or a table.
- When updating a doc after an implementation, check whether the diagram needs updating before declaring the doc current.
- The spec conformance review must include a check that diagrams reflect the implemented state.

### Diagram placement

- Each diagram should appear immediately after the section it illustrates.
- Use a `mermaid` fenced code block.
- Add a one-line caption below the block describing what it shows.

---

## Worktree-first PR workflow

This project uses a worktree-first development model.

### Default flow

1. Start from updated `main`.
2. Create a dedicated worktree and feature branch.
3. Make changes only inside that worktree.
4. Run deterministic gates.
5. Commit changes.
6. Push the feature branch.
7. Create a GitHub PR from the feature branch into `main`.
8. **Do not merge unless explicitly instructed.**

Claude Code may create GitHub PRs using the GitHub CLI, provided the current task explicitly permits PR creation or is part of the standard implementation workflow. Merging remains human-controlled by default.

### Pre-PR verification

Before creating a PR, Claude Code must verify:

```sh
pwd                          # confirm correct working directory
git branch --show-current    # confirm branch is not main
git worktree list            # confirm correct worktree
git status                   # confirm clean or intentional state
```

Additional checks:
- Branch is not `main`
- Relevant deterministic gates have passed (or failures are documented)
- No secrets are staged or committed
- Change spec is linked in the PR body, unless the change is scaffold-only or docs-only

### Aggregate gate

Once the app exists, the default gate is:

```sh
npm run check
```

If `npm run check` does not yet exist, run available equivalent checks and document in the PR body which checks were run and which are not yet configured.

### GitHub CLI setup

Claude-created PRs require the GitHub CLI:

```sh
brew install gh
gh auth login
```

The GitHub CLI is not required for local development. It is only needed for Claude to create PRs. If it is not installed, Claude should prompt the user to install it rather than skipping PR creation.

### PR body requirements

Every Claude-created PR body must include:

```
## Change spec
[link to specs/changes/NNNN-name.md — or "scaffold-only / docs-only" if no spec]

## Summary
[what this change does and why]

## Acceptance criteria
[checklist from the change spec, or explicit criteria for scaffold/docs changes]

## Gates run
[list each gate and its result: Pass / Fail / Not configured]

## Local development impact
[any changes to setup, env vars, or local commands — or "None"]

## Deployment notes
[env vars to set in Vercel, migration steps, or "None"]

## Known limitations
[anything intentionally deferred or not yet implemented]
```

---

## Release workflow

Before merging a branch to `main`, run the release checklist:

1. `npm run check` passes locally.
2. Vercel preview deployment reviewed and functional.
3. All required environment variables set in Vercel.
4. No secrets committed (scan before push).
5. Relevant docs and specs updated.
6. Local development still works from documented steps.
7. Change spec marked `Implemented`.
8. ADRs created for any durable decisions made during implementation.

See `/templates/release-checklist-template.md` and `/prompts/06-release-checklist.md`.

---

## Developer quick reference

### Stack

- **Framework**: Next.js 15, App Router, TypeScript strict
- **Database**: Firestore (Firebase)
- **Auth**: Firebase Auth
- **Lint/Format**: Biome
- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **CI**: GitHub Actions

### Local development

#### First run

```bash
cp .env.local.example .env.local
npm install          # also installs git hooks via postinstall
npm run dev          # starts Firebase emulators + Next.js together
```

Emulator UI: http://localhost:4000
App: http://localhost:3000

#### Subsequent runs

```bash
npm run dev
```

Emulator data is persisted to `.emulator-data/` (gitignored) within each worktree. Switching worktrees switches data sets. No data is lost when you stop and restart.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start emulators + Next.js (one command) |
| `npm run type-check` | TypeScript strict check |
| `npm run lint` | Biome lint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Auto-format all files |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Run E2E tests (Playwright, needs `npm run dev` running) |
| `npm run test:e2e:ui` | Playwright UI mode |

### Pre-commit hooks (Lefthook)

Runs automatically on every `git commit`:
1. TypeScript type check
2. Biome lint check
3. Unit tests

All three must pass. No bypassing.

### Firebase emulator

Local dev uses `demo-poker-ledger` — a Firebase demo project that requires no credentials. The emulator starts without any Firebase account.

Emulator ports:
- UI: 4000
- Firestore: 8080
- Auth: 9099

Production uses a real Firebase project (configured via Vercel env vars — set up separately).

### Testing patterns

- **Co-location**: test files live next to source — `src/foo/bar.test.ts` beside `src/foo/bar.ts`
- **E2E**: lives in `e2e/`
- **Requirement**: all new code ships with tests in the same PR
- **Firebase data layer**: test against the running emulator, not mocks
- **Everything else**: mock at the boundary with `vi.mock()`

### TypeScript conventions

- `strict: true` — no exceptions
- `noUncheckedIndexedAccess: true` — array/object access returns `T | undefined`
- `exactOptionalPropertyTypes: true` — optional properties must be explicitly `undefined`, not absent
- No `any` — use `unknown` and narrow it

### Code conventions

- 2-space indentation, double quotes (enforced by Biome)
- Imports auto-sorted by Biome
- File names: `kebab-case.ts`, React components: `PascalCase.tsx`
- No comments unless the WHY is non-obvious

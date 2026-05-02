# poker-ledger

A TypeScript web application hosted on Vercel, built with a design-first, spec-driven workflow.

---

## Workflow overview

This repository uses a two-phase development model:

**Phase 0 — Upfront design**
All product, domain, architecture, and quality decisions are captured in `/docs` before any application code is written. Work happens on `docs/*` branches. No implementation begins until the design baseline is accepted.

**Phase 1 — Spec-driven development (SDD)**
Each meaningful implementation slice is defined in a versioned change spec (`/specs/changes/`). Claude Code implements one accepted spec at a time. Durable docs are updated after each accepted implementation.

---

## Repository structure

```
/docs/           Durable design and architecture docs
/specs/
  changes/       Versioned change specs (one per implementation slice)
  decisions/     Architecture Decision Records (ADRs)
/templates/      Reusable templates for specs, ADRs, reviews, checklists
/prompts/        Reusable prompts for Claude Code workflow steps
/skills/         Project-local Claude Code skill definitions
```

---

## Git and worktree lifecycle

- `main` is production.
- All work happens in isolated Git worktrees, not directly on `main`.
- Branch naming: `docs/<topic>`, `spec/<name>`, `feature/<name>`, `fix/<name>`, `chore/<name>`.
- Push branches to GitHub to trigger Vercel preview deployments.
- Merge to `main` only after deterministic gates pass and preview is reviewed.

Creating a worktree:
```sh
git checkout main && git pull
mkdir -p ../worktrees
git worktree add ../worktrees/poker-ledger-0001 -b feature/0001-nextjs-shell main
cd ../worktrees/poker-ledger-0001
```

Finishing a worktree:
```sh
git status
npm run check
git add .
git commit -m "Describe the change"
git push -u origin feature/0001-nextjs-shell
# open PR, review Vercel preview, merge
cd <main-repo>
git checkout main && git pull
git worktree remove ../worktrees/poker-ledger-0001
git branch -d feature/0001-nextjs-shell
```

---

## Local development

The application must be fully runnable locally. Once the app framework exists:

```sh
npm install
npm run dev          # start dev server
npm run format:check # check formatting
npm run lint         # run linter
npm run typecheck    # run TypeScript typechecking
npm test             # run tests
npm run build        # production build
npm run check        # aggregate gate (all of the above)
```

See `/docs/15-local-development.md` for full setup details.

---

## Deterministic quality gates

Gates are enforced before implementation is declared complete and before merge to `main`:

- Formatting check
- Linting
- Typechecking
- Unit tests
- Integration tests (where feasible)
- Build check
- Security/secrets scan
- Local smoke test

Gates will be automated once the app framework exists. See `/docs/16-quality-gates.md`.

---

## Vercel / GitHub lifecycle

- Feature branch pushes → Vercel preview deployment
- `main` merge → Vercel production deployment
- Environment variables managed via `vercel env` and `.env.local` locally
- Do not rely on manual `vercel deploy` for normal workflow

---

## Starting a new planning phase

1. Create a `docs/<topic>` branch in a worktree.
2. Paste `/prompts/00-initial-design-docs.md` into Claude Code with your product description.
3. Fill `/docs` files iteratively. Track unresolved issues in `11-open-questions.md`.
4. Freeze MVP scope in `12-mvp-scope.md`.
5. Conduct a design review using `/prompts/01-design-review.md`.
6. When docs are accepted, begin Phase 1.

## Creating a change spec

1. Create a `spec/<name>` branch in a worktree.
2. Paste `/prompts/02-create-change-spec.md` into Claude Code.
3. Save the output to `/specs/changes/NNNN-<name>.md`.
4. Review and accept the spec before implementation begins.

## Implementing a change spec

1. Create a `feature/<name>` branch in a worktree.
2. Paste `/prompts/03-implement-change-spec.md` with the spec path.
3. Claude Code implements the spec, runs gates, and stops.
4. Run `/prompts/04-review-implementation.md` before declaring done.
5. Update durable docs via `/prompts/05-update-core-docs.md`.
6. Run release checklist via `/prompts/06-release-checklist.md`.

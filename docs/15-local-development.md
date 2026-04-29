# 15 — Local Development

> This doc defines the local development philosophy, setup process, and expectations. It must be kept current — every change spec that affects setup must update this doc.

---

## Philosophy

- The application must run fully and usefully on a developer's local machine.
- Local development must not require a deployed environment.
- Any deviation from fully-local development requires an ADR with justification.
- Onboarding a new developer should take under 30 minutes following this doc.

---

## Prerequisites

<!-- List required tools and versions once the app framework is chosen. -->

- Node.js (version TBD — see `.nvmrc` once created)
- npm
- Git

---

## Initial setup

```sh
git clone <repo-url>
cd poker-ledger
npm install
cp .env.example .env.local
# fill in .env.local with your local values (see Environment variables section)
npm run dev
```

---

## Environment variables

`.env.example` is the canonical list of required environment variables. It is committed to Git and contains no secrets.

`.env.local` is your local override. It is never committed.

| Variable | Description | Where to get it |
|---|---|---|
| | | |

**Rules:**
- Every required variable must appear in `.env.example` with a description.
- New variables introduced in any change spec must be added to `.env.example` immediately.
- `.env.local` should match `.env.example` structure exactly, with real values filled in.

---

## Available commands

Once the app framework exists, these commands must work:

```sh
npm install              # install dependencies
npm run dev              # start development server (localhost:3000)
npm run format:check     # check formatting (non-destructive)
npm run format           # apply formatting
npm run lint             # run linter
npm run typecheck        # run TypeScript compiler check
npm test                 # run test suite
npm run build            # production build
npm run check            # aggregate gate: format + lint + typecheck + test + build
```

---

## External service dependencies

<!-- Document any services the app needs that are not purely local. -->

| Service | Required for | Local setup |
|---|---|---|
| | | |

If an external service is required locally, document how to configure access. If it is impossible to run locally, this must be justified in an ADR.

---

## Verifying local functionality

After setup or after a significant change:

1. `npm install` completes without errors.
2. `npm run dev` starts without errors.
3. App loads in browser at `localhost:3000`.
4. Core user flows work end-to-end.
5. No unexpected console errors.
6. `npm run check` passes.

---

## Keeping local dev independent from production

- Use `.env.local` for all local secrets and config.
- Never point local dev at production databases or services (except read-only/test data where justified).
- Use local or development-tier versions of external services.
- If a production service has no local equivalent, mock it for local development and document the mock.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` fails | Node version mismatch | Check `.nvmrc` or `engines` in `package.json` |
| Dev server fails to start | Missing env var | Check `.env.local` against `.env.example` |
| Type errors | Missing dependencies or outdated types | `npm install` then `npm run typecheck` |

---

## Related docs

- `13-dev-lifecycle.md`
- `16-quality-gates.md`
- `10-deployment-ops.md`

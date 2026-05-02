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

- **Node.js 20+** — check `.nvmrc` for the pinned version; use `nvm use` if you have nvm
- **npm** — bundled with Node.js
- **Git**
- **Firebase CLI** — `npm install -g firebase-tools` (required to start the emulator)
- **Java 11+** — required by the Firebase emulator (check with `java -version`)

---

## Initial setup

```sh
git clone <repo-url>
cd poker-ledger
npm install               # installs deps + sets up Lefthook git hooks
cp .env.local.example .env.local
# .env.local is pre-configured for the local emulator — no edits needed for local dev
npm run dev               # starts Firebase emulators + Next.js in one command
```

App: http://localhost:3000
Firebase Emulator UI: http://localhost:4000

---

## Firebase emulator

Local development uses a Firebase **demo project** (`demo-poker-ledger`). Demo projects require no Firebase account, no credentials, and no internet connection for the data layer.

The emulator starts automatically with `npm run dev`. Emulator data is persisted to `.emulator-data/` in the project directory (gitignored). Switching worktrees gives you an isolated data set for that branch.

Emulator ports:
- Emulator UI: `4000`
- Firestore: `8080`
- Firebase Auth: `9099`

---

## Environment variables

`.env.local.example` is the canonical list of required environment variables. It is committed to Git and contains no secrets. `.env.local` is your local override — never committed.

| Variable | Description | Local value |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `demo-poker-ledger` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key | `demo-api-key` (emulator accepts any value) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `demo-poker-ledger.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | `demo-app-id` |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK project ID (server-only) | `demo-poker-ledger` |
| `FIRESTORE_EMULATOR_HOST` | Tells SDK to use emulator | `localhost:8080` |
| `FIREBASE_AUTH_EMULATOR_HOST` | Tells SDK to use emulator | `localhost:9099` |

In production, `NEXT_PUBLIC_FIREBASE_*` variables point to a real Firebase project. `FIREBASE_ADMIN_*` uses service account credentials set in Vercel. See `10-deployment-ops.md`.

**Rules:**
- Every required variable must appear in `.env.local.example`.
- New variables introduced in any change spec must be added to `.env.local.example` immediately.
- `.env.local` must not be committed. The `.gitignore` excludes it.

---

## Available commands

```sh
npm install              # install dependencies + set up git hooks
npm run dev              # start Firebase emulators + Next.js (localhost:3000)
npm run format:check     # check formatting with Biome (non-destructive)
npm run format           # apply Biome formatting
npm run lint             # run Biome linter
npm run lint:fix         # auto-fix Biome lint issues
npm run typecheck        # run TypeScript compiler check (tsc --noEmit)
npm test                 # run unit tests (Vitest)
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # run E2E tests (Playwright — requires npm run dev running)
npm run test:e2e:ui      # Playwright UI mode
npm run build            # production build
npm run check            # aggregate gate: format:check + lint + typecheck + test + build
```

---

## External service dependencies

| Service | Required for | Local setup |
|---|---|---|
| Firebase Emulator (Firestore + Auth) | All data reads/writes, authentication | Starts automatically with `npm run dev`; requires Firebase CLI + Java 11+ |

No other external services are required for local development.

---

## Signing in locally with Firebase Auth emulator

After starting `npm run dev`, the Firebase Auth emulator is available at `localhost:4000/auth` in the Emulator UI.

To sign in locally:

1. Open http://localhost:4000/auth in your browser.
2. Click **Add user** and create a test user (any email/password works — no real credentials needed).
3. Open the app at http://localhost:3000.
4. Click **Sign in with Google** on the sign-in page.
5. The emulator will show a popup with your test accounts — select the one you created.
6. You are now signed in. The app redirects to `/sessions`.

Notes:
- The emulator accepts Google Sign-In via popup without any real Google credentials.
- Test users are persisted in `.emulator-data/` and survive restarts.
- Each worktree has its own `.emulator-data/` so switching worktrees switches user sets.
- Session cookies are set as `HttpOnly` so they are invisible to JavaScript — this is expected behavior.

---

## Verifying local functionality

After setup or after a significant change:

1. `npm install` completes without errors.
2. `npm run dev` starts without errors.
3. App loads in browser at `localhost:3000`.
4. Emulator UI is accessible at `localhost:4000`.
5. Core user flows work end-to-end.
6. No unexpected console errors.
7. `npm run check` passes.

---

## Keeping local dev independent from production

- Use `.env.local` for all local config — it points at the emulator, not production Firebase.
- Never point local dev at the production Firestore project.
- The Firebase demo project (`demo-poker-ledger`) works entirely offline for the data layer.
- Emulator data in `.emulator-data/` is gitignored and local to each worktree.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` fails | Node version mismatch | Check `.nvmrc`; run `nvm use` |
| `npm run dev` fails to start | Firebase CLI not installed | `npm install -g firebase-tools` |
| `npm run dev` fails to start | Java not found | Install Java 11+ (`brew install openjdk`) |
| Firestore writes fail | Emulator not running | Ensure `npm run dev` is running; check port 8080 |
| Type errors | Missing dependencies or outdated types | `npm install` then `npm run typecheck` |
| Port 3000 already in use | Another dev server running | Kill the other process or use `PORT=3001 npm run dev` |

---

## Related docs

- `13-dev-lifecycle.md`
- `16-quality-gates.md`
- `10-deployment-ops.md`

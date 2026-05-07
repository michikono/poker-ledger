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

Default emulator ports (these shift per-worktree — see "Per-worktree dev ports" below):
- Emulator UI: `4000`
- Firestore: `8080`
- Firebase Auth: `9099`

### Signing in locally

See the consolidated "Signing in locally with Firebase Auth emulator" section below.

---

## Per-worktree dev ports

`npm run dev` picks a per-worktree port offset on first run and reuses it on every subsequent run, so multiple worktrees can run their own Next.js + Firebase emulator stacks in parallel without colliding on the default ports.

On startup, `scripts/dev.mjs` prints a banner like:

```
Worktree dev ports — offset +500 — Next 3500, UI 4500, Firestore 8580, Auth 9599
```

**How the offset is chosen:**
- On first run, an offset is picked at random from `[100, 5000]` in steps of `100` (50 buckets).
- The four target ports are probed; if any is occupied, a new offset is picked. Up to 3 retries.
- The chosen offset is persisted to `.devports` in the worktree (gitignored), so subsequent runs reuse it.
- If a previously persisted offset later collides (another worktree booted in the meantime), the same retry-and-repick path runs and `.devports` is overwritten.
- After 3 failed attempts, `npm run dev` exits with a clear message — typically meaning every nearby bucket is in use; stop another worktree's `npm run dev` or hand-edit `.devports`.

**Port layout (offset +500 example):**

| Service | Default | Shifted (+500) |
|---|---|---|
| Next.js dev server | 3000 | 3500 |
| Emulator UI | 4000 | 4500 |
| Firestore emulator | 8080 | 8580 |
| Firebase Auth emulator | 9099 | 9599 |

**Generated, gitignored artifacts:**
- `.devports` — single-line file (`OFFSET=500`). Hand-editable. Delete to force re-pick on next `npm run dev`.
- `firebase.runtime.json` — generated copy of `firebase.json` with emulator ports shifted; consumed by `firebase emulators:start --config firebase.runtime.json`.

**Scope:** Only `npm run dev` honors the offset. `npm run build`, `npm run start`, and CI use the default ports / Vercel-managed env. Playwright (`npm run test:e2e`) connects to whatever port the running dev server bound (read from `.devports` if it needs to derive a URL).

---

## Environment variables

`.env.local.example` is the canonical list of required environment variables. It is committed to Git and contains no secrets. `.env.local` is your local override — never committed.

| Variable | Description | Local value |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `demo-poker-ledger` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key | `demo-api-key` (emulator accepts any value) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `demo-poker-ledger.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `demo-poker-ledger.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `000000000000` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | `1:000000000000:web:0000000000000000000000` |
| `FIRESTORE_EMULATOR_HOST` | Tells Admin SDK to use Firestore emulator | `localhost:8080` (auto-shifted by `scripts/dev.mjs` to match the worktree offset) |
| `FIREBASE_AUTH_EMULATOR_HOST` | Tells Admin SDK to use Auth emulator | `localhost:9099` (auto-shifted by `scripts/dev.mjs`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` | Tells the browser SDK which Auth emulator to connect to | `http://localhost:9099` (auto-injected by `scripts/dev.mjs`; falls back to default if absent) |
| `FIREBASE_ADMIN_PROJECT_ID` | Admin SDK project ID (server-only) | `demo-poker-ledger` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email (production only) | *(blank for local)* |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key (production only) | *(blank for local)* |

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
npm test                 # run unit tests (Vitest) — does not require the emulator
npm run test:watch       # Vitest in watch mode
npm run test:emulator    # run emulator-backed tests — rules + data layer (requires Firestore emulator on localhost:8080)
npm run test:e2e         # run E2E tests (Playwright — requires npm run dev running)
npm run test:e2e:ui      # Playwright UI mode
npm run build            # production build
npm run check            # aggregate gate: format:check + lint + typecheck + test + build
```

`npm run test:emulator` is excluded from `npm test` (and from `npm run check`) because it requires the Firestore emulator on the default port `8080`. The suite includes both the rules tests (`firestore-rules.test.ts`) and module-level data-layer tests (`src/**/*.emulator.test.ts`). To run it locally, start the emulator on the default port with `npx firebase emulators:start --only firestore --project=demo-poker-ledger` in another terminal, then run `npm run test:emulator`. The same suite runs in the CI `Emulator Tests` job and is a required check on PRs that touch `firestore.rules` or any data-layer module under `src/lib/`.

---

## External service dependencies

| Service | Required for | Local setup |
|---|---|---|
| Firebase Emulator (Firestore + Auth) | All data reads/writes, authentication, emulator-backed tests | Starts automatically with `npm run dev`; emulator-backed tests require an emulator on the default port `8080` (see `npm run test:emulator`); requires Firebase CLI + Java 11+ |

No other external services are required for local development.

---

## Signing in locally with Firebase Auth emulator

After starting `npm run dev`, the Firebase Auth emulator is available at `localhost:4000/auth` in the Emulator UI.

To sign in locally:

1. Open http://localhost:4000/auth in your browser.
2. Click **Add user** and create a test user. **Set the `displayName` field** (e.g., `Test User`) — otherwise the changelog will show `"Anonymous"` as the actor.
3. Open the app at http://localhost:3000.
4. Click **Sign in with Google** on the sign-in page.
5. The emulator will show a popup with your test accounts — select the one you created.
6. You are now signed in. The app redirects to `/sessions`.

Notes:
- The emulator accepts Google Sign-In via popup without any real Google credentials.
- The popup is the **emulator's own picker**, not a real Google OAuth screen. This differs from production.
- Test users are persisted in `.emulator-data/` and survive restarts.
- Each worktree has its own `.emulator-data/` so switching worktrees switches user sets.
- Session cookies are set as `HttpOnly` so they are invisible to JavaScript — this is expected behavior.
- If you forget to set `displayName`, the user signs in fine but the activity log will show `"Anonymous"` for that user. The fallback chain is: `displayName.split(' ')[0]` → `"Anonymous"`. Email and UID are never used as `actor_name`.

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

## Form interactions — no hard refreshes

All forms in the app submit via Server Actions; no form should trigger a full-page reload. This keeps client state (modals, drawers, scroll position) intact across mutations.

**Rules:**
- Forms submit via Server Actions — `<form action={serverAction}>` or `useFormState` — never via `<form action="/api/...">` POSTs.
- Pending states use `useFormStatus()` (in client child components) or `useTransition()` (when the trigger is a non-form button).
- After a successful mutation, the action calls `revalidatePath(path)` or `revalidateTag(tag)`. Do not call `router.refresh()` unless `revalidate*` is structurally impossible.
- **Never** call `window.location.reload()` or `router.replace(window.location.href)` to refresh after a mutation.
- Modal/dialog dismissal is controlled by React state, not by navigation.

A linter rule for `window.location.reload()` is desirable but not yet configured; manual review enforces this for now.

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
| Port 3000 already in use | Another dev server running | `npm run dev` auto-picks a per-worktree offset; the printed banner shows the bound ports. To force a fresh offset, delete `.devports` and re-run. |
| `npm run dev` exits "Could not find a free dev-port offset" | Too many parallel worktrees, or a stale `.devports` collision | Stop another worktree's `npm run dev`, or delete `.devports` and re-run. As a last resort, hand-edit `.devports` (`OFFSET=<n>` where `n` is a multiple of 100 in `[100, 5000]`). |

---

## Related docs

- `13-dev-lifecycle.md`
- `16-quality-gates.md`
- `10-deployment-ops.md`

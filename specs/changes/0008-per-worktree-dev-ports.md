# Change 0008: Per-Worktree Dev Port Isolation

## Status
Implemented

## Owner
Michi Kono

## Goal

Make `npm run dev` automatically pick a per-worktree port offset on first run and reuse it on every subsequent run, so multiple worktrees (and multiple parallel Claude Code sessions) can run their own Next.js + Firebase emulator stacks side-by-side without colliding on ports 3000 / 4000 / 8080 / 9099.

## Context

Each in-flight worktree currently competes for the same ports. The first `npm run dev` to start binds 3000 (Next), 4000 (emulator UI), 8080 (Firestore), 9099 (Auth); every subsequent worktree fails or silently shadows the original. With the worktree-first workflow described in `docs/17-worktree-workflow.md` and the "≤5 worktrees in parallel" working pattern, this is now a routine source of friction.

The fix is to give each worktree its own deterministic random offset (e.g. `+200`) that shifts every dev-time port in lockstep, and to wire the dev tooling (Next.js, Firebase emulator suite, client SDK, admin SDK env vars) to honor that offset. Emulator data is already isolated per-worktree (`.emulator-data/` is gitignored), so no further data-isolation work is needed.

The offset is picked once per worktree and persisted in a gitignored file so it is stable for the life of the worktree (URLs in the browser, OAuth callbacks, anything bookmarked) but unique across worktrees.

Relevant docs: `docs/15-local-development.md`, `docs/17-worktree-workflow.md`. No business-logic or product-behavior change.

## User-visible behavior

A solo developer running one worktree sees no functional change — `npm run dev` boots Next.js and the emulator suite as before. The visible change is that the printed URLs may use non-default ports (e.g. `http://localhost:3500` instead of `http://localhost:3000`).

A developer with multiple worktrees can run `npm run dev` in each, in parallel, and have each worktree bind its own non-overlapping set of ports. The printed banner at startup shows the offset and the four bound ports so it's obvious which window is which.

If a worktree's chosen offset turns out to collide with another live worktree (random collision), `npm run dev` detects the bind failure, picks a new offset, persists it, and retries once. After the second failure the script exits with a clear message.

## Non-goals

- Changing production behavior. Production runs on Vercel; only local dev is affected.
- Isolating ports for `npm test`, `npm run build`, or Playwright (`npm run test:e2e`). Tests bring up their own ephemeral resources or assume the dev server is already running with whatever offset it picked. Playwright config will read the offset from the same source as `npm run dev`, but no behavior change beyond pointing at the right URL.
- Coordinating offsets across worktrees via a shared registry (e.g., a lockfile in `~/.config`). The collision-retry path is sufficient at the working-set size of ≤5 worktrees with ~50 buckets — collision odds per launch are < 10% and self-heal on retry.
- Pinning the primary (non-worktree) checkout to offset 0. The primary checkout is treated identically to any other worktree. Rationale: simpler logic, no special case, and the user said they're rarely running just one. Reconsider if the convenience matters.
- Allowing manual offset override via env var on a per-run basis. Out of scope; the persisted offset is the source of truth. (Editing `.devports` by hand is the escape hatch.)
- Supporting non-Firebase services. There are none today; this spec covers exactly the four ports listed below.
- Migrating existing in-flight worktrees. They will pick offsets on next `npm run dev`. No migration script.

## Data model impact

None. No Firestore or persisted-application-state changes.

## Diagram impact

None. The local-development setup is described in prose only.

## API impact

None. No HTTP endpoints, no Server Actions, no client/server contracts change. The Firebase admin SDK already honors `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`; the only client-side change is reading the auth-emulator URL from an env var instead of the hardcoded `http://localhost:9099` in `src/lib/firebase/client.ts`.

## Security/privacy impact

None. Local dev only. The auth emulator is not authenticated in any case (`demo-poker-ledger`).

## Local development impact

Substantial — this is the primary surface of the change. Specifically:

**New files:**
- `scripts/dev.mjs` — top-level orchestrator invoked by `npm run dev`. Reads/picks the offset, writes the runtime Firebase config, exports env vars, then `concurrently`-spawns the emulator and Next.
- `scripts/dev-ports.mjs` — the offset module: `loadOrPickOffset()`, `portsForOffset(offset)`, `writeRuntimeFirebaseJson(offset)`, `bannerString(offset)`. Exports for unit tests.

**New gitignored, generated artifacts (per-worktree, never committed):**
- `.devports` — single-line file: `OFFSET=500`. Created on first `npm run dev`. Read on every subsequent run.
- `firebase.runtime.json` — generated copy of `firebase.json` with all emulator ports shifted by the offset. Regenerated on every `npm run dev` (cheap, idempotent).

**Edited files:**
- `package.json` — `"dev": "node scripts/dev.mjs"`. The current `dev:next` and `dev:emulator` scripts are deleted (`scripts/dev.mjs` does the orchestration directly).
- `src/lib/firebase/client.ts` — read the auth-emulator URL from `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` instead of hardcoding `http://localhost:9099`. Falls back to the hardcoded value when the env var is absent (production / unit tests).
- `.gitignore` — add `.devports` and `firebase.runtime.json`.
- `.env.local.example` — add commented documentation for the four new env vars `scripts/dev.mjs` injects (`PORT`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`). The user should NOT set these themselves; they're written into the child-process env by `scripts/dev.mjs`. The `.example` documentation is informational only.
- `docs/15-local-development.md` — describe the offset, the printed banner, the collision-retry behavior, and the location of `.devports`.
- `docs/17-worktree-workflow.md` — note the per-worktree port allocation under the existing "Avoid confusion" guidance.

**Unchanged:**
- `firebase.json` — left alone as the canonical default. CI and fresh checkouts before first `npm run dev` see the original ports.
- `src/lib/firebase/admin.ts` — no edit. The admin SDK already reads `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` from env, and `scripts/dev.mjs` will set those.
- `vercel.json` — no edit. Vercel is production-only; the offset never reaches it.

**Port layout:**

| Service | Default | With offset 500 (example) |
|---|---|---|
| Next.js dev server | 3000 | 3500 |
| Emulator UI | 4000 | 4500 |
| Firestore emulator | 8080 | 8580 |
| Auth emulator | 9099 | 9599 |

**Offset selection:**
- Range: `[100, 5000]` in steps of `100` → 50 buckets.
- 5 worktrees in 50 buckets → ~10% collision odds per launch (birthday paradox: `1 − 50!/((50−5)!·50^5)`).
- On first run with no `.devports`, pick a random bucket via `crypto.randomInt`.
- Probe the four target ports with `net.createServer().listen(port)`; if any is occupied, pick a different bucket and retry up to 3 times. After 3 failures, exit with a clear message asking the user to inspect `.devports` or kill another worktree.
- Once a non-colliding offset is found, write `OFFSET=<n>` to `.devports`. Subsequent runs read the file directly without re-probing — collisions on subsequent runs only happen if another worktree picked the same bucket between reads, in which case the same retry path runs.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual — see below | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (Playwright): N/A — Playwright config will read the offset from `.devports` like everything else, but the change does not introduce new test surface.

**Local smoke test (manual, required):**
1. From a fresh checkout (no `.devports`), run `npm run dev`. Verify the banner prints an offset and four ports. Verify the app loads at `http://localhost:<3000+offset>` and the emulator UI loads at `http://localhost:<4000+offset>`. Verify the offset persists (`.devports` exists; second run uses the same numbers).
2. From a second worktree on the same machine, run `npm run dev` while the first is still up. Verify it picks a different offset, prints a different banner, and both stacks remain functional in their respective browser windows.
3. Stop both. Edit `.devports` in the first worktree to match the second's offset. Run `npm run dev` in the first worktree. Verify the collision-retry path triggers (one of the two prints a "port in use, retrying with new offset" line) and both stacks come up healthy.
4. Verify `firestore.rules` reload still works on save (i.e., the emulator config generation didn't break the watcher).
5. Verify Google Sign-In through the auth emulator still works in both windows.

## Test plan

Unit tests for the pure pieces of `scripts/dev-ports.mjs` (`scripts/dev-ports.test.mjs`):

- **`portsForOffset(offset)`** — returns `{ next, ui, firestore, auth }` with exact arithmetic. Test offset 0, 100, 5000.
- **`portsForOffset` validation** — throws on offset < 100, > 5000, not a multiple of 100, non-integer.
- **`writeRuntimeFirebaseJson(srcConfig, offset)`** — given the canonical `firebase.json` shape, produces a config with `emulators.{auth,firestore,ui}.port` shifted by the offset. Other fields untouched.
- **`pickRandomOffset(rng?)`** — deterministic when `rng` injected. Always returns a multiple of 100 in `[100, 5000]`. Drawn uniformly from 50 buckets.
- **`bannerString(offset, ports)`** — produces a stable, grep-able banner ("Worktree dev ports — offset +500 — Next 3500, UI 4500, Firestore 8550, Auth 9569").
- **`loadOrPickOffset(cwd, fs, rng)`** — given an existing `.devports` file, returns the parsed offset. Given missing file, picks one via `rng`. Given garbage in `.devports`, treats as missing and re-picks. (Use `memfs` or a tiny shim — no new dep; just stub `fs.readFileSync` etc. via injected dependency.)

`scripts/dev.mjs` (orchestrator) is integration-shaped — its tests are the manual smoke-test items above. The pure modules above carry the unit-test weight.

`src/lib/firebase/client.ts` change: extend `client.test.ts` (or create one if missing) to assert the auth emulator URL is read from `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` when present, falls back to `http://localhost:9099` when absent.

## Acceptance criteria

- [ ] `scripts/dev.mjs` and `scripts/dev-ports.mjs` exist with the exports listed in **Test plan**.
- [ ] `.gitignore` includes `.devports` and `firebase.runtime.json`.
- [ ] `package.json` `dev` script is `node scripts/dev.mjs`. The previous `dev:next` and `dev:emulator` scripts are removed (no callers remain) or reduced to internal helpers if `concurrently` integration requires it.
- [ ] First `npm run dev` in a fresh worktree picks a random offset, writes `.devports`, generates `firebase.runtime.json`, prints a banner, and successfully starts both stacks.
- [ ] Second and subsequent `npm run dev` in the same worktree reuse the offset.
- [ ] Two worktrees can run `npm run dev` in parallel and bind disjoint port sets.
- [ ] Collision (same offset already in use) triggers a retry; after 3 failed attempts the script exits with a clear, actionable message.
- [ ] `src/lib/firebase/client.ts` reads the auth emulator URL from `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` and falls back to `http://localhost:9099`.
- [ ] `docs/15-local-development.md` and `docs/17-worktree-workflow.md` describe the new behavior.
- [ ] `.env.local.example` documents the four offset-related env vars as auto-injected (with a "do not set manually" note).
- [ ] All unit tests for `dev-ports.mjs` pass.
- [ ] Manual smoke test (5 steps above) passes.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

- **Vercel:** untouched. The offset machinery only fires under `npm run dev`. `npm run build` and `npm run start` (used by Vercel) ignore `.devports`.
- **CI (GitHub Actions):** no new env vars, no behavior change. CI does not run `npm run dev`.
- **First-time-after-merge experience for existing worktrees:** when developers pull the branch into an existing worktree, the next `npm run dev` will pick an offset for that worktree. Bookmarks at `localhost:3000` / `localhost:4000` will need to be updated. Surface this in the PR body.

## Implementation notes

**Offset persistence format** — keep `.devports` to a single line (`OFFSET=500`) so it is grep-able and trivial to hand-edit. Avoid JSON; this file is read by humans more often than by the script.

**Banner placement** — print the banner *before* spawning child processes, not after, so a startup failure still leaves the offset visible in the terminal.

**Concurrent emulator + Next** — `concurrently` is already a dep. Use it from `scripts/dev.mjs` programmatically (`import concurrently from "concurrently"`), passing the spawned commands with the offset env vars set. Avoid shell interpolation; use the `env` option on the child.

**Probing for free ports** — `net.createServer().listen(port)` resolves on bind, errors with `EADDRINUSE` on collision. Close the probe server immediately after a successful bind. Probe all four ports for an offset before committing; partial success (e.g., 3 of 4 free) means retry with a different offset.

**`firebase.runtime.json` lifecycle** — regenerate on every `npm run dev` (cheap; idempotent given a fixed offset). Do not delete on shutdown — leaving the file around helps when the user inspects state after a crash. The gitignore prevents accidental commits.

**Why a single offset, not four independent ports?** A single offset keeps the four ports easy to reason about ("I'm worktree +500") and ensures emulator UI / Firestore / Auth never collide *within* a worktree. The cost (no per-port flexibility) is irrelevant here — these four ports always come up together.

**Probe stack coverage (implementation note).** Different consumers bind the same port on different IP stacks: Next.js binds the IPv6 wildcard `::` (dual-stack), the Firebase emulator binds IPv4 `127.0.0.1`. A naive probe on `127.0.0.1` only would miss IPv6-occupied ports (e.g. Docker's API server holds `:::8000`) and let the orchestrator pick a doomed offset. `scripts/dev.mjs` therefore probes each port on both `0.0.0.0` and `::` and requires both to be free.

**Hub and logging ports (implementation note).** The Firebase emulator suite also exposes a hub port (default 4400) and a logging port (default 4500) that this spec does not shift. Empirically the emulator already handles these gracefully — when the defaults are taken, it auto-increments to 4401 / 4501 and prints a warning. Two parallel worktrees therefore work without explicitly shifting hub/logging. If a future change wants strict per-worktree isolation of those, extend `firebase.json` to declare them and generalize the shift loop over `emulators.*.port`.

**Why `crypto.randomInt`?** It's stdlib and good enough; no `Math.random` quirks. The collision-domain assertion is informal — this is dev convenience, not security.

**Bucket size** — 50 buckets at step 100 keeps port spread visually obvious (`3000`, `3100`, `3200`, …) and keeps the collision math gentle. Step 10 or step 1 would give more buckets but harder-to-remember URLs. Step 100 is the sweet spot at the stated working-set size.

## Open questions

Resolved at acceptance:

1. Pinning the primary checkout to offset 0 — **No.** Treat all checkouts identically. Simpler logic; the primary is rarely run alone in this workflow.
2. Repeating the offset banner inside Next's own startup output — **Out of scope.** `next dev` already prints the bound URL; the orchestrator banner is sufficient.

## Links

- `docs/15-local-development.md`
- `docs/17-worktree-workflow.md`
- `.env.local.example`
- `firebase.json`
- `src/lib/firebase/client.ts`
- `package.json` — `dev`, `dev:emulator`, `dev:next` scripts

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Open questions resolved per recommendations (no offset-0 pinning, no Next-banner integration) |
| 2026-05-02 | Accepted | Example offsets in prose corrected from `+470` (not a multiple of step 100) to `+500` to match the stated bucket rule |
| 2026-05-02 | Implemented | All acceptance criteria met. `npm run check` green. Smoke-tested via parallel orchestrator runs; collision-retry path exercised. |

# Change 0033: Background realtime sync with idle stop

## Status
Proposed

## Owner
Michi Kono

## Goal

Keep every open client's view of a session (and the sessions index) current in near-real-time while it is being watched, so concurrent players in a live game don't act on stale data — and stop syncing a forgotten, idle tab after 2 minutes of no interaction.

## Context

The app is designed to be used by multiple people at once during a poker game (multiple phones open on the same session). Today all reads happen in Server Components via the Admin SDK, and the client refreshes its data only when *it* performs a mutation (each Server Action call is followed by `router.refresh()` — see `session-view.tsx`, `player-list.tsx`, `settling-modal.tsx`, etc.). A change made on another device is invisible until the local user acts or manually reloads. During a live game this produces outdated local views: a player buys in on their phone, but the host's screen still shows the old total.

Relevant existing facts:
- **Every mutation writes a `change_log` entry** — `player_added`, `buy_in_added`, `buy_in_removed`, `cash_out_set`, `player_renamed`, `player_venmo_updated`, `status_changed`, `payment_marked_paid`, `payment_unmarked_paid`, `session_archived`, `player_removed` (`src/app/(app)/sessions/[name]/actions.ts`). So a single listener on a session's `change_log` collection observes **all** of the data classes the user cares about: new players, buy-ins, settlements/payments, and game state.
- **`firestore.rules` already allows authenticated client reads** on `sessions`, `players`, `buy_ins`, `payments`, and `change_log` (only writes are denied). `docs/03-architecture.md` and `docs/04-security-threat-model.md` explicitly anticipated this: "clients only read via the Admin SDK in MVP, but the rules ensure that direct client SDK reads, if ever introduced, still require auth." This change is that introduction — **no rules change is required.**
- The client currently initializes Firebase only for **Auth** (`src/lib/firebase/client.ts`). There is no client Firestore instance yet.
- `router.refresh()` re-runs the Server Component and streams fresh props while preserving client state and scroll position, so reusing it as the "apply" step keeps all existing server-side data shaping (sorting, buy-in history grouping, payment derivation) in one place — no duplicated client logic.
- The sessions index (`src/app/(app)/sessions/page.tsx`) reads top-level `sessions` docs; new sessions and status changes are the relevant updates there.

Relevant prior specs/docs:
- `docs/03-architecture.md` — read/write data flow, client vs. Admin SDK boundary.
- `docs/04-security-threat-model.md` — Firestore rules posture.
- `specs/decisions/` — a new ADR records the client-read realtime decision (see Diagram/Links).

## User-visible behavior

1. **Live updates while watching.** On the session detail page, when anyone changes the session — adds a player, adds/removes a buy-in, sets a cash-out, computes/settles payments, marks a payment paid, or changes status — every other open client viewing that session updates within a couple of seconds, with no manual reload. Scroll position and any open modals/inputs are preserved (it's a background data refresh, not a full navigation).
2. **Live index.** On the sessions list, a newly created session or a session status change appears/updates on other open clients without a manual reload.
3. **Idle stop.** If a client goes 2 minutes with no interaction — no pointer movement, scroll, key press, tap, or click, and the tab is not brought back to the foreground — background syncing stops. A tab left open and forgotten stops pulling data.
4. **Seamless resume.** The moment the user interacts again (moves the cursor, scrolls, taps, types, or refocuses the tab), syncing resumes and the view immediately catches up to the latest data (a single refresh on resume), then stays live.
5. No new visible UI, no buttons, no toasts, no layout change. The feature is invisible except for data staying fresh.

## Non-goals

- **No optimistic/streamed partial updates or client-side re-derivation.** We refresh via the existing server render path, not by mutating local state from snapshot payloads. (Keeps all data shaping server-side; avoids a second source of truth.)
- **No client-side writes.** All mutations still go through Server Actions + Admin SDK. `firestore.rules` writes stay denied.
- **No presence / "who's viewing" / typing indicators.** Out of scope.
- **No configurable idle timeout UI.** The 2-minute threshold is a constant (documented), not a setting.
- **No change to the mutation → `router.refresh()` behavior that already exists** after local actions.
- **No rules relaxation** and no new server endpoints or WebSocket server. Realtime uses Firestore's client `onSnapshot` (WebChannel) over the already-permitted authenticated read path.
- **No offline persistence / IndexedDB cache** enablement.

## Data model impact

None. No schema, collection, or index changes. The listeners read existing collections:
- Detail: `sessions/{sessionId}/change_log`, ordered `created_at desc`, `limit(1)` — a single-field order that needs no composite index; a new entry changes the newest doc and fires the listener.
- Index: `sessions` top-level collection, ordered `created_at desc`, `limit(200)` (mirrors the existing index-page fetch ceiling noted in `docs/03-architecture.md`); an add or a status modify within that window fires the listener.

## Diagram impact

- `docs/03-architecture.md` — the read-path graph currently shows only `RSC -- "Firestore Admin SDK" --> Firestore`. Add a client realtime read edge: `Client -- "onSnapshot (auth read)" --> Firestore`, and a note that a snapshot triggers `router.refresh()` (re-running the RSC). Update the surrounding prose that says "clients only read via the Admin SDK."
- `docs/04-security-threat-model.md` — update the Firestore-rules note to reflect that client SDK reads are now actually used (the rules already cover this; the prose that frames client reads as hypothetical becomes current).
- New ADR `specs/decisions/0008-client-realtime-reads.md` — record: decision to use client `onSnapshot` for realtime (over a bespoke WS server or polling), the idle-stop policy, and the reaffirmed write-deny posture.

## API impact

None. No Server Action signatures change; no new routes. The realtime path is a direct client Firestore read, not an API call.

## Security/privacy impact

- **Introduces real client-side Firestore reads.** This is within the existing rules (`allow read: if request.auth != null`) — an authenticated user can already read every session's data through the app. No broadening of exposure versus the current Admin-SDK read path (the RSC reads the same collections on behalf of the same authenticated user). Writes remain fully denied to clients.
- The listener is scoped: detail watches only the current session's `change_log`; index watches the `sessions` collection the user is already allowed to list.
- No secrets involved. The client Firestore instance uses the existing public `NEXT_PUBLIC_FIREBASE_*` config already shipped for Auth.
- Idle-stop reduces long-lived open connections from abandoned tabs — a modest resource/cost safeguard, not a security boundary.

## Local development impact

- The client Firestore SDK must point at the **Firestore emulator** in local dev (demo- projects), mirroring the existing client Auth-emulator wiring. This needs a public host var for the browser:
  - `scripts/dev.mjs` — inject `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:${ports.firestore}` into `childEnv`, alongside the existing `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`.
  - `.env.local.example` — document `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST` (default `localhost:8080`) as an emulator-only var; keep it a placeholder-safe value.
  - `getClientDb()` calls `connectFirestoreEmulator` when `NEXT_PUBLIC_FIREBASE_PROJECT_ID` starts with `demo-`, defaulting to `localhost:8080` when the var is unset (matches the Auth-emulator fallback pattern).
- `docs/15-local-development.md` — note the new public emulator var.
- No new dependency: `firebase` (client SDK) is already a dependency; we import `firebase/firestore` from it.

## Quality gates

Required gates for this change:

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run typecheck` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Integration tests | `npm run test:integration` | Where feasible | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (two browser tabs on one session) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

TDD for the pure/deterministic pieces; the Firestore wiring is exercised behind an injectable seam so the hooks are unit-testable without the emulator, plus a manual two-tab smoke test for the real WebChannel path.

- **`useActivityStatus(timeoutMs)` (unit, TDD, fake timers + jsdom):**
  - Starts `active`.
  - Goes `inactive` after `timeoutMs` with no events.
  - Each of `pointermove`, `scroll`, `keydown`, `touchstart`, `click` resets the timer and keeps/returns to `active`.
  - `visibilitychange` → visible counts as activity (resumes); hidden does not reset the timer.
  - Removes all listeners on unmount (no leak).
- **`subscribeToChanges(query, onChange)` adapter (unit):** ignores the first `onSnapshot` emission (initial data), invokes `onChange` on each subsequent emission, and returns the unsubscribe. Tested with a fake `onSnapshot` injected (no emulator).
- **`useRealtimeRefresh({ subscribe, onRefresh, idleTimeoutMs })` (unit, TDD):** inject a fake `subscribe` and fake `onRefresh` + fake timers:
  - Subscribes while active; does **not** refresh on initial mount.
  - A change event → exactly one `onRefresh` (debounced when several fire in a burst).
  - After idle timeout → unsubscribes; subsequent change events do nothing.
  - Reactivation → resubscribes **and** calls `onRefresh` once (catch-up).
- **Query builders `changeLogQuery` / `sessionsIndexQuery` (unit):** assert the collection path, order, and limit passed to the Firestore query factory (factory injected/mocked at the boundary per repo convention).
- **Headless sync components** render `null` and mount the hook (light render test).
- **Excluded from unit tests:** the real WebChannel/emulator round-trip — covered by the manual two-tab smoke test (open a session in two tabs; mutate in A; B updates within seconds; leave B idle 2 min → stops; interact → catches up). Optionally add an emulator-backed test if it proves stable, but the manual smoke test is the required gate.

## Acceptance criteria

- [ ] With two clients on the same session, a mutation in one (new player, buy-in add/remove, cash-out, settle/compute payments, mark/unmark paid, status change) is reflected in the other within ~2s without manual reload, preserving scroll and open modals.
- [ ] With two clients on the sessions index, a newly created session and a status change appear/update on the other without manual reload.
- [ ] After 2 minutes of no interaction (no pointermove/scroll/keydown/touchstart/click and tab not refocused), the client stops syncing (listener detached).
- [ ] Interacting again (or refocusing the tab) resumes syncing and performs a single catch-up refresh, then stays live.
- [ ] No spurious refresh on initial page load (initial snapshot is skipped).
- [ ] `firestore.rules` is unchanged; client writes remain denied; no new dependency added.
- [ ] Local dev works against the emulator via `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST`; `.env.local.example` and `docs/15` document it.
- [ ] All quality gates pass (or failures documented with remediation plan)
- [ ] Spec conformance review completed
- [ ] Relevant docs updated (`docs/03`, `docs/04`, `docs/15`) and ADR `0008-client-realtime-reads.md` added

## Rollout/deployment notes

- Production already ships the `NEXT_PUBLIC_FIREBASE_*` config; no new production env var is required (the emulator var is demo-only). Verify the production Firebase project's rules match `firestore.rules` (client reads require auth) before/at merge.
- No migration. Feature is additive and degrades gracefully: if the listener fails to attach (e.g., transient auth), the app behaves as today (refresh-on-own-mutation still works).

## Implementation notes

- **Files (new):**
  - `src/lib/realtime/use-activity-status.ts` (+ `.test.ts`)
  - `src/lib/realtime/subscribe.ts` (+ `.test.ts`) — `subscribeToChanges` adapter + `changeLogQuery`/`sessionsIndexQuery` builders.
  - `src/lib/realtime/use-realtime-refresh.ts` (+ `.test.tsx`)
  - `src/app/(app)/sessions/[name]/session-realtime-sync.tsx` — headless client component; builds the change_log subscribe for `sessionId`, calls the hook, renders `null`.
  - `src/app/(app)/sessions/sessions-realtime-sync.tsx` — headless client component for the index.
  - `specs/decisions/0008-client-realtime-reads.md`
- **Files (edited):**
  - `src/lib/firebase/client.ts` — extract shared `getClientApp()`; add `getClientDb()` with `connectFirestoreEmulator` for demo- projects.
  - `src/app/(app)/sessions/[name]/session-view.tsx` — render `<SessionRealtimeSync sessionId={session.id} />` (or call the hook directly).
  - `src/app/(app)/sessions/page.tsx` — render `<SessionsRealtimeSync />`.
  - `scripts/dev.mjs`, `.env.local.example`, `docs/03`, `docs/04`, `docs/15`.
- **Debounce** ~250ms so a multi-write transaction (e.g. `player_added` + `buy_in_added`) collapses into a single refresh.
- **Skip-initial** lives in the `subscribeToChanges` adapter; the "catch-up on resume" refresh lives in `useRealtimeRefresh` (explicit `onRefresh()` on the inactive→active transition) so resume doesn't rely on a snapshot firing.
- **Mobile-first:** no new UI surface, tap targets, or layout — the feature is a background data refresh, so the mobile-first hard requirements are satisfied by adding nothing visible. `router.refresh()` preserves scroll and client state, so a mobile user mid-scroll or with a modal open is not interrupted. (Called out explicitly since CLAUDE.md requires addressing mobile-first for every change.)
- **Cleanup:** hooks must detach `onSnapshot` and all activity listeners on unmount to avoid leaks across client navigations.

## Open questions

- None blocking. (Emulator public-host var name chosen to mirror the existing `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` convention: `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST`.)

## Links

- `docs/03-architecture.md` — read/write data flow and client/Admin SDK boundary
- `docs/04-security-threat-model.md` — Firestore rules posture
- `docs/15-local-development.md` — emulator env vars
- `specs/decisions/0008-client-realtime-reads.md` — (new) ADR for client realtime reads
- `specs/changes/0024-initial-buy-in-events-and-newest-first-order.md` — change_log entry coverage

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft |

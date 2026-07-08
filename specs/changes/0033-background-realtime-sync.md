# Change 0033: Background realtime sync with connection status and idle stop

## Status
Implemented

## Owner
Michi Kono

## Goal

Keep every open client's view of a session (and the sessions index) current in near-real-time while it is being watched — with a visible connection indicator and a stale-state banner — and stop syncing a forgotten, idle tab after 10 minutes of no interaction (returning to the tab, e.g. after unlocking the phone, resumes via the visibility event).

## Context

The app is designed to be used by multiple people at once during a poker game (multiple phones open on the same session). Today all reads happen in Server Components via the Admin SDK, and the client refreshes its data only when *it* performs a mutation (each Server Action call is followed by `router.refresh()` — see `session-view.tsx`, `player-list.tsx`, `settling-modal.tsx`, etc.). A change made on another device is invisible until the local user acts or manually reloads. During a live game this produces outdated local views: a player buys in on their phone, but the host's screen still shows the old total.

Relevant existing facts:
- **Every mutation writes a `change_log` entry** — `player_added`, `buy_in_added`, `buy_in_removed`, `cash_out_set`, `player_renamed`, `player_venmo_updated`, `status_changed`, `payment_marked_paid`, `payment_unmarked_paid`, `session_archived`, `player_removed` (`src/app/(app)/sessions/[name]/actions.ts`). So a single listener on a session's `change_log` collection observes **all** of the data classes the user cares about: new players, buy-ins, settlements/payments, and game state.
- **`firestore.rules` already allows authenticated client reads** on `sessions`, `players`, `buy_ins`, `payments`, and `change_log` (only writes are denied). `docs/03-architecture.md` and `docs/04-security-threat-model.md` explicitly anticipated this: "clients only read via the Admin SDK in MVP, but the rules ensure that direct client SDK reads, if ever introduced, still require auth." This change is that introduction — **no rules change is required.**
- The client currently initializes Firebase only for **Auth** (`src/lib/firebase/client.ts`). There is no client Firestore instance yet.
- `router.refresh()` re-runs the Server Component and streams fresh props **as a soft refresh** — it re-fetches server data over the existing connection and reconciles the React tree in place, preserving client state, focus, open modals, and scroll position (no full page reload). Reusing it as the "apply" step keeps all existing server-side data shaping (sorting, buy-in history grouping, payment derivation) in one place — no duplicated client logic.
- The sessions index (`src/app/(app)/sessions/page.tsx`) reads top-level `sessions` docs. "All" is currently the no-param `/sessions` route; individual statuses use `?status=<s>`. New sessions and status changes are the relevant realtime updates there.

Relevant prior specs/docs:
- `docs/03-architecture.md` — read/write data flow, client vs. Admin SDK boundary.
- `docs/04-security-threat-model.md` — Firestore rules posture.
- `docs/08-ux-spec.md` — session detail header + index filter surfaces.
- `specs/decisions/` — a new ADR records the client-read realtime decision.

## User-visible behavior

1. **Live updates while watching.** On the session detail page, when anyone changes the session — adds a player, adds/removes a buy-in, sets a cash-out, computes/settles payments, marks a payment paid, or changes status — every other open client viewing that session updates within ~1–2s, with no manual reload. It is a **soft** background refresh: scroll position, focus, and any open modals/inputs are preserved.
2. **Live index.** On the sessions list, a newly created session or a session status change appears/updates on other open clients without a manual reload.
3. **Connection status light (both surfaces, consistent placement).** A small connection light sits to the right of the page header on each live surface — **right of the "Sessions" heading** on the sessions index, and **right of the game-status badge** ("In progress", etc.) on the session detail header. It behaves identically in both places:
   - **Live:** green with a subtle, continuous pulse animation (respecting `prefers-reduced-motion` — no motion when reduced, just a steady green dot).
   - **Not live** (idle-stopped or connection lost): solid **red**, static (no pulse).
   - It is a real, thumb-sized tap target (≥44×44px). Tapping it opens a brief popover explaining the current connection state and that the app auto-updates in the background while live. Reachable by tap only — no hover dependency.
4. **Stale banner (both surfaces, consistent).** Whenever auto-refresh is not running for **any** reason — 10-minute inactivity **or** network/connection loss — the same banner appears at the top of the page warning that the view is no longer updating live (with resume guidance: interact to resume, or it reconnects when you're back online). The banner disappears automatically once live syncing resumes. The light and banner are the same components on both surfaces, driven by a shared realtime-status context, so they look and behave the same on the index and the detail page.
5. **Idle stop after 10 minutes.** If a client goes 10 minutes with no interaction — no pointer movement, scroll, key press, tap, click, or tab refocus — background syncing stops (light red, banner shown). A tab left open and forgotten stops pulling data. (While the tab is hidden — e.g. the phone is locked — the idle countdown continues; the browser also suspends the connection itself.)
6. **Return-to-tab resumes (phone unlock).** When the user brings the app back into view — unlocks the phone and sees the browser, or refocuses the tab — the `visibilitychange → visible` event counts as interaction: syncing resumes and immediately catches up. A player who glances at the app throughout the game stays live just by returning to it, with no need to tap the screen.
7. **Seamless resume.** The moment the user interacts again (moves the cursor, scrolls, taps, types, or refocuses/returns to the tab) — or the network returns — syncing resumes and the view immediately performs a single catch-up refresh, then stays live.
8. **Default session view = In Progress.** Visiting `/sessions` (no filter) now shows **In Progress** games by default (the live-game case), instead of all sessions. "All" remains available as an explicit filter (`/sessions?status=all`) from the pills and side-nav. All other filters are unchanged.

## Non-goals

- **No optimistic/streamed partial updates or client-side re-derivation.** We refresh via the existing server render path, not by mutating local state from snapshot payloads. (Keeps all data shaping server-side; avoids a second source of truth.)
- **No client-side writes.** All mutations still go through Server Actions + Admin SDK. `firestore.rules` writes stay denied.
- **No presence / "who's viewing" / typing indicators.**
- **No configurable idle timeout UI.** The 10-minute threshold is a documented constant, not a setting.
- **No device-motion / gyroscope activity source.** Considered and dropped as over-complex (thresholds + iOS permission prompts); the visibility event covers the phone-glance use case instead.
- **No change to the mutation → `router.refresh()` behavior that already exists** after local actions.
- **No rules relaxation, no new server endpoints, no WebSocket server.** Realtime uses Firestore's client `onSnapshot` (WebChannel) over the already-permitted authenticated read path.
- **No offline persistence / IndexedDB cache** enablement.

## Data model impact

None. No schema, collection, or index changes. The listeners read existing collections:
- Detail: `sessions/{sessionId}/change_log`, ordered `created_at desc`, `limit(1)` — a single-field order that needs no composite index; a new entry changes the newest doc and fires the listener.
- Index: `sessions` top-level collection, ordered `created_at desc`, `limit(200)` (mirrors the existing index-page fetch ceiling noted in `docs/03-architecture.md`); an add or a status modify within that window fires the listener.

## Diagram impact

- `docs/03-architecture.md` — the read-path graph currently shows only `RSC -- "Firestore Admin SDK" --> Firestore`. Add a client realtime read edge: `Client -- "onSnapshot (auth read)" --> Firestore`, with a note that a snapshot triggers a soft `router.refresh()` (re-running the RSC). Update the surrounding prose that says "clients only read via the Admin SDK."
- `docs/04-security-threat-model.md` — update the Firestore-rules note to reflect that client SDK reads are now actually used (rules already cover this; the prose that framed client reads as hypothetical becomes current).
- `docs/08-ux-spec.md` — document the connection light (states + tap popover) in both header positions (right of the index "Sessions" heading and right of the detail game-status badge), the shared stale banner, and the new default index filter (In Progress) with explicit "All".
- New ADR `specs/decisions/0010-client-realtime-reads.md` — record: client `onSnapshot` for realtime (over a bespoke WS server or polling), the idle-stop + visibility-resume policy, the connection-status UX, and the reaffirmed write-deny posture.

## API impact

None. No Server Action signatures change; no new routes. The realtime path is a direct client Firestore read, not an API call. The default-filter change is purely a query-param/UI routing change on the existing index page.

## Security/privacy impact

- **Introduces real client-side Firestore reads.** Within the existing rules (`allow read: if request.auth != null`) — an authenticated user can already read every session's data through the app. No broadening of exposure versus the current Admin-SDK read path (the RSC reads the same collections on behalf of the same authenticated user). Writes remain fully denied to clients.
- Listener scope is minimal: detail watches only the current session's `change_log` (limit 1); index watches the `sessions` collection the user is already allowed to list (limit 200).
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
| Local smoke test | Manual (two tabs on one session; mobile viewport for light/banner) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

TDD for the pure/deterministic pieces; Firestore wiring sits behind injectable seams so the hooks are unit-testable without the emulator, plus a manual two-tab + mobile smoke test for the real WebChannel path.

- **`resolveSessionFilter(statusParam)` (unit, TDD):** missing/invalid → `in_progress`; `"all"` → undefined (all); each valid status → itself. Drives the default-view change.
- **`deriveConnectionStatus({ active, subscribed, online, errored })` (unit, TDD):** → `"live"` only when active + subscribed + online + no error; otherwise `"paused-idle"` (inactive) or `"offline"` (network/error). Drives light color and banner copy.
- **`useActivityStatus(timeoutMs)` (unit, TDD, fake timers + jsdom):**
  - Starts `active`; goes `inactive` after `timeoutMs` with no events.
  - Each of `pointermove`, `scroll`, `keydown`, `touchstart`, `click`, and `visibilitychange→visible` resets the timer.
  - `visibilitychange→hidden` does **not** reset the timer.
  - Removes all listeners on unmount (no leak).
- **`subscribeToChanges(query, onChange, onError)` adapter (unit):** ignores the first `onSnapshot` emission (initial data), invokes `onChange` on each subsequent emission, forwards errors to `onError`, returns unsubscribe. Fake `onSnapshot` injected (no emulator).
- **`useRealtimeRefresh({ subscribe, onRefresh, idleTimeoutMs })` (unit, TDD):** inject fake `subscribe`/`onRefresh` + fake timers:
  - Subscribes while active; does **not** refresh on initial mount.
  - A change event → exactly one `onRefresh` (debounced across a burst).
  - After idle timeout → unsubscribes; later change events do nothing; reported status becomes `paused-idle`.
  - Reactivation → resubscribes **and** calls `onRefresh` once (catch-up); status returns to `live`.
  - Subscribe error / offline → status becomes `offline`.
- **Query builders `changeLogQuery` / `sessionsIndexQuery` (unit):** assert collection path, order, and limit passed to the injected query factory.
- **`ConnectionStatusLight` (component test):** consumes the realtime-status context; renders green+pulse when live, red+static otherwise; tap opens the popover; has an accessible label reflecting state; tap target ≥44px; no pulse under `prefers-reduced-motion`. Same component used on both surfaces.
- **`StaleSyncBanner` (component test):** consumes the context; renders only when not live; copy reflects idle vs offline; absent when live. Same component on both surfaces.
- **`RealtimeSyncProvider` (component test):** runs the hook via an injected `subscribe`/`onRefresh` and exposes `status` through context to child light + banner.
- **`FilterPills` / nav (unit):** "All" points to `?status=all` and is active for the all view; default (no param) marks "In Progress" active.
- **Excluded from unit tests:** the real WebChannel/emulator round-trip — covered by the manual smoke test (two tabs: mutate in A → B updates in ~1–2s; leave B idle 10 min → light red + banner; interact → catch-up; toggle offline → banner + red; on mobile viewport, lock/unlock the phone → `visibilitychange` resumes with a catch-up refresh).

## Acceptance criteria

- [ ] With two clients on the same session, a mutation in one is reflected in the other within ~2s as a soft refresh (scroll/focus/open modals preserved), no manual reload.
- [ ] With two clients on the sessions index, a newly created session and a status change appear/update on the other without manual reload.
- [ ] The connection light appears in a consistent place on both surfaces — right of the "Sessions" heading on the index, right of the status badge on the detail header — green + subtle pulse when live, solid red + static when not; pulse suppressed under `prefers-reduced-motion`.
- [ ] Tapping the light (either surface) opens a brief popover explaining the current connection state and that the app auto-updates in the background; it is a ≥44px tap target reachable without hover.
- [ ] The same stale banner appears at the top of both surfaces whenever syncing is stopped for any reason (10-min idle or connection loss) and clears when live resumes.
- [ ] After 10 minutes with no interaction (pointer/scroll/key/tap/click/refocus), syncing stops.
- [ ] Returning to the tab (`visibilitychange → visible`, e.g. unlocking the phone) resumes syncing with a single catch-up refresh; a hidden tab keeps counting down toward idle.
- [ ] Interacting again or the network returning resumes syncing with a single catch-up refresh.
- [ ] No spurious refresh on initial page load (initial snapshot skipped).
- [ ] `/sessions` (no filter) defaults to In Progress; "All" is reachable via `?status=all` from pills and nav; other filters unchanged.
- [ ] `firestore.rules` unchanged; client writes remain denied; no new dependency added.
- [ ] Local dev works against the emulator via `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST`; `.env.local.example` and `docs/15` document it.
- [ ] All quality gates pass (or failures documented with remediation plan)
- [ ] Spec conformance review completed
- [ ] Relevant docs updated (`docs/03`, `docs/04`, `docs/08`, `docs/15`) and ADR `0010-client-realtime-reads.md` added

## Rollout/deployment notes

- Production already ships the `NEXT_PUBLIC_FIREBASE_*` config; no new production env var required (the emulator var is demo-only). Verify the production Firebase project's rules match `firestore.rules` (client reads require auth) at/ before merge.
- No migration. Feature is additive and degrades gracefully: if the listener fails to attach (transient auth/network), the app behaves as today (refresh-on-own-mutation still works) and the stale banner + red light communicate the state.
- The default-view change alters the landing content of `/sessions`; anyone bookmarking `/sessions` expecting "all" now sees In Progress and can click "All".

## Implementation notes

- **Files (new):**
  - `src/lib/realtime/use-activity-status.ts` (+ `.test.ts`) — activity tracking (pointer/scroll/key/tap/click + `visibilitychange`).
  - `src/lib/realtime/subscribe.ts` (+ `.test.ts`) — `subscribeToChanges` adapter + `changeLogQuery`/`sessionsIndexQuery` builders.
  - `src/lib/realtime/connection-status.ts` (+ `.test.ts`) — status enum + `deriveConnectionStatus` + banner/popover copy map.
  - `src/lib/realtime/use-realtime-refresh.ts` (+ `.test.tsx`) — combines activity + subscription + online/offline + debounce; returns `{ status }`.
  - `src/lib/sessions/filter.ts` (+ `.test.ts`) — `resolveSessionFilter`.
  - `src/components/realtime/realtime-sync-provider.tsx` (+ test) — client provider: builds the surface's subscribe (change_log for a session, or the sessions index query), runs `useRealtimeRefresh`, and exposes `{ status }` via React context to its children. Wraps each page's content.
  - `src/components/realtime/connection-status-light.tsx` (+ test) — context-consuming light + tap popover; used on both surfaces.
  - `src/components/realtime/stale-sync-banner.tsx` (+ test) — context-consuming top banner; used on both surfaces.
  - `specs/decisions/0010-client-realtime-reads.md`
- **Files (edited):**
  - `src/lib/firebase/client.ts` — extract shared `getClientApp()`; add `getClientDb()` with `connectFirestoreEmulator` for demo- projects.
  - `src/app/(app)/sessions/[name]/session-view.tsx` — wrap content in `<RealtimeSyncProvider target=session sessionId=…>`; render `<StaleSyncBanner>` at the top and `<ConnectionStatusLight>` immediately right of `<StatusBadge>`.
  - `src/app/(app)/sessions/page.tsx` — use `resolveSessionFilter`; wrap content in `<RealtimeSyncProvider target=index>`; render `<StaleSyncBanner>` at the top and `<ConnectionStatusLight>` right of the "Sessions" `<h1>` (in a flex row).
  - `src/app/(app)/sessions/filter-pills.tsx`, `src/components/layout/nav-items.ts` — "All" → `?status=all`; active-state logic for the all view.
  - `scripts/dev.mjs`, `.env.local.example`, `docs/03`, `docs/04`, `docs/08`, `docs/15`.
- **Debounce** ~250ms so a multi-write transaction (e.g. `player_added` + `buy_in_added`) collapses into a single refresh.
- **Skip-initial** lives in `subscribeToChanges`; the "catch-up on resume" refresh lives in `useRealtimeRefresh` (explicit `onRefresh()` on inactive→active and offline→online transitions) so resume doesn't rely on a snapshot firing.
- **Shared context:** `RealtimeSyncProvider` owns the single hook instance per page and publishes `status` through context so the light (in the header) and the banner (at the top) — two different DOM positions — read the same state without prop-drilling. The provider is a client component but accepts server-rendered children (the index heading/list are passed through as children), so `page.tsx` stays a Server Component.
- **Connection state:** derive from `active` (idle hook) ∧ `subscribed` ∧ `navigator.onLine` ∧ no `onSnapshot` error. Listen to `window` `online`/`offline` and the `onError` seam.
- **Popover:** use a tap-triggered popover (Base UI Popover), not the hover `Tooltip`. Full-bleed-friendly on mobile; primary content readable at 360px.
- **Mobile-first:** the light is a ≥44px tap target (padded around a small dot) and sits in a flex header row that does not wrap or overflow at 360px on either surface (index "Sessions" heading row and detail badge row); the popover is tap-only and readable at 360px; the banner is full-width, wraps without horizontal scroll, and is safe-area aware if it renders near the top inset. Pulse animation respects `prefers-reduced-motion` (see `docs/16`/existing reduced-motion lint suppression, spec 0032). No new `<table>`; no hover-only affordances.
- **Cleanup:** hooks detach `onSnapshot`, activity listeners (incl. `visibilitychange`), and online/offline listeners on unmount.

## Open questions

- **Status-light placement wording.** The request says both "next to the game status" and "right of the sessions heading." Interpreted as: on the session **detail** header, immediately to the right of the status badge ("In progress"). Not blocking; adjust if the intent was the index page's "Sessions" heading.

## Links

- `docs/03-architecture.md` — read/write data flow and client/Admin SDK boundary
- `docs/04-security-threat-model.md` — Firestore rules posture
- `docs/08-ux-spec.md` — session header + index filters
- `docs/15-local-development.md` — emulator env vars
- `specs/decisions/0010-client-realtime-reads.md` — (new) ADR for client realtime reads
- `specs/changes/0032-reduced-motion-important-lint-suppression.md` — reduced-motion handling precedent
- `specs/changes/0024-initial-buy-in-events-and-newest-first-order.md` — change_log entry coverage

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft |
| 2026-07-08 | Proposed | Added connection light, stale banner, device motion, 10-min window, default In-Progress view |
| 2026-07-08 | Proposed | Dropped device motion; rely on visibilitychange for phone lock/unlock resume |
| 2026-07-08 | Proposed | Connection light on both surfaces (right of index heading / detail badge) via shared realtime-status context |
| 2026-07-08 | Accepted | Accepted by owner; implementation begins |
| 2026-07-08 | Implemented | Merged via implementation PR |

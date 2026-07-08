# Change 0034: Gate realtime listener on Firebase Auth readiness

## Status
Proposed

## Owner
Michi Kono

## Goal

Fix the background realtime sync (spec 0033) showing a permanent red "offline" status on load, and make recovery durable: attach the client Firestore `onSnapshot` listener only once a signed-in user is present (so the listen carries a valid auth token instead of being denied), auto-recover from a terminal listener error, and give the stale banner a "Refresh now" link for manual recovery.

## Context

Spec 0033 shipped client-side Firestore realtime listeners. On a fresh page load users see the connection light stuck **red / offline**, and it never recovers regardless of interaction.

Root cause — an auth-readiness race:
- Sign-in uses the **client SDK** (`signInWithPopup` in `sign-in-form.tsx`), which persists `currentUser` to IndexedDB. On a fresh load that user is restored **asynchronously** (`auth.authStateReady()`), so `auth.currentUser` is `null` for a brief window after mount.
- `RealtimeSyncProvider` → `useRealtimeRefresh` subscribes to Firestore **synchronously on mount** (`src/components/realtime/realtime-sync-provider.tsx`). At that instant there is no auth token, so the `onSnapshot` listen is issued unauthenticated.
- `firestore.rules` require `request.auth != null` for reads, so the listen is rejected with **PERMISSION_DENIED**. That invokes the `onSnapshot` error callback → `setErrored(true)` → `deriveConnectionStatus` returns `offline` (red).
- **No recovery:** `useRealtimeRefresh`'s subscription effect only re-runs when `active` or `online` change. Scrolling keeps `active` true (no transition), so it never resubscribes. The listener stays dead and the status stays red — matching the report ("refuses to come online", "no scroll triggers a refresh").

The mutation path already handles this correctly — `client-token.ts` awaits `auth.authStateReady()` before reading `currentUser.getIdToken()`. The realtime path skipped that step.

**Durability of recovery (current state):**
- **Network drop → reconnect:** already recovers. `useRealtimeRefresh` listens to `window` `online`/`offline`; offline tears down the listener, `online` re-runs the effect → resubscribe + catch-up refresh.
- **Transient Firebase blip (internet up):** the Firestore WebChannel retries internally and doesn't invoke our error callback — status stays live and data resumes on its own.
- **Terminal listener error (hard `onError`) while online + active:** **does not recover.** The subscription effect only re-runs on `active`/`online` changes; `errored` is never a resubscribe trigger, so the listener stays dead (stuck red). The cold-load `PERMISSION_DENIED` above is one instance; a backend/permission error mid-session is another.
- **Hard refresh:** recovers (full remount re-attaches; green after this fix).

This change closes the terminal-error gap (auto-retry) and adds a user-driven "Refresh now" recovery in the banner.

Relevant files:
- `src/components/realtime/realtime-sync-provider.tsx` — builds and starts the subscription.
- `src/lib/realtime/subscribe.ts` — `subscribeToChanges` + query builders (unchanged).
- `src/lib/firebase/client.ts` — `getClientAuth`, `getClientDb`.
- `specs/changes/0033-background-realtime-sync.md`, `specs/decisions/0010-client-realtime-reads.md`.

## User-visible behavior

1. On loading a session page or the sessions index while signed in, the connection light comes up **green (live)** and stays live; the "offline" banner no longer appears spuriously.
2. Cross-client updates work as specified in 0033 (a change on another device appears within ~1–2s).
3. Genuine offline (real network loss) still shows the red light + banner and recovers on reconnect, exactly as before.
4. If a signed-in client SDK user is ever absent (e.g. IndexedDB cleared but cookie present), the listener simply doesn't attach and no false-red is shown; the normal mutation flow redirects such a user to sign-in.
5. **Auto-recovery:** if the listener hits a terminal error while online, the connection retries on its own after a short backoff (repeating until it recovers), so it no longer sticks red indefinitely.
6. **Debounced banner (no layout thrash).** The connection **light** reflects state immediately — a brief blip turns the dot red and back with no layout change. The **banner** is debounced: it only appears after the connection has been continuously non-live for a short delay (`BANNER_SHOW_DELAY_MS`, ~10s). So momentary blips (a quick reconnect) never render the banner or move page content; only a sustained disconnect — the 10-minute idle-out, or a genuinely persistent offline/error — surfaces the hard banner message. When the connection returns to live, the banner hides immediately.
7. **"Refresh now" recovery in both places.** Both the stale banner **and** the connection-light popover include a "Refresh now" action. Tapping it force-resubscribes and pulls the latest data. Because the tap also registers as interaction, it resumes an idle-paused tab too. During the pre-banner debounce window, the badge popover is the way to see the state and trigger a manual reconnect. If the underlying problem persists, a full page refresh remains the ultimate fallback.

## Non-goals

- **No change to the 0033 UX beyond: the "Refresh now" links (banner + popover) and the banner-show debounce.** Light placement, banner tone/copy, 10-min idle stop, visibility resume, and the default In-Progress view are all unchanged. The connection light stays immediate (undebounced) so blips remain visible on the badge.
- **No exponential/complex backoff policy.** A single fixed retry interval (repeating) is enough; a tuned backoff curve is out of scope. `BANNER_SHOW_DELAY_MS` and the retry interval are documented constants, not settings.
- **No hard `window.location.reload()` for "Refresh now."** It attempts a soft reconnect (resubscribe + `router.refresh()`), preserving client state; a manual browser refresh remains available as the last resort.
- **No rules change**, no new dependency, no server changes.

## Data model impact

None.

## Diagram impact

None structural. `docs/08-ux-spec.md`: the "Stale sync banner" entry notes it is debounced (shows only after a sustained non-live period) and carries a "Refresh now" action; the "Connection status light" entry notes its popover also carries a "Refresh now" action. The 0033 data-flow note in `docs/03-architecture.md` still holds — the client read now waits for auth before attaching and auto-retries a terminal error.

## API impact

None.

## Security/privacy impact

None new — strictly tightens behavior: the listener now only reads Firestore when authenticated (matching the rules' intent), rather than attempting an unauthenticated read that gets denied. No change to exposure.

## Local development impact

None. Works identically against the emulator (emulator Auth also restores state via `authStateReady`).

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (load app signed-in → green; two-tab sync) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`RealtimeSyncProvider` (component test, extended):** with `getClientAuth` mocked to expose an `onAuthStateChanged`:
  - The Firestore subscription is **not** created while no user is present (auth callback fired with `null`).
  - Once the auth callback fires with a user, `subscribeToChanges` is created with the correct query (change_log for a session; sessions for the index).
  - Tearing down unsubscribes both the auth listener and the inner Firestore listener.
  - Re-firing the auth callback (sign-out → sign-in) detaches the old listener and attaches a new one.
- **`useRealtimeRefresh` (extended, TDD, fake timers):**
  - After a listener error, a fresh subscription is created automatically once the retry interval elapses (auto-recovery); status returns to live if the resubscribe succeeds.
  - The returned `reconnect()` clears the error, resubscribes immediately, and calls `onRefresh` once (manual recovery).
- **`StaleSyncBanner` (extended, fake timers):** does **not** render immediately when status goes non-live; renders only after `BANNER_SHOW_DELAY_MS` elapses while still non-live; a return to live before the delay means it never renders (and hides immediately if already shown). Renders a "Refresh now" control that calls the context `reconnect`.
- **`ConnectionStatusLight` (extended):** the popover includes a "Refresh now" control that calls `reconnect`. The light itself still reflects status immediately (no debounce) — red on a blip.
- Existing 0033 unit tests (`useActivityStatus`, `subscribeToChanges`, `deriveConnectionStatus`, and the unchanged parts of `useRealtimeRefresh`) remain green.
- **Manual smoke:** load a session page signed in → light green within ~1s; two-tab mutate → updates; kill network → red + banner, restore → recovers; tap "Refresh now" → attempts reconnect. (The real WebChannel/auth path stays a manual gate per 0033.)

## Acceptance criteria

- [ ] On a fresh signed-in load, the connection light is green (live) and no offline banner shows.
- [ ] The Firestore listener is attached only after `onAuthStateChanged` yields a user; never issued unauthenticated.
- [ ] Cross-client realtime updates still work (~1–2s).
- [ ] Real network offline still shows red + banner and recovers on reconnect.
- [ ] Sign-out then sign-in re-establishes the listener.
- [ ] A terminal listener error auto-retries and recovers without a manual refresh.
- [ ] The connection light reflects state immediately (red on a blip) with no layout shift; the banner only appears after a sustained non-live period (`BANNER_SHOW_DELAY_MS`) and hides immediately on recovery — a quick blip never renders the banner.
- [ ] Both the banner and the connection-light popover offer a "Refresh now" action that force-reconnects and pulls latest data; each is a ≥44px tap target.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.
- [ ] `docs/08-ux-spec.md` banner entry updated.

## Rollout/deployment notes

No env or infra changes. Purely a client-side timing fix; deploys with the normal preview → production flow.

- **Auth-gated subscribe.** In `RealtimeSyncProvider`, wrap the subscription in `onAuthStateChanged(getClientAuth(), user => …)`: on each auth change, tear down any existing Firestore listener and, if `user` is present, attach a fresh `subscribeToChanges(query, onChange, onError)`. Return an unsubscribe that removes both the auth listener and the inner listener. `onAuthStateChanged` fires immediately with the current state, so cold-load (`null` → user) is handled without extra plumbing. `subscribeToChanges` already resets its skip-initial guard per attach, so re-attaching does not cause a spurious refresh.
- **Auto-retry + `reconnect()` in `useRealtimeRefresh`.** Add a `reconnectNonce` state included in the subscription effect's deps (with a scoped `biome-ignore useExhaustiveDependencies` — it's a deliberate resubscribe trigger, not read in the body). The `onError` handler sets `errored` and schedules a `setReconnectNonce(n => n + 1)` after a fixed `RETRY_MS` (auto-recovery; the effect's cleanup clears the pending timer). Return a `reconnect()` that clears `errored`, bumps the nonce (immediate resubscribe), and calls `onRefresh()` once. The injected `subscribe` seam stays the same shape, so existing tests only extend.
- **Context exposes `reconnect`.** Change the provider context value from `ConnectionStatus` to `{ status, reconnect }`. `ConnectionStatusLight` reads `.status`; `StaleSyncBanner` reads `.status` and `.reconnect`. (Rename/adjust `useRealtimeStatus` → a `useRealtimeSync` hook, or keep a thin `useRealtimeStatus` for the light.)
- **Banner debounce.** In `StaleSyncBanner`, gate visibility on a delayed flag: an effect keyed on `isLive(status)` starts a `BANNER_SHOW_DELAY_MS` timer when non-live and sets a `show` state true on fire; going live clears the timer and sets `show` false. Return `null` until `show`. The message text still reads the current `status` at render, so a paused-idle vs offline change while shown updates copy without re-timing. The **light is not debounced** — it renders `status` directly.
- **"Refresh now" (both surfaces).** Add a Button `variant="link"` (touch-height, ≥44px tap target) calling `reconnect` — in the banner after the message, and in the `ConnectionStatusLight` popover under the description. Both clicks bubble to the window activity listener, so they also resume an idle-paused tab.

## Open questions

None.

## Links

- `specs/changes/0033-background-realtime-sync.md`
- `specs/decisions/0010-client-realtime-reads.md`
- `src/lib/auth/client-token.ts` — the existing `authStateReady()` precedent

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft — fix cold-load offline race in realtime sync |
| 2026-07-08 | Proposed | Add durable recovery: auto-retry on terminal error + "Refresh now" banner link |
| 2026-07-08 | Proposed | Debounce banner appearance (blips stay badge-only); add "Refresh now" to the light popover too |

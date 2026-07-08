# Change 0034: Gate realtime listener on Firebase Auth readiness

## Status
Proposed

## Owner
Michi Kono

## Goal

Fix the background realtime sync (spec 0033) showing a permanent red "offline" status on load: only attach the client Firestore `onSnapshot` listener once a signed-in user is present, so the listen carries a valid auth token instead of being denied.

## Context

Spec 0033 shipped client-side Firestore realtime listeners. On a fresh page load users see the connection light stuck **red / offline**, and it never recovers regardless of interaction.

Root cause — an auth-readiness race:
- Sign-in uses the **client SDK** (`signInWithPopup` in `sign-in-form.tsx`), which persists `currentUser` to IndexedDB. On a fresh load that user is restored **asynchronously** (`auth.authStateReady()`), so `auth.currentUser` is `null` for a brief window after mount.
- `RealtimeSyncProvider` → `useRealtimeRefresh` subscribes to Firestore **synchronously on mount** (`src/components/realtime/realtime-sync-provider.tsx`). At that instant there is no auth token, so the `onSnapshot` listen is issued unauthenticated.
- `firestore.rules` require `request.auth != null` for reads, so the listen is rejected with **PERMISSION_DENIED**. That invokes the `onSnapshot` error callback → `setErrored(true)` → `deriveConnectionStatus` returns `offline` (red).
- **No recovery:** `useRealtimeRefresh`'s subscription effect only re-runs when `active` or `online` change. Scrolling keeps `active` true (no transition), so it never resubscribes. The listener stays dead and the status stays red — matching the report ("refuses to come online", "no scroll triggers a refresh").

The mutation path already handles this correctly — `client-token.ts` awaits `auth.authStateReady()` before reading `currentUser.getIdToken()`. The realtime path skipped that step.

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

## Non-goals

- **No change to the 0033 UX** (light placement, banner copy, 10-min idle stop, visibility resume, default In-Progress view).
- **No new generic error-retry loop.** This fix removes the *cause* of the stuck error (unauthenticated listen). Recovery from unrelated post-attach errors still rides the existing `online`/`offline` and idle→active transitions (and now also auth-state changes). A broader retry policy is out of scope.
- **No rules change**, no new dependency, no server changes.

## Data model impact

None.

## Diagram impact

None. (The 0033 data-flow note in `docs/03-architecture.md` still holds — the client read now simply waits for auth before attaching.)

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
- Existing 0033 unit tests (`useActivityStatus`, `subscribeToChanges`, `deriveConnectionStatus`, `useRealtimeRefresh`) remain unchanged and green.
- **Manual smoke:** load a session page signed in → light is green within ~1s; open a second tab, mutate → first tab updates. (The real WebChannel/auth path stays a manual gate per 0033.)

## Acceptance criteria

- [ ] On a fresh signed-in load, the connection light is green (live) and no offline banner shows.
- [ ] The Firestore listener is attached only after `onAuthStateChanged` yields a user; never issued unauthenticated.
- [ ] Cross-client realtime updates still work (~1–2s).
- [ ] Real network offline still shows red + banner and recovers on reconnect.
- [ ] Sign-out then sign-in re-establishes the listener.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No env or infra changes. Purely a client-side timing fix; deploys with the normal preview → production flow.

## Implementation notes

- In `RealtimeSyncProvider`, wrap the subscription in `onAuthStateChanged(getClientAuth(), user => …)`: on each auth change, tear down any existing Firestore listener and, if `user` is present, attach a fresh `subscribeToChanges(query, onChange, onError)`. Return an unsubscribe that removes the auth listener and the inner listener. `onAuthStateChanged` fires immediately with the current state, so cold-load (`null` → user) is handled without extra plumbing.
- `subscribeToChanges` already resets its skip-initial guard per attach, so re-attaching on auth restore does not cause a spurious refresh.
- Keep `useRealtimeRefresh` unchanged: its injected `subscribe` seam is exactly this auth-aware function, so its tests and behavior are untouched.

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

# Change 0039: Model realtime connection health as an event-driven state machine

## Status
Implemented

## Owner
Michi Kono

## Goal

Stop the connection-status badge from getting stuck red while live updates are flowing, by replacing the fragile sticky `errored` boolean with a single, explicit listener-health state driven by ordered lifecycle events — health that any delivered snapshot (including the initial one) sets to live.

## Context

This badge has now regressed twice. Spec 0034 gated the Firestore listener on Firebase Auth readiness and added terminal-error auto-retry. Spec 0038 tried to clear the stuck-red state by resetting `errored` inside the change handler. Production still shows a **continuous red badge while cross-client updates arrive**, with a brief green flicker on load.

Root cause is a design flaw, not a missing edge case:

1. **Health and "a change to apply" are collapsed into one callback.** `subscribeToChanges` (`src/lib/realtime/subscribe.ts`) deliberately **swallows the initial snapshot** of each listener so mount/re-attach doesn't trigger a spurious `router.refresh()`. `onChange` therefore fires only on the *second and later* snapshots of a *stable* listener.
2. **Health is a sticky `errored` boolean** cleared in four scattered places: `reconnect()`, the effect body top, and (spec 0038) inside `scheduleRefresh` — i.e. inside `onChange`.
3. Because the only data-driven clear lives in `onChange`, and `onChange` never fires for a swallowed initial snapshot, the **initial snapshot of a freshly (re-)attached listener — the strongest possible proof the listener is healthy and authorized — cannot clear `errored`.**
4. The auth-gated provider (`src/components/realtime/realtime-sync-provider.tsx`) re-attaches the inner listener on **every** `onAuthStateChanged` re-fire (cold-load token restore, re-auth, token refresh). Each re-attach resets `seenInitial = false`. So in production: a transient blip sets `errored = true`; auth re-fires and attaches a healthy listener; its initial snapshot is swallowed; if no further write happens soon, `onChange` never runs and `errored` never clears. The badge stays red while the listener is live. Spec 0038 only helped the narrow case where a *second* snapshot happens to arrive on a listener that was never torn down.

The clean model separates the two concerns and makes health a single monotonic, last-event-wins state:

- **"Is the listener healthy?"** — signalled by *every* snapshot, including the initial one.
- **"Is there a change to apply?"** — signalled only by non-initial snapshots (drives the debounced refresh).

Relevant files:
- `src/lib/realtime/connection-status.ts` — `deriveConnectionStatus` + `ConnectionInputs`.
- `src/lib/realtime/use-realtime-refresh.ts` — owns the status inputs and the subscription effect.
- `src/lib/realtime/subscribe.ts` — `subscribeToChanges` (initial-snapshot handling).
- `src/components/realtime/realtime-sync-provider.tsx` — auth-gated attach/re-attach.

## User-visible behavior

1. When realtime updates are arriving — including immediately after the listener (re-)attaches and delivers its first snapshot — the connection light is **green (live)**. A stale error from an earlier blip cannot keep it red once any snapshot lands.
2. A genuine, sustained error (listener reports an error and no snapshot follows) still shows **red** and still auto-retries per 0034.
3. On first load the light is green (optimistic) while connecting; it only turns red if the listener actually errors — no false red flash.
4. Real offline (network loss) and idle-pause behavior are unchanged.

## Non-goals

- No change to the auth-gated subscribe flow's *policy* (still attach only once auth yields a user; still re-attach on auth changes), the 5s retry interval, the 250ms banner/refresh debounce, or any copy.
- No new UI state. `connecting` is an internal health value; the three user-facing statuses (`live` / `paused-idle` / `offline`) and their copy are unchanged.
- No new dependency, no Firestore rules change, no server change.

## Data model impact

None.

## Diagram impact

None. The 0033/0034 data-flow note in `docs/03-architecture.md` still holds; this change only makes the client's status self-heal on any snapshot.

## API impact

None (client-internal). `subscribeToChanges`'s callback shape changes from positional `(onChange, onError?)` to a handlers object `{ onSnapshot, onChange, onError }`; it is an internal module, not a public API.

## Security/privacy impact

None.

## Local development impact

None. Works identically against the emulator.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (two-tab: error then a re-attached listener's initial snapshot → green) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`connection-status` (TDD):** `deriveConnectionStatus` maps `health` to status — `errored → offline`; `connecting` and `live → live` (subject to `active`/`online` precedence). Replaces the `errored: boolean` cases.
- **`subscribeToChanges` (TDD):** every emission (including the initial) calls `onSnapshot`; only non-initial emissions call `onChange`; errors go to `onError`.
- **`useRealtimeRefresh` (TDD, fake timers):**
  - The reported stuck-red regression: after `onError` (status `offline`), a single `onSnapshot` — with **no** `onChange` and **no** re-subscribe — returns status to `live`. This is the case the initial-snapshot-of-a-re-attached-listener hits.
  - A snapshot cancels the pending auto-retry (recovery does not cause a spurious re-subscribe).
  - Existing behaviors hold: no refresh on initial mount; debounced refresh on a change burst; idle → `paused-idle`; reactivation catch-up; network drop → `offline`; error → `offline` + auto-retry; `reconnect()` re-subscribes with one catch-up.
- **`RealtimeSyncProvider`:** subscribe wiring updated to the handlers object; attach-only-once-authed, re-attach on sign-out/in, and teardown behaviors unchanged.

## Acceptance criteria

- [ ] Listener health is a single explicit state (`connecting | live | errored`) driven by ordered events, not a boolean cleared in multiple places.
- [ ] Any delivered snapshot, including the initial one after a (re-)attach, sets health to `live` and clears a prior error — with no `onChange` and no re-subscribe required.
- [ ] A sustained error (no following snapshot) still shows `offline` and still auto-retries; the retry is cancelled once a snapshot recovers the listener.
- [ ] Offline and idle-pause behavior unchanged; no false red flash on first load.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No env or infra changes. Client-side status fix; deploys via the normal preview → production flow.

## Implementation notes

- Introduce `ListenerHealth = "connecting" | "live" | "errored"` (in `connection-status.ts`) and change `ConnectionInputs.errored: boolean` to `health: ListenerHealth`. `deriveConnectionStatus`: `!active → paused-idle`; `!online → offline`; `health === "errored" → offline`; else `live` (so `connecting` reads green — optimistic, and a real failure trips `onError` within moments).
- `subscribeToChanges(q, { onSnapshot, onChange, onError? })`: call `onSnapshot()` on every emission; keep the `seenInitial` guard for `onChange()` only.
- In `useRealtimeRefresh`, replace `errored` with `health` state. The subscription effect sets `health = "connecting"` on (re)subscribe and passes handlers: `onSnapshot` → `setHealth("live")` and cancel the pending retry; `onChange` → debounce `onRefresh`; `onError` → `setHealth("errored")` and schedule the retry nonce bump. `reconnect()` and the retry both just bump the re-subscribe nonce (the effect sets `connecting` on re-run) — no manual boolean juggling.
- `SubscribeFn` becomes `(handlers: { onSnapshot; onChange; onError }) => Unsubscribe`; update the provider's `subscribe` to forward the handlers object into `subscribeToChanges`.

## Open questions

None.

## Links

- `specs/changes/0038-realtime-clear-error-on-snapshot.md`
- `specs/changes/0034-realtime-auth-ready-subscribe.md`
- `specs/changes/0033-background-realtime-sync.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Redesign connection health as an event-driven state machine; fix stuck-red badge at the design level |
| 2026-07-08 | Accepted | Accepted by owner; implementation begins |
| 2026-07-08 | Implemented | Merged via implementation PR |

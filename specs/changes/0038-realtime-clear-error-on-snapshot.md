# Change 0038: Clear realtime error state on a successful snapshot

## Status
Implemented

## Owner
Michi Kono

## Goal

Stop the connection-status badge from staying red while live updates are actually flowing: a successfully delivered realtime snapshot must clear any stale `errored` state so the status returns to live.

## Context

Spec 0034 gated the Firestore listener on Firebase Auth readiness and added terminal-error auto-retry. `RealtimeSyncProvider.subscribe` attaches the inner `onSnapshot` listener asynchronously inside `onAuthStateChanged`, which real Firebase fires **more than once** around cold-load token restoration and re-auth. Each auth callback tears down the old inner listener and attaches a fresh one using the **same** `onChange`/`onError` closures from the current `useRealtimeRefresh` effect run.

`useRealtimeRefresh` (`src/lib/realtime/use-realtime-refresh.ts`) sets `errored = true` from `onError` and only ever clears it in three places: `reconnect()`, and the top of the subscription effect body (which re-runs on `active`/`online`/`debounceMs`/`reconnectNonce` change). A **successful `onChange` does not clear `errored`.**

That leaves a stuck-red gap: if a first listener surfaces a transient error (`errored = true`, badge red), and a subsequent auth callback attaches a healthy listener that begins delivering changes — without an intervening effect-body re-run — data flows live but `errored` remains `true`. `deriveConnectionStatus` then returns `offline` and the badge shows a **continuous red** even though cross-client updates are arriving. This is the reported symptom: "the live auto update is happening but the connection status is continuously showing a red badge."

A delivered snapshot is definitive proof the listener is healthy, so it must reset the error state — mirroring how `online`/reactivation transitions already do.

Relevant files:
- `src/lib/realtime/use-realtime-refresh.ts` — owns `errored` and the subscription effect.
- `src/components/realtime/realtime-sync-provider.tsx` — async auth-gated attach that re-fires.
- `src/lib/realtime/connection-status.ts` — `deriveConnectionStatus`.
- `specs/changes/0034-realtime-auth-ready-subscribe.md`.

## User-visible behavior

1. When realtime updates are arriving, the connection light is **green (live)** — a stale error from an earlier blip no longer keeps it red once data resumes.
2. A genuine, sustained error (no snapshots arriving) still shows red and still auto-retries per 0034 — unchanged.
3. Real offline (network loss) and idle-pause behavior are unchanged (those are not `errored`-driven).

## Non-goals

- No change to the auth-gated subscribe flow, the retry interval, the banner debounce, or any copy.
- No change to `deriveConnectionStatus`, the light, or the banner components.
- No new dependency, no rules change, no server change.

## Data model impact

None.

## Diagram impact

None. Behavior of the existing 0033/0034 data-flow note in `docs/03-architecture.md` still holds — the client read now also self-heals its status when snapshots resume.

## API impact

None.

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
| Local smoke test | Manual (two-tab: error then resumed updates → green) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`useRealtimeRefresh` (extended, TDD, fake timers):** after `onError` sets status `offline`, emitting a subsequent `onChange` (a delivered snapshot) returns status to `live` — without a `reconnect()` or a re-subscribe. Guards the reported stuck-red-while-live regression.
- Existing 0033/0034 tests remain green (error still reports offline immediately; auto-retry and `reconnect()` behavior unchanged).

## Acceptance criteria

- [ ] A successful `onChange` after a listener error clears `errored`, so status derives to `live`.
- [ ] An error with no subsequent snapshot still shows `offline` and still auto-retries.
- [ ] Offline and idle-pause behavior unchanged.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No env or infra changes. Client-side status fix; deploys via the normal preview → production flow.

## Implementation notes

In `useRealtimeRefresh`'s subscription effect, have the change handler clear the error before scheduling the debounced refresh:

```ts
const scheduleRefresh = () => {
  setErrored(false); // a delivered snapshot proves the listener is healthy
  clearTimeout(debounce);
  debounce = setTimeout(() => onRefreshRef.current(), debounceMs);
};
```

`setErrored(false)` is a no-op when already `false` (React bails on equal state), so there is no extra render in the common live path.

## Open questions

None.

## Links

- `specs/changes/0034-realtime-auth-ready-subscribe.md`
- `specs/changes/0033-background-realtime-sync.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Fix stuck-red badge: clear errored on a successful snapshot |
| 2026-07-08 | Accepted | Accepted by owner; implementation begins |
| 2026-07-08 | Implemented | Merged via implementation PR |

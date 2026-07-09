# Change 0040: Surface the realtime listener error for diagnosis

## Status
Accepted

## Owner
Michi Kono

## Goal

Stop silently swallowing Firestore realtime listener errors so the actual cause of the production "red connection badge" can finally be identified.

## Context

The connection badge has been reported red in production across specs 0033–0039. Vercel confirms production runs commit `379fd9a`, which **includes** the spec 0039 state-machine fix (`25c7763`). A new integration test (`realtime-badge-integration.test.tsx`) proves that code renders the badge **green on any delivered snapshot**. Therefore a persistently red badge in production means the listener is **not delivering snapshots — it is erroring** — and the auto-retry's catch-up `router.refresh()` (every `RETRY_MS`) is what still makes data appear to update ("live updates work") even though the realtime listener is down.

The blocker to fixing this is that the error is **discarded**. In `use-realtime-refresh.ts` the handler is literally:

```ts
onError: () => {
  setHealth("errored");
  retry = setTimeout(() => setReconnectNonce((n) => n + 1), RETRY_MS);
},
```

`subscribeToChanges` faithfully forwards the `FirebaseError` (with its `.code`), but the hook ignores it. Four rounds of fixes have been blind because no one has ever seen the error. The `.code` is decisive: `permission-denied` points at auth/rules/App Check; `unavailable`/`failed-precondition` points at transport/index. `console.error` is already used elsewhere in the app (e.g. `sign-in-form.tsx`, `user-menu.tsx`), so logging here is consistent and lint-clean.

Relevant files:
- `src/lib/realtime/use-realtime-refresh.ts` — the `onError` handler that swallows the error.

## User-visible behavior

No user-visible change. The only difference is a `console.error` when the realtime listener errors, so the failure is visible in the browser console (and any error-reporting hook that listens to `console.error`).

## Non-goals

- No fix to the underlying listener failure yet — this change is the diagnostic that tells us which fix is correct. The remediation lands in a follow-up once the error code is known.
- No transport change: `experimentalAutoDetectLongPolling` is already the Firebase v12 default, so it is not the lever here.
- No change to the badge state machine, retry, debounce, or copy.

## Data model impact

None.

## Diagram impact

None.

## API impact

None.

## Security/privacy impact

None. The logged `FirebaseError` contains an error code and message, no user data or secrets.

## Local development impact

None. Against the emulator the listener succeeds, so nothing is logged.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`useRealtimeRefresh` (TDD):** when the injected subscribe reports an error, the hook calls `console.error` with the error (spy), in addition to the existing status→offline + auto-retry behavior (unchanged).

## Acceptance criteria

- [ ] A realtime listener error is logged via `console.error` with the underlying error.
- [ ] Status→offline and auto-retry behavior are unchanged.
- [ ] All quality gates pass.

## Rollout/deployment notes

Deploys via the normal preview → production flow. After it reaches production, reproduce the red badge and read the logged error code to pick the remediation.

## Implementation notes

Give the hook's `onError` its `error` argument and log it before setting `errored`:

```ts
onError: (error) => {
  console.error("[realtime] Firestore listener error", error);
  setHealth("errored");
  retry = setTimeout(() => setReconnectNonce((n) => n + 1), RETRY_MS);
},
```

## Open questions

The remediation depends on the error code observed in production (auth/App Check vs transport/index). Resolved by shipping this diagnostic.

## Links

- `specs/changes/0039-realtime-connection-health-state-machine.md`
- `specs/changes/0038-realtime-clear-error-on-snapshot.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-09 | Proposed | Surface swallowed realtime listener error to diagnose the persistent red badge |
| 2026-07-09 | Accepted | Accepted by owner; implementation begins |

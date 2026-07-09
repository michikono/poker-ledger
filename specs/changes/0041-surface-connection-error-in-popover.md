# Change 0041: Show the connection failure reason in the badge popover

## Status
Accepted

## Owner
Michi Kono

## Goal

Let a user on a phone see *why* the connection badge is red by tapping it — surface the realtime listener's error reason in the existing popover, instead of only in the browser console.

## Context

Spec 0040 logs the swallowed `FirebaseError` to `console.error`. But this app is **mobile-first** (see CLAUDE.md) and is primarily used on phones, where the DevTools console is effectively unreachable. So the one signal that identifies the persistent red-badge cause is invisible to the actual user.

The `ConnectionStatusLight` already has a tap popover ("Tap for details") whose body renders `CONNECTION_COPY[status].detail`, plus a "Refresh now" action when not live. Appending the error reason there — only when the status is `offline` **because of a listener error** — makes the cause self-service on-device: the user taps the red dot and reads e.g. `permission-denied`. This both unblocks the diagnosis and is a durable improvement (a "why isn't this updating?" affordance).

Relevant files:
- `src/lib/realtime/use-realtime-refresh.ts` — owns the listener error; must expose its reason.
- `src/components/realtime/realtime-sync-provider.tsx` — publishes `{ status, reconnect }` via context; add `errorReason`.
- `src/components/realtime/connection-status-light.tsx` — render the reason in the popover.

## User-visible behavior

1. When the badge is red due to a realtime listener error, tapping it shows the normal "Connection lost…" detail **plus** a short muted line: `Details: <code>` (e.g. `Details: permission-denied`).
2. When red for other reasons (real offline / idle-pause), no reason line is shown — those are not listener errors and have no code.
3. Once a snapshot arrives (or on reconnect), the reason clears along with the error state. No change to the dot, colors, retry, debounce, or banner.

## Non-goals

- No fix to the underlying listener failure — this exposes the reason so the correct remediation can be chosen/verified on-device.
- No change to `deriveConnectionStatus`, the retry/debounce, the banner copy, or the idle/offline behavior.
- No new dependency.

## Data model impact

None.

## Diagram impact

None.

## API impact

None. The realtime context type gains an optional `errorReason: string | null`.

## Security/privacy impact

None. A Firebase error code (e.g. `permission-denied`) is not sensitive and contains no user data.

## Local development impact

None. Against the emulator the listener succeeds, so no reason is shown.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Mobile viewport check | Manual (360×640: popover readable, no overflow) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`useRealtimeRefresh` (TDD):** after a listener error, the hook returns `errorReason` equal to the error's `code` (or message when no code); a subsequent snapshot clears it to `null`.
- **`ConnectionStatusLight` (TDD):** with `status: "offline"` + `errorReason`, the popover shows the reason; with `errorReason: null` it does not; live shows no popover reason.
- Existing realtime tests remain green.

## Acceptance criteria

- [ ] Listener error reason is exposed by the hook and published via context.
- [ ] Popover shows the reason only when offline-from-error; hidden otherwise.
- [ ] Reason clears on snapshot/reconnect.
- [ ] Mobile popover stays readable at 360×640 with no overflow.
- [ ] All quality gates pass.

## Rollout/deployment notes

Deploys via the normal preview → production flow. After it lands, tap the red badge on the phone to read the code and pick the remediation (e.g. initialize App Check if `permission-denied`).

## Implementation notes

- Hook: add `const [errorReason, setErrorReason] = useState<string | null>(null)`. In `onError`, derive `const code = (error as { code?: unknown }).code; setErrorReason(typeof code === "string" ? code : error.message)`. Clear (`setErrorReason(null)`) in `onSnapshot` and at the subscription-effect start. Return it.
- Provider: thread `errorReason` into the context value; extend the `RealtimeSync` type with `errorReason: string | null` (default `null`).
- Light: when `!live && errorReason`, render a muted `Details: {errorReason}` line under the description.

## Open questions

None.

## Links

- `specs/changes/0040-surface-realtime-listener-error.md`
- `specs/changes/0039-realtime-connection-health-state-machine.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-09 | Proposed | Surface the connection error reason in the badge popover for mobile users |
| 2026-07-09 | Accepted | Accepted by owner; implementation begins |

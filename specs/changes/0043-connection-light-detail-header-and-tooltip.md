# Change 0043: Keep the detail-header connection light on one row; retire the diagnostic tooltip line

## Status
Accepted

## Owner
Michi Kono

## Goal

On the session detail page, keep the connection light on the same row as the game status badge on phones, and remove the temporary `Details: <code>` diagnostic line from the badge popover now that the root cause is known.

## Context

Two follow-ups from the connection-badge investigation:

1. **Header wrap (mobile):** on the session detail header the row is `<h1>{name}</h1> <StatusBadge/> <ConnectionStatusLight/>` inside a `flex flex-wrap` container. A long session name pushes the 44×44 connection light onto a second row on narrow phones. The light must stay a ≥44px tap target (CLAUDE.md mobile rule 3), so the fix is to let the **title truncate** and stop the row from wrapping, rather than shrink the target.
2. **Diagnostic line:** spec 0041 added a `Details: <code>` line to the light's popover to surface the swallowed listener error on-device (the app is mobile-first, so the console was unreachable). It did its job — the code was `permission-denied`, root-caused to undeployed rules (spec 0042). The line is no longer needed and should be removed, along with the now-unused `errorReason` plumbing. The `console.error` from spec 0040 stays (harmless dev observability).

Relevant files:
- `src/app/(app)/sessions/[name]/session-view.tsx` — the detail header row.
- `src/components/realtime/connection-status-light.tsx` — the popover with the diagnostic line.
- `src/components/realtime/realtime-sync-provider.tsx` — publishes `errorReason` via context.
- `src/lib/realtime/use-realtime-refresh.ts` — tracks `errorReason`.

## User-visible behavior

1. On a phone (360×640), the session detail header shows the title, status badge, and connection light on **one row**; a long title truncates with an ellipsis instead of bumping the light to a second row.
2. Tapping the light still opens the popover with the status label, description, and (when not live) "Refresh now" — but **no `Details:` line**.
3. The connection light keeps its 44×44 tap target. Index page is unaffected.

## Non-goals

- No change to the light's colors, pulse, size/tap target, retry, debounce, or banner.
- No change to `console.error` logging of the listener error (spec 0040).
- No change to `deriveConnectionStatus` or connection copy.

## Data model impact

None.

## Diagram impact

None.

## API impact

None (client-internal). The realtime context drops the `errorReason` field added in 0041.

## Security/privacy impact

None.

## Local development impact

None.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Mobile viewport check | Manual (360×640: one-row header, no overflow, popover has no Details line) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **`ConnectionStatusLight` (TDD):** the popover no longer renders a `connection-error-reason` element; existing label/description/"Refresh now" behavior unchanged.
- **`useRealtimeRefresh` / provider:** drop the `errorReason` assertions added in 0041; existing status/retry/log tests stay green.
- **Header:** manual mobile-viewport check that a long title truncates and the light stays on row one (layout-only; no unit test).

## Acceptance criteria

- [ ] Detail header keeps title + status badge + light on one row at 360px; long title truncates.
- [ ] Light remains a ≥44px tap target.
- [ ] Popover no longer shows the `Details:` line; `errorReason` plumbing removed.
- [ ] All quality gates pass.

## Rollout/deployment notes

Ships with the normal app deploy. No env/infra changes.

## Implementation notes

- Header: change the inner wrapper from `flex flex-wrap items-center gap-2` to `flex items-center gap-2 min-w-0`, and give the `<h1>` `min-w-0 truncate` so it ellipsizes instead of forcing a wrap. Status badge and light stay their intrinsic size (light is already `shrink-0`).
- Remove the `{!live && errorReason && (...)}` block and the `errorReason` read in `connection-status-light.tsx`.
- Remove `errorReason` from the context type/default/value in the provider, and the `errorReason` state/return in `use-realtime-refresh.ts` (keep the `console.error`).

## Open questions

None.

## Links

- `specs/changes/0041-surface-connection-error-in-popover.md`
- `specs/changes/0042-fix-firestore-rules-deploy-pipeline.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-09 | Proposed | One-row detail header on mobile; retire the diagnostic popover line |
| 2026-07-09 | Accepted | Accepted by owner; implementation begins |

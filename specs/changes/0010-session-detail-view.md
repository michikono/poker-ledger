# Change 0010: Session Detail View

## Status
Implemented

## Owner
Michi Kono

## Goal

Replace the `/sessions/:name` stub with the full interactive session view — player management, buy-ins, cash-outs, the settling modal, payment tracking, state rollbacks, archive/unarchive, and the activity log — completing the MVP's primary gameplay loop.

## Context

The session detail page (`src/app/(app)/sessions/[name]/page.tsx`) is currently a stub that displays the session name and status badge alongside "Session view coming soon." All backend infrastructure required by this feature is already in place:

- Settlement algorithm (`src/lib/settlement/`) — spec 0006
- State transition validator (`src/lib/sessions/state-machine.ts`) — spec 0007
- Currency helpers (`src/lib/currency/`) — spec 0004
- Session types (`src/lib/sessions/types.ts`) — spec 0005
- App shell, design tokens, and `<StatusBadge>` — spec 0009

The Server Actions documented in `docs/06-api-contract.md` do **not** yet exist (except `createSession`). This spec implements them all, plus the UI that calls them.

Relevant docs: `docs/06-api-contract.md`, `docs/07-business-logic.md`, `docs/08-ux-spec.md`, `docs/05-data-model.md`.

## User-visible behavior

### Page load

A signed-in user navigating to `/sessions/:name` sees:

1. **Header** — session name (as a heading), creation date, status badge.
2. **Player table** — one row per player, ordered by `created_at ASC`. Columns: Player name, Buy-in history, Total bought in, Cash out, Net. Table footer: Total bought in, Total cashed out, Delta indicator.
3. **Session CTAs** — depends on state (see table below).
4. **Settling / payment section** — shown only when `settling` or `settled`.
5. **Activity log** — scrollable, most recent first, at the bottom of the page.

### Player table detail

Each player row while `in_progress`:
- **Name** — click-to-edit inline (pencil icon or click the text). Submits on Enter or blur; shows inline error for validation failures. Cancel on Escape.
- **Buy-in history** — each buy-in shown as a chip/tag with its amount and an `×` remove button. On mobile (< 768px) this column collapses behind a `▶` chevron; Total / Cash out / Net remain visible.
- **Total bought in** — sum of all buy-ins in cents, formatted via `formatCents`.
- **Cash out** — if set, displays formatted amount with an edit pencil. If unset, shows a "Set cash-out" button that opens an inline input. Cleared via a `×` next to the value.
- **Net** — `cash_out_cents ?? 0` minus total buy-in. Positive = green, negative = red (using `--suit-red`), zero = muted. Missing cash-out renders "—" (not zero) in the Net column.

While `settling`, `settled`, or `archived`: all columns are read-only. Net column shows the computed net. Player name is editable in `settling` and `settled` (not `archived`).

**Add buy-in** per player (while `in_progress`): a `+` button appends a new buy-in input prefilled with `Session.default_buy_in_cents` (if set) or empty. Submits on Enter or button click. Inline validation for invalid amounts.

### Table footer

- Total bought in (sum of all player buy-ins)
- Total cashed out (sum of `cash_out_cents` for players where it is non-null; null = 0 for this sum)
- **Delta indicator** — "Shortfall: $X.XX" when `total_buyin > total_cashout`; "Break even" when equal; "Over by $X.XX" (red) when cash-outs exceed buy-ins. Color: green when `cash_outs ≤ buy_ins` AND `shortfall ≤ 2% × buy_ins` AND `buy_ins > 0`; red otherwise.

### Session CTAs (by state)

| State | CTAs shown |
|---|---|
| `in_progress` | **Add player** (always), **Mark as settling** (disabled with tooltip if conditions unmet), **Archive session** |
| `settling` | **Roll back to in progress**, **Archive session** |
| `settled` | **Roll back to settling**, **Archive session** |
| `archived` | **Unarchive** |

**Add player** — opens an inline form above the player table (or as a sheet on mobile) with a single "Player name" text input and "Add" / "Cancel" buttons. Default buy-in is applied automatically server-side if the session has one. The new player row appears after the action resolves (revalidatePath).

**Mark as settling** — always visible while `in_progress` when ≥ 1 player exists. Disabled (with tooltip) when: no players, total buy-in = 0, or any player missing a cash-out. Opens the settling modal on click.

**Archive session** — opens a confirmation dialog: "Archive this session? It will be hidden from the index and can be restored from the Archived section." Two buttons: "Cancel" and "Archive". On confirm, calls `archiveSession`; on success, redirects to `/sessions`.

**Roll back** — opens a confirmation dialog appropriate to the transition. For `settling → in_progress`: "Roll back to in progress? This will delete all settlement calculations." For `settled → settling`: "Roll back to settling? All payment marks will be reset." On confirm, calls `rollbackSessionStatus`.

**Unarchive** — no confirmation dialog; calls `unarchiveSession` directly on click; page re-renders at the restored status.

### Settling modal

Opens when "Mark as settling" is clicked. Full-screen on mobile (< 768px), centered card (max-w-lg) on desktop.

Content:
- Heading: "Confirm cash-outs"
- Table: Player name | Total bought in (read-only) | Cash-out amount (editable input, prefilled with any value already set on the player, or blank)
- Delta indicator (updates in real time as inputs change)
- "Confirm" button (disabled until all conditions in `docs/07-business-logic.md` → `settling-requires-balance` and `settling-requires-all-cashouts` are met)
- Disabled-state tooltip surfaces the first unmet condition (e.g., "Billy is missing a cash-out", "Cash-outs exceed buy-ins by $5.00")
- "Cancel" button

On confirm: calls `transitionToSettling`. On success, modal closes. If `finalStatus === "settled"` (zero payments), page renders settled state with copy "Everyone broke even — nothing to settle." in place of the payment table. If error, mapped per `docs/08-ux-spec.md → Error code → UI treatment`.

### Settling / payment section (shown when `settling` or `settled`)

Heading: "Settle up"

Each payment row: "[From player name] pays [To player name] **$X.XX**"

- While `settling`: row shows "Mark as paid" button (if `paid === false`) or "Paid · Unmark" (if `paid === true`).
- While `settled`: all rows show "Paid · Unmark". Clicking Unmark immediately auto-transitions the session back to `settling` (no confirmation needed).

When the last unpaid payment is marked paid: the session auto-transitions to `settled` — no dialog. The page re-renders with all rows showing "Paid · Unmark".

Zero-payment settled state: section replaced with "Everyone broke even — nothing to settle."

### Activity log

At the bottom of the page, below the player table and settle-up section.

- Scrollable box, `max-h-[320px] md:max-h-[480px]`
- Most recent entry at top
- Each entry: relative timestamp (e.g., "5m ago", "2h ago", "Yesterday at 3:00 PM", "May 2 at 3:00 PM"), actor first name, description. `**...**` in description renders as `<strong>`.
- Empty state: "No activity yet."
- Loads up to 200 entries; no pagination in MVP.

### Error page

`src/app/(app)/sessions/[name]/error.tsx` — scoped error boundary for session read failures (Firestore down, session doc missing). Shows generic copy + "Try again" button.

## Non-goals

- Real-time / live updates (Firestore listeners). The page is server-rendered and uses `revalidatePath` after mutations. Manual refresh if another user changes the session concurrently — `SESSION_DATA_STALE` toast + reload handles the explicit conflict case.
- Session search / autocomplete (`/api/sessions/search`) — deferred.
- Archived sessions index (`/sessions/archived` route) — deferred.
- Status-filtered index views (`/sessions?status=...`) — deferred.
- Dark mode.
- Optimistic UI (client-side state updates before server confirms). All mutations await server response before re-rendering.
- Per-player buy-in limit or per-session player count limit.

## Data model impact

No schema changes. All collections and fields are already defined in `docs/05-data-model.md`. This spec only implements reads and writes against the existing schema.

## Diagram impact

`docs/01-user-flows.md` — the session detail user flow should be fleshed out if it currently lacks a flowchart for the in-progress → settling → settled path. Update or add a `flowchart` diagram after implementation.

No other diagrams are affected (state machine diagram in `docs/07-business-logic.md` is already current).

## API impact

This spec implements the following Server Actions from `docs/06-api-contract.md` (all currently unimplemented):

- `addPlayer(input, token)`
- `addBuyIn(input, token)`
- `removeBuyIn(input, token)`
- `setCashOut(input, token)`
- `updatePlayerName(input, token)`
- `transitionToSettling(input, token)`
- `markPaymentPaid(input, token)`
- `unmarkPaymentPaid(input, token)`
- `rollbackSessionStatus(input, token)`
- `archiveSession(input, token)`
- `unarchiveSession(input, token)`

These are additions only. `createSession` (already implemented in `src/app/(app)/sessions/actions.ts`) is unchanged.

All actions follow the `ActionResult<T>` pattern already established, the `requireUser(token)` auth pattern from `docs/06-api-contract.md`, and the batched-write or transaction strategy from `docs/05-data-model.md → Atomicity strategy`.

## Security/privacy impact

All mutations verify the Firebase ID token via `adminAuth.verifyIdToken(token)`. Any failure returns `UNAUTHENTICATED`. Reads are already gated by the layout-level session cookie verification (`adminAuth.verifySessionCookie`) — no change to that path.

Firestore Security Rules remain unchanged: all client writes are denied; all writes go through Admin SDK in Server Actions.

Actor name in changelog entries uses `displayName.split(' ')[0]` with `"Anonymous"` fallback — no email or UID exposed in the UI.

## Local development impact

None. The Firebase emulator already supports all collections used by this spec. No new environment variables. No new emulator services.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (see below) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (`npm run test:integration`) are not yet configured for this project. Emulator-based action tests are run via Vitest against the local emulator — these count as unit tests for gate purposes.

**Local smoke test checklist:**
- [ ] Create a session, navigate to it — header shows name, status badge "In progress"
- [ ] Add two players — both appear in table
- [ ] Add buy-in to each player — totals update
- [ ] Remove a buy-in — total decreases
- [ ] Rename a player — new name appears; activity log shows rename
- [ ] Set cash-out for each player (within 2% tolerance) — delta indicator turns green
- [ ] Click "Mark as settling" — modal opens prefilled with cash-outs
- [ ] Confirm settling — modal closes; payment rows appear
- [ ] Mark all payments paid — session auto-transitions to "Settled"
- [ ] Click "Unmark" on a payment — session auto-transitions back to "Settling"
- [ ] Roll back to in progress — payment rows disappear; buy-ins and cash-outs editable again
- [ ] Archive session — redirected to `/sessions`; session absent from index
- [ ] Navigate to archived session URL directly — page renders in archived state with Unarchive CTA
- [ ] Unarchive — page renders in restored state
- [ ] Activity log shows all actions in reverse chronological order with correct descriptions

## Test plan

**TDD targets (write tests first):**

1. **All Server Actions** — test-first against the Firebase emulator. Each action covers:
   - Happy path
   - Auth failure (`UNAUTHENTICATED`)
   - Session-state guard (e.g., `addBuyIn` rejected when `settling`)
   - Validation failures (`INVALID_AMOUNT`, `INVALID_PLAYER_NAME`, `DUPLICATE_PLAYER_NAME`)
   - Changelog entry written with correct `action_type` and `actor_name`

2. **`transitionToSettling` specifically**:
   - Balance rule boundary conditions (exactly 0%, 1.99%, 2.00%, 2.01% shortfall; overage)
   - Zero-payment path (all players break even → status goes directly to `settled`)
   - All-cash-outs-present check
   - Emulator-based concurrency test (two parallel calls; one wins, other gets `SESSION_DATA_STALE`)

3. **`markPaymentPaid` / `unmarkPaymentPaid`**:
   - Auto-settle when last unpaid payment is marked
   - Auto-unsettle when payment is unmarked from `settled`
   - Idempotency (marking already-paid = no-op)
   - Concurrency test

4. **`rollbackSessionStatus`**:
   - `settling → in_progress` deletes all Payment docs
   - `settled → settling` resets all paid marks; retains Payment docs

**UI tests (alongside implementation):**
- `<PlayerRow>` renders correct columns per state (read-only vs. editable)
- `<SettlingModal>` Confirm button enable/disable logic for each validation condition
- `<DeltaIndicator>` color transitions at 0%, 2%, and over
- `<ActivityLog>` renders `**bold**` amounts as `<strong>` tags
- Inline player-name edit: Enter submits, Escape cancels

**Not unit-tested:**
- RSC data fetching (tested via smoke test; emulator integration would require full Next.js rendering)
- Relative timestamp formatting (library behavior — assume correct)

## Acceptance criteria

- [ ] `/sessions/:name` displays the full session view (no "coming soon" copy)
- [ ] All Server Actions listed in **API impact** are implemented and match the `docs/06-api-contract.md` signatures exactly
- [ ] Player table renders correctly for all four session states (`in_progress`, `settling`, `settled`, `archived`)
- [ ] Buy-in history column collapses on mobile (< 768px)
- [ ] Cash-out inline editing works while `in_progress`; is read-only otherwise
- [ ] Player rename works in all non-archived states; in-progress edit shows inline validation
- [ ] Delta indicator color logic matches `docs/08-ux-spec.md`
- [ ] "Mark as settling" button is disabled with tooltip when conditions unmet; opens modal when enabled
- [ ] Settling modal: Confirm button disabled until all cash-outs filled and balance rule passes; real-time delta updates
- [ ] `transitionToSettling` with zero payments navigates straight to `settled` with "Everyone broke even" copy
- [ ] Payment rows show Mark/Unmark correctly per `paid` state
- [ ] Last payment marked → session auto-transitions to `settled` with no dialog
- [ ] Payment unmarked while `settled` → session auto-transitions to `settling`
- [ ] Manual rollbacks show confirmation dialogs with correct copy
- [ ] `rolling back settling → in_progress` deletes Payment docs (verified in test)
- [ ] `rolling back settled → settling` resets paid marks (verified in test)
- [ ] Archive confirmation dialog matches `docs/08-ux-spec.md` copy; on confirm, redirect to `/sessions`
- [ ] Unarchive calls `unarchiveSession`; page re-renders at restored status
- [ ] Activity log shows up to 200 entries, most-recent first, with `**amount**` rendered as `<strong>`
- [ ] All error codes map to the correct UI treatment per `docs/08-ux-spec.md → Error code → UI treatment`
- [ ] `src/app/(app)/sessions/[name]/error.tsx` exists and handles read failures
- [ ] All Server Action unit tests pass against the emulator
- [ ] All UI component unit tests pass
- [ ] Local smoke test checklist completed
- [ ] `npm run check` passes
- [ ] Spec conformance review completed
- [ ] `docs/01-user-flows.md` diagram updated to reflect the session detail flow

## Rollout/deployment notes

No new Firestore indexes are required (all needed composite indexes were defined in spec 0004/0005 and are already in `firestore.indexes.json`). No new environment variables.

The `/sessions/:name` route already exists; this spec replaces the stub in place. No routing changes.

## Implementation notes

**File layout (suggested):**

```
src/app/(app)/sessions/
  [name]/
    page.tsx                    ← RSC: fetch session + players + buy_ins + payments + log; pass to <SessionView>
    error.tsx                   ← existing stub; add meaningful copy
    actions.ts                  ← all new Server Actions (addPlayer, addBuyIn, ...)
    session-view.tsx            ← Client Component: orchestrates the full view
    player-table.tsx            ← player rows + add-player form
    player-row.tsx              ← single player row; inline edit for name + cash-out
    settling-modal.tsx          ← cash-out confirmation modal
    payment-list.tsx            ← settle-up section (payments)
    activity-log.tsx            ← scrollable changelog
    delta-indicator.tsx         ← reusable delta display (used in table footer + modal)
```

`actions.ts` in the `[name]/` directory is separate from `src/app/(app)/sessions/actions.ts` (which only has `createSession`). Consider whether to merge them or keep them separate — merging avoids duplication of `requireUser` and `MAX_AMOUNT_CENTS` constants.

**Data fetching pattern:**

Follow the parallel-fetch pattern from `docs/06-api-contract.md → Read paths`:

```ts
const [sessionSnap, playersSnap, paymentsSnap, logSnap] = await Promise.all([...]);
// Then per-player buy_ins fetch
const buyInsPerPlayer = await Promise.all(
  playersSnap.docs.map(p => p.ref.collection("buy_ins").orderBy("created_at", "asc").get())
);
```

Convert all Firestore `Timestamp` values to ISO 8601 strings before passing to Client Components.

**Inline editing convention:**

Follow the no-hard-refresh form convention from spec 0009: use `useTransition` + `useFormStatus` for pending states; call `revalidatePath("/sessions/" + sessionId)` inside each Server Action on success.

**Settling modal cash-out state:**

The modal receives the current `cash_out_cents` for each player (from the RSC data). If a player has no cash-out set yet, the input is blank. The modal manages its own local state for the inputs; it does NOT call `setCashOut` for each field — it submits all cash-outs to `transitionToSettling` in one call. The server sets `cash_out_cents` on each player as part of the `transitionToSettling` transaction.

**Payment resolution pattern:**

`markPaymentPaid` and `unmarkPaymentPaid` return `ActionResult<void>`. After a successful call, `revalidatePath` causes the RSC to re-fetch the session (including the new `status`) and re-render. The client does not need to manage payment state optimistically.

**`transitionToSettled` action:**

`docs/06-api-contract.md` documents this action for edge cases. It is NOT a required user-facing CTA in this spec — the normal flow goes through `markPaymentPaid` auto-settling. Implement it only if the edge case arises during testing.

## Open questions

None blocking. Design is fully specified in `docs/07-business-logic.md` and `docs/08-ux-spec.md`.

## Links

- `docs/06-api-contract.md` — all Server Action signatures
- `docs/07-business-logic.md` — rules for every mutation, state machine, settlement algorithm
- `docs/08-ux-spec.md` — full screen spec for session view, settling modal, activity log, error codes
- `docs/05-data-model.md` — Firestore schema and atomicity strategy
- `specs/changes/0006-settlement-algorithm.md` — settlement library (already implemented)
- `specs/changes/0007-session-state-transitions.md` — state machine validator (already implemented)
- `specs/changes/0009-ui-design-system.md` — design tokens and app shell (already implemented)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-03 | Proposed | Initial draft |
| 2026-05-03 | Accepted | Approved for implementation |
| 2026-05-03 | Implemented | Full session detail view merged in PR #21. All components, Server Actions, and tests shipped. |

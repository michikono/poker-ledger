# Change 0024: Log initial (default) buy-ins as events + newest-first buy-in order

## Status
Implemented

## Owner
Michi Kono

## Goal

Capture the auto-applied default buy-in as a real buy-in event so a player's balance lineage is complete in the history, and show buy-ins newest-first everywhere so every surface matches the history's ordering.

## Context

Two follow-ups to 0023:

1. **Missing lineage.** When a player is added to a session with a default buy-in, `addPlayer` auto-creates that first buy-in but does **not** write a `buy_in_added` changelog entry (only `player_added`). So the per-player History (0023) and the Activity log omit the starting buy-in, leaving a gap in the balance lineage ("where did the first $25 come from?").
2. **Inconsistent ordering.** Buy-ins are fetched `orderBy("created_at", "asc")` (oldest-first) and rendered oldest-first in the card pills, row pills, and the Buy-ins modal's current list — but the History (0023) is newest-first. The two orderings disagree, which is confusing.

Existing facts:
- `addPlayer` (`actions.ts`) writes `player_added` and conditionally creates the default buy-in inside one transaction (`src/app/(app)/sessions/[name]/actions.ts` ~line 120-160).
- Manual buy-ins write `action_type: "buy_in_added"` with `metadata { player_id, amount_cents, buy_in_id }`; `groupBuyInHistory` (0023) keys the per-player History off exactly those.
- The change_log is ordered `created_at desc` with a `seq` tiebreaker for same-timestamp, same-transaction entries (`seq: 0` = earlier, higher = newer; see `payment_marked_paid`/`status_changed` at `actions.ts` ~771/793, and the sort in `page.tsx`).
- Buy-ins are fetched in `page.tsx` (`buy_ins` subcollection, `orderBy created_at asc`).

Relevant prior specs:
- `specs/changes/0023-buy-in-history-and-button-audit.md` — per-player History + timestamps
- `specs/changes/0022-buy-ins-modal.md` — the Buy-ins modal

## User-visible behavior

1. **Adding a player with a default buy-in records a starting buy-in event.** That player's History (and the session Activity log) now shows the initial buy-in (e.g. `+ $25.00 · Otter · just now`), alongside the "added player" entry, ordered newest-first (the buy-in sorts just above "added player" since it's the later half of the same action).
2. **Buy-ins display newest-first everywhere** — the player card pills, the desktop row pills, and the Buy-ins modal's current list — matching the History section. The most recent buy-in is first.
3. No change to totals, amounts, add/remove behavior, or who can edit.

## Non-goals

- **No backfill.** Players added before this ships won't get a synthetic starting-buy-in event (we don't rewrite history). Their current buy-in still shows in the modal's list with its timestamp; it just won't appear in History. Going forward, new player adds are logged.
- **No new event type.** Reuse `buy_in_added` (so the existing History grouping and Activity log render it with no new handling). Only the description copy distinguishes it.
- **No change to the default-buy-in feature itself** (setting/clearing the default, auto-applying on add) beyond also logging the event.
- **No reordering of other lists** (payments, activity log, players roster) — only buy-ins.

## Data model impact

None (no schema/index changes). The `buy_in_added` changelog entry and `buy_ins` documents already exist; this adds one more changelog write in `addPlayer` and flips a query's sort direction. The change_log is read with an existing index-free `created_at` order; the `buy_ins` order flips `asc` → `desc` (single-field order, no composite index needed).

## Diagram impact

None. (`docs/01-user-flows.md` Flow 2 already says the first buy-in is created when a default is set; the only change is that it's now logged. No structural diagram change.)

## API impact

None. No Server Action signatures change. `addPlayer` gains an extra changelog write inside its existing transaction.

## Security/privacy impact

None. Same authenticated transaction; the new changelog entry is the same class of per-session audit data already written for manual buy-ins.

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
| Local smoke (desktop + 375px mobile) | Manual / Playwright | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |
| Spec conformance review | Manual | Yes | Yes | |

## Test plan

- **`addPlayer` (emulator test)**: there's an existing emulator test suite for the actions. Add/extend a case: adding a player when `default_buy_in_cents > 0` writes both a `player_added` and a `buy_in_added` changelog entry, with the buy-in entry carrying `metadata.player_id`, `amount_cents` (= default), and `buy_in_id`, and a higher `seq` than `player_added`. When no default is set, only `player_added` is written. (If the actions are covered by unit tests with a Firestore mock instead, mirror that style.)
- **`groupBuyInHistory`** already converts `buy_in_added` → a history entry; no change needed, but a test asserts an initial buy-in event (same shape) is grouped like any other.
- **Ordering**: a test (page-level if practical, else a small assertion on the display components) that buy-ins render newest-first. Most directly: verify the Buy-ins modal renders rows in the order of the `player.buyIns` prop and that `page.tsx` provides them newest-first (assert the query uses `desc`, or test via a render with a known-ordered `buyIns` array — the component renders in array order, so the ordering guarantee lives in `page.tsx`).
- Existing buy-in add/remove/history/timestamp tests still pass.

## Acceptance criteria

- [x] Adding a player with a default buy-in writes a `buy_in_added` changelog entry (correct metadata + `seq: 1`, after `player_added`'s `seq: 0`); no such entry when there's no default.
- [x] That initial buy-in appears in the player's History and the Activity log (verified: "starting buy-in" in the log, `+$25.00` in History).
- [x] Buy-ins render newest-first in the card pills, row pills, and the Buy-ins modal current list (verified: $40 above $25 after a second add) — matching History.
- [x] Totals, add/remove, and discard behavior unchanged.
- [x] All quality gates pass (667 unit tests + build); verified in-browser on mobile (393px) and desktop.
- [x] Spec conformance review completed.

## Rollout/deployment notes

None. Behavior applies to new player adds after deploy; no migration/backfill. No env vars or flags.

## Implementation notes

1. **`addPlayer` (`actions.ts`)**: inside the existing transaction, when the default buy-in is created (`defaultBuyIn > 0`), also `tx.set` a change_log entry:
   - `action_type: "buy_in_added"`, `description: \`${actorName} added ${moneyMd(defaultBuyIn)} starting buy-in for ${trimmed}.\``,
   - `metadata: { player_id: newPlayerRef.id, amount_cents: defaultBuyIn, buy_in_id: buyInRef.id }`,
   - `seq: 1`, and add `seq: 0` to the existing `player_added` entry so the buy-in sorts just after (newer than) "added player" in the newest-first log. Keep `created_at: FieldValue.serverTimestamp()`.
2. **Newest-first order (`page.tsx`)**: change the `buy_ins` fetch from `orderBy("created_at", "asc")` to `"desc"`. This flips the card pills, row pills, and modal list in one place (all render `player.buyIns` in array order). Totals are order-independent. Sanity-check no consumer relies on ascending order (totals/settlement don't).
3. Leave `groupBuyInHistory`, the modal History, and timestamps untouched — they already render newest-first.

**Pitfalls:** the two same-transaction change_log entries share a server timestamp, so the `seq` tiebreaker is what orders them — set both (`player_added` seq 0, `buy_in_added` seq 1). Don't introduce a new action_type (it would bypass the History grouping and Activity-log rendering). Don't reorder non-buy-in lists.

## Open questions

None blocking.

## Links

- `specs/changes/0023-buy-in-history-and-button-audit.md`
- `specs/changes/0022-buy-ins-modal.md`
- `src/app/(app)/sessions/[name]/actions.ts` — `addPlayer`, `seq` precedent
- `src/app/(app)/sessions/[name]/page.tsx` — `buy_ins` fetch order

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-09 | Proposed | Initial draft |
| 2026-06-09 | Accepted | Approved by owner; implementation started |
| 2026-06-09 | Implemented | Built; all gates green; verified in-browser mobile + desktop |

# Change 0023: Buy-in timestamps + per-player history, and a button-size audit

## Status
Accepted

## Owner
Michi Kono

## Goal

Make the Buy-ins modal legible at a glance — show **when** each buy-in was added (relative time), add a read-only **per-player history** of adds and removals so it's clear which buy-ins are valid, clarify the player card's buy-in vs. edit affordances, and harmonize button sizes across the player/roster modals.

## Context

Spec 0022 introduced the dedicated Buy-ins modal and the per-player "+". Field feedback surfaced four gaps:

1. **No timing.** You can't tell when a buy-in was recorded, which matters for tracking a live game ("did that rebuy already get logged?").
2. **No audit trail.** Removing a buy-in leaves no visible record, so people get confused about which buy-ins are valid. The changelog already records `buy_in_added` and `buy_in_removed` per player — we just don't surface it here.
3. **Inconsistent button sizes.** The Buy-ins modal mixes `size="touch"` (Add/Remove) with default-sized buttons (Close/Keep/Discard); sizes feel "all over the place" across the roster modals.
4. **Ambiguous card affordances.** The card's "+" is an unlabeled icon, and the "Tap to edit" hint sits right next to it — so "Tap to edit" reads as if it labels the "+".

Existing building blocks:
- `formatRelativeTime(iso)` — `src/app/(app)/sessions/[name]/format-log.tsx` ("just now", "5m ago", "3h ago", "Yesterday at…", "MMM D at…"). Reuse it.
- Buy-in `createdAt` (ISO) is already on `SessionPlayerView.buyIns` (`page.tsx`).
- Changelog (`change_log`, fetched in `page.tsx`, newest-first, capped at 200) records `buy_in_added` / `buy_in_removed` with `metadata.player_id` and `metadata.amount_cents`, plus `actor_name` and `created_at`. **`SessionLogView` currently drops `metadata`, so the fetch must be extended** to derive a per-player buy-in history.

Relevant prior specs:
- `specs/changes/0022-buy-ins-modal.md` — the Buy-ins modal and "+" affordance
- `specs/changes/0018-mobile-first-ux-overhaul.md` — button-size scale and mobile rules

## User-visible behavior

1. **Each current buy-in shows when it was added** — e.g. "added 12m ago" — in the editable buy-ins list (the "valid" buy-ins).
2. **A read-only "History" section** at the bottom of the Buy-ins modal lists this player's buy-in events newest-first: `+ $25.00 · Otter · 3m ago` for adds and a visually distinct `− $25.00 · Otter · 8m ago` (marked "removed") for removals. It's clearly read-only (no actions). Empty/absent when the player has no buy-in events. (Scope: derived from the most recent 200 changelog entries; older history beyond that cap is not shown — see Non-goals.)
3. **Player card affordances are clearer:**
   - The "+" affordance is **labeled "Buy in"** (icon + label stacked).
   - The **"Tap to edit" hint moves next to the player name** (left), away from the "+", so it clearly refers to opening the editor, not adding a buy-in.
4. **Consistent button sizes** across the Buy-ins modal, the player edit sheet, the settling modal, and the confirm dialogs (delete/discard/archive/rollback) — one size scale (mobile ≥44px, desktop dense), no ad-hoc `touch` overrides where the default already satisfies the mobile rule.

No change to how buy-ins are added/removed, to totals, or to who can edit.

## Non-goals

- **No new persisted data.** Reuse existing `buy_ins` timestamps and the `change_log`; no schema/index changes, no new event types.
- **No unbounded history.** The history reads from the existing 200-entry changelog fetch; it is not a paginated full audit log. (If a longer history is wanted later, that's a separate change.)
- **No editing/undo from the history.** It is read-only; removals are not "restore"-able from here.
- **No app-wide button refactor** beyond the player/roster modals named above (e.g. sessions index, sign-in, help modal are out of scope).
- **No change to the session-level Activity log** component or its data.
- **No live ticking.** Relative times render at request/render time (consistent with the Activity log today); they don't auto-update every minute.

## Data model impact

None (no Firestore schema/index changes). Server-side serialization changes only: extend the changelog read in `page.tsx` to expose the fields needed for the per-player buy-in history (`player_id`, `amount_cents`, `action_type`, `actor_name`, `created_at`), surfaced as a derived `buyInHistoryByPlayer` map (or by adding `metadata` to `SessionLogView`).

## Diagram impact

None. (`docs/05-data-model.md` already documents `buy_ins.created_at` and `change_log`; no structural change. `docs/01-user-flows.md` Flow 2 already covers the "+" → modal; the history is a read-only addition that doesn't change the flow.)

## API impact

None. No Server Action signatures change. Reuses `addBuyIn` / `removeBuyIn` and the existing `change_log` writes.

## Security/privacy impact

None. The buy-in history is the same per-session data already shown (aggregated) in the Activity log, now filtered to one player inside an authenticated, in-progress session view. No new exposure.

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

- **`buy-ins-modal.test.tsx`**: each current buy-in row shows a relative-time label (mock a known `createdAt`, assert "ago" text). History section renders adds and removals for the player, newest-first, with amount + actor + relative time, and marks removals distinctly; absent when there are no events; the history is read-only (no remove buttons in it). Existing add/remove/prefill/discard tests still pass.
- **Relative-time**: reuse `formatRelativeTime` (already unit-tested); add a row-level assertion via a fixed `createdAt` and injected `now` if needed (otherwise assert the "ago" suffix).
- **`page.tsx` serialization**: a unit test (or extend existing page/query tests) that `buyInHistoryByPlayer` groups `buy_in_added`/`buy_in_removed` by `player_id` with the right `kind`, `amountCents`, `actorName`. If page-level testing isn't practical, cover the pure grouping helper directly (extract it to a tested function).
- **`player-card.test.tsx`**: the "+" affordance has an accessible "Add buy-in for {name}" label and a visible "Buy in" label; the "Tap to edit" hint renders near the name.
- **Button audit**: light assertions where they add value (e.g. the modal's primary/secondary actions share a size); primarily a manual/visual gate.

## Acceptance criteria

- [ ] Current buy-in rows show "added {relative time}".
- [ ] A read-only per-player History section lists adds and removals (amount, actor, relative time), newest-first, removals visually distinct; absent when empty.
- [ ] Card "+" is labeled "Buy in"; "Tap to edit" sits next to the name, clearly separate from the "+".
- [ ] Button sizes are consistent across the Buy-ins modal, edit sheet, settling modal, and confirm dialogs (one scale; ≥44px mobile).
- [ ] No regressions to add/remove/prefill/discard behavior or totals.
- [ ] All quality gates pass; verified in-browser on mobile (375px) and desktop.
- [ ] Spec conformance review completed; relevant docs checked.

## Rollout/deployment notes

None. Client UI + server-component serialization change; feature-branch preview → production on merge. No env vars, migrations, or flags.

## Implementation notes

1. **Per-player history data** (`page.tsx`): while mapping `change_log`, also build `buyInHistoryByPlayer: Map<string, BuyInHistoryEntry[]>` (or `Record<string, ...>`) where `BuyInHistoryEntry = { id; kind: "added" | "removed"; amountCents; actorName; createdAt }`, populated from entries whose `action_type` is `buy_in_added`/`buy_in_removed`, keyed by `metadata.player_id`. Keep newest-first (the query is `created_at desc`). Thread it: `session-view` → `player-list` → `player-card`/`player-table` → `player-row` → `BuyInsModal` (each parent passes only that player's slice: `historyByPlayer.get(p.id) ?? []`). Note the 200-entry cap in a code comment.
2. **Timestamps in the current list** (`buy-ins-modal.tsx`): render `formatRelativeTime(b.createdAt)` under/next to each amount in the existing `pbi-row-*` items.
3. **History section** (`buy-ins-modal.tsx`): below the current list, a read-only section (heading "History") mapping the player's `BuyInHistoryEntry[]`; `+`/`−` sign + amount + `actorName` + `formatRelativeTime(createdAt)`; removals use a muted/struck style and a "removed" marker. New prop `history: BuyInHistoryEntry[]`. Hide the whole section when empty.
4. **Card affordances** (`player-card.tsx`): move the "Tap to edit"/"Tap for details" hint into the left cluster next to the name (inline after the name or as a small line under it). Restyle the trailing "+" strip to stack an icon + a visible "Buy in" label (keep it a sibling of the edit button; keep ≥44px target; widen slightly if needed for the label).
5. **Button-size audit**: define the convention — modal action buttons use `size="default"` (responsive h-11 mobile / h-8 desktop, which already meets the ≥44px mobile rule); drop ad-hoc `size="touch"` in `buy-ins-modal.tsx` (Add, Remove) so they match Close/Keep/Discard and the edit sheet's Cancel/Save. Sweep `settling-modal.tsx` and the confirm dialogs (`session-view.tsx` archive/rollback, the delete/discard dialogs) for stray sizes and normalize. Normalize in-button icon sizes to `size-4`. Document the convention in a short code comment where the modal buttons live.

**Pitfalls:** `SessionLogView` intentionally omits `metadata` — don't try to filter the existing log prop by player; extend the fetch. Keep relative time render-time only (no client interval). Don't reset/clobber the modal's amount when threading history (history is independent of the add state).

## Open questions

None blocking. (Resolved: history shows adds + removals read-only below the editable list; button audit covers all player/roster modals.)

## Links

- `specs/changes/0022-buy-ins-modal.md`
- `specs/changes/0018-mobile-first-ux-overhaul.md`
- `src/app/(app)/sessions/[name]/format-log.tsx` — `formatRelativeTime`
- `CLAUDE.md` — Mobile-first UX (tap targets, button-size scale)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-09 | Proposed | Initial draft |
| 2026-06-09 | Accepted | Approved by owner; implementation started |

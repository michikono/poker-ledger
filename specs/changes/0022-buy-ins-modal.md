# Change 0022: Dedicated Buy-ins modal + per-player "+" affordance

## Status
Implemented

## Owner
Michi Kono

## Goal

Move buy-in management out of the player Edit modal into a dedicated **Buy-ins modal**, opened by a mobile-friendly **"+"** on each player, so recording a buy-in is one obvious tap instead of a field buried inside the profile editor.

## Context

Adding a buy-in is the most frequent per-player action during a live game, but it currently lives inside `PlayerDetailsSheet` (the Edit modal) alongside infrequent profile edits (name, Venmo, cash-out, delete). This mixes a high-frequency quick action with low-frequency settings, and recent fixes (0014 player edits, plus the post-0021 dismissal/discard-guard fixes on `PlayerDetailsSheet`) added a "typed-but-unadded buy-in" guard precisely because the field was easy to overlook in that context.

Separating buy-ins into their own surface removes that friction and lets the Edit modal stay focused. The app is primarily managed on mobile, so the new entry point must be a thumb-friendly affordance on the roster itself.

The session already has a **default buy-in** concept (`SessionViewModel.defaultBuyInCents`, applied automatically when a new player is added, settable via `DefaultBuyInModal`). The new "+" reuses it to prefill the amount.

Relevant prior specs:
- `specs/changes/0014-venmo-payment-links-and-player-edits.md` — per-player editing surface
- `specs/changes/0018-mobile-first-ux-overhaul.md` — mobile-first primitives and rules
- `specs/changes/0010-session-detail-view.md` — roster (cards/rows) and session view

## User-visible behavior

1. **Every in-progress player shows a "+" affordance.** On mobile it's a ≥44px icon button in the top-right of the player **card**; on desktop it's an icon button in the **Buy-ins** column of the player **row**.
2. **Tapping "+" opens the Buy-ins modal** (full-bleed on mobile, centered on desktop) — not the Edit modal.
3. **The amount is prefilled to the session default** (e.g. `$25.00`) when one is set, otherwise empty. The user can accept it (one tap on "Add buy-in") or change it.
4. **Adding keeps the modal open** and resets the amount back to the prefilled default, so consecutive rebuys are fast. The buy-in list and total update, and a success toast fires.
5. **The modal lists existing buy-ins** with a per-row **Remove**, mirroring today's editor list.
6. **Closing is frictionless when nothing is pending.** If the user changed the amount but didn't add it, closing (Close button / backdrop / Escape) prompts "Discard changes?" first. An untouched prefilled amount does **not** prompt.
7. **The Edit (player details) modal no longer shows any buy-in section** — no add field, no editable list, no read-only sum line — in any status. Name, Venmo, cash-out, and delete are unchanged.
8. **The buy-in total and pills remain visible on the player card/row** (unchanged), so at-a-glance totals are preserved.
9. **No "+" and no Buy-ins modal in settling / settled / archived** (buy-ins are locked there); the card/row still display totals.

## Non-goals

- **No change to the buy-in data model or server actions.** `addBuyIn` / `removeBuyIn` are reused as-is.
- **No change to the default-buy-in feature** (`DefaultBuyInModal`, auto-apply on player creation) beyond reading `defaultBuyInCents` for the prefill.
- **No one-tap-instant-add.** The "+" opens the modal (prefilled); it does not silently add without confirmation. (Considered and rejected in planning.)
- **No edits to buy-ins while settling/settled/archived.** Editability rules are unchanged.
- **No new dependencies, env vars, or schema/index changes.**
- **No redesign of the player card/row layout** beyond inserting the "+" affordance.

## Data model impact

None. Buy-ins remain `sessions/{id}/players/{id}/buy_ins/{id}` with `amount_cents` + `created_at`. No new fields, indexes, or migrations.

## Diagram impact

- `docs/01-user-flows.md` — Flow 2 ("Adds a Player and Records Buy-ins"): updated prose + flowchart so the buy-in entry point is the per-player "+" → Buy-ins modal. (Done.) No other diagrams affected.

## API impact

None. No Server Action signatures change. `addBuyIn({ sessionId, playerId, amountCents }, token)` and `removeBuyIn({ sessionId, playerId, buyInId }, token)` are reused.

## Security/privacy impact

None. Same authenticated Server Actions via `withToken`; same `firestore.rules` (buy-in writes already go through the Admin SDK with a verified ID token). No new data exposure.

## Local development impact

None. No setup, env var, or emulator changes.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test (desktop + 375px mobile) | Manual / Playwright | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |
| Spec conformance review | Manual | Yes | Yes | |

Integration tests: none configured for this slice (consistent with prior UI specs); covered by Vitest unit tests + a manual/Playwright mobile + desktop smoke test.

## Test plan

**New `buy-ins-modal.test.tsx`** (Vitest + Testing Library, mocking `./actions`, `sonner`, `next/navigation` like `default-buy-in-modal.test.tsx`):
- Prefills the amount to the formatted default when `defaultBuyInCents = 2500` ("25.00"); empty when `null`.
- "Add buy-in" calls `addBuyIn` with `{ sessionId, playerId, amountCents }`, keeps the modal open, and resets the amount to the prefill.
- The untouched prefilled default is addable on the first tap (button enabled when the amount equals the prefill).
- Renders existing buy-ins (`pbi-row-{id}`); Remove calls `removeBuyIn`.
- Discard guard does **not** fire when closing with the untouched prefill; **does** fire when the amount was changed from the prefill ("Discard" closes, "Keep editing" stays).
- `onPlayerChanged` is called after a successful add and after a remove.

**`player-details-sheet.test.tsx`:** remove the buy-in add/remove cases; rewrite the field-order test to `name → venmo → cash out → delete`; assert **no** buy-in testids render (`pds-add-buy-in-form-*`, `pds-buy-ins-sum-*`) across in_progress / settling / archived. The dismissal and discard-guard suites (which rely on name/Venmo edits) are unaffected.

**`player-card.test.tsx` / `player-row.test.tsx`:** thread `defaultBuyInCents` through the render helpers; assert the "+" (`pbi-open-{id}`) appears only when in_progress; clicking it opens `buy-ins-modal-{id}`; (row) clicking "+" does **not** open the Edit sheet (stopPropagation regression guard); prefill propagates from `defaultBuyInCents`.

Pure logic (amount parsing/validation) already lives in `parseDollars` and is covered; no new pure-logic modules.

## Acceptance criteria

- [x] A `BuyInsModal` exists; the "+" on each in-progress player card (mobile) and row (desktop) opens it, prefilled to the session default (empty when unset).
- [x] Adding keeps the modal open, resets to the prefill, updates the list/total, and toasts; removing works.
- [x] Closing with an untouched prefill is frictionless; closing with a changed-but-unadded amount prompts to discard.
- [x] The Edit modal shows no buy-in section in in_progress, settling, and archived; the card/row still show the buy-in total.
- [x] No "+" / Buy-ins modal appears in settling / settled / archived.
- [x] Mobile-first: "+" tap target ≥44px on mobile (verified 48px); modal is full-bleed with a scrolling body and safe-area padding; no horizontal scroll at 393px width.
- [x] All quality gates pass (format, lint, type-check, 656 unit tests, build).
- [x] Spec conformance review completed.
- [x] Relevant docs/diagrams updated (`docs/01-user-flows.md` Flow 2 prose + diagram now reflect the "+" → Buy-ins modal).

## Rollout/deployment notes

None. Pure client-side UI restructure; feature-branch preview → production on merge. No env vars, migrations, or flags.

## Implementation notes

Suggested order:

1. **New `src/app/(app)/sessions/[name]/buy-ins-modal.tsx`** (`BuyInsModal`). Props: `{ open, onOpenChange, sessionId, player: SessionPlayerView, defaultBuyInCents: number | null, onPlayerChanged? }`. Replicate the full-bleed-mobile / centered-desktop scaffold from `player-details-sheet.tsx` exactly (Backdrop + Popup classNames, `grid-cols-[1fr_auto_1fr]` header, `flex-1 overflow-y-auto … pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-3` body). Reuse `addBuyIn`/`removeBuyIn` via `withToken`, `parseDollars`, `formatCents`, `describeErrorCode`, `toast`, `router.refresh()`.
   - `prefill = defaultBuyInCents && defaultBuyInCents > 0 ? (defaultBuyInCents/100).toFixed(2) : ""`.
   - Reset the amount + errors/busy **on open** (effect keyed on `[open]`, not `player`) so the buy-in list (from `player.buyIns`) refreshes via `router.refresh()` without clobbering a typed amount.
   - Add button: `variant={amount.trim() ? "default" : "outline"}`, `disabled={busy || !amount.trim()}`, `size="touch"`, full-width. On success: toast, `onPlayerChanged?.(id)`, `router.refresh()`, reset amount to `prefill`, keep open.
   - Discard guard: `pending = amount.trim() !== "" && amount.trim() !== prefill.trim()`; `attemptClose()` shows the discard confirm only when `pending`. Reuse the nested confirm `Dialog` pattern from the sheet.
   - Testids (`pbi-` prefix): `buy-ins-modal-{id}`, `pbi-amount-{id}`, `pbi-add-{id}`, `pbi-row-{bid}`, `pbi-remove-{bid}`, `pbi-close-{id}`, `pbi-discard-confirm-{id}`, `pbi-discard-keep-{id}`, `pbi-discard-confirm-yes-{id}`. Open trigger on card/row: `pbi-open-{id}`.

2. **`player-card.tsx` (mobile).** The whole card is one `<button>`; a button can't nest a button, and the modal's portaled events bubble the React tree. Add `relative` to `<article>`, `pr-14` to the edit `<button>`, and add — as **siblings** of the edit button — an `icon-touch` "+" (`absolute right-2 top-2`, `aria-label`, `pbi-open-{id}`) and `<BuyInsModal>`, both gated on `editable` (in_progress). New state `buyInsOpen`; new prop `defaultBuyInCents`. Resolve any overlap with the existing top-right "tap to edit" hint at 360px.

3. **`player-row.tsx` (desktop).** The `<tr onClick>` already guards portal-bubbled events via `currentTarget.contains(target)`, so the modal can live in the existing `<td className="hidden">`. Put an `icon-sm` "+" in the Buy-ins cell (right-aligned) with `onClick`/`onKeyDown` `stopPropagation` so it doesn't also open the Edit sheet. New state `buyInsOpen`; new prop `defaultBuyInCents`; both gated on `editable`.

4. **Strip buy-ins from `player-details-sheet.tsx`.** Remove state (`buyInDraft`, `buyInError`, `addingBuyIn`, `removingId`, `removeError`), derived (`pendingBuyIn`, `totalBuyInCents`), the `buyInsEditable` flag, handlers (`handleAddBuyIn`, `handleRemoveBuyIn`), the add fieldset JSX and the entire buy-ins list/sum ternary. Then `busy = saving || deleting`; drop the buy-in lines from the reset effect; `attemptClose` checks `dirty` only. Clean unused imports (`Plus`, `addBuyIn`, `removeBuyIn`, the `RowError` type); keep `formatCents`, `useMemo`, `Check`/`Loader2`/`Trash2`.

5. **Prop threading.** `defaultBuyInCents: number | null` from `session-view.tsx` → `player-list.tsx` → `player-card.tsx` / `player-table.tsx` → `player-row.tsx` → `BuyInsModal`. Make it a required prop and update the two test render helpers.

**Pitfalls (from prior fixes in this repo):** React portals preserve synthetic event bubbling along the *component* tree — the new modal must be a sibling of the card's edit `<button>` (not nested), and the row's "+" must `stopPropagation`. Don't reset the modal's amount on `player` changes (only on open) or a `router.refresh()` after a remove would wipe a typed amount.

## Open questions

None blocking. (Resolved in planning: "+" opens the modal prefilled rather than instant-add; the Edit modal shows no buy-in section in any status.)

## Links

- `specs/changes/0014-venmo-payment-links-and-player-edits.md`
- `specs/changes/0018-mobile-first-ux-overhaul.md`
- `specs/changes/0010-session-detail-view.md`
- `CLAUDE.md` — Mobile-first UX rules (tap targets, full-bleed modals, safe-area)
- `templates/change-spec-template.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-08 | Proposed | Initial draft |
| 2026-06-08 | Accepted | Approved by owner; implementation started |
| 2026-06-08 | Implemented | Built, all gates green (656 unit tests + build), verified in-browser on mobile + desktop |

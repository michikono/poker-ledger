# Change 0018: Mobile-first UX overhaul

## Status
Accepted (revised 2026-05-09 to include flow-level mobile fixes — see "Revision: flow-level mobile fixes" below)

## Owner
Michi Kono

## Goal

Make the app primarily usable on a phone — no horizontal scroll, thumb-sized tap targets, consistent typography per row — by replacing the desktop-first table layouts on the session detail and settling modal with mobile-card variants, hardening the shared `Button`/`Input` primitives with a `touch` size, and codifying mobile-first as a non-negotiable rule.

## Context

The app is "primarily managed via mobile" (operator's stated workflow), but every shared primitive in `src/components/ui/` is sized for a mouse pointer (`Button` default is `h-8` / 32 px; `sm` is 28 px), and the two highest-traffic surfaces — the session detail player table (`src/app/(app)/sessions/[name]/player-table.tsx`) and the settling modal (`src/app/(app)/sessions/[name]/settling-modal.tsx`) — are real HTML `<table>` elements wrapped in `overflow-x-auto`. On a 360 px viewport the user has to scroll horizontally inside the page (and again inside the modal) to reach the cash-out and Venmo inputs. Within a single player row the type sizes range from `text-xs` pills to `text-base` inputs across five columns, which the operator describes as "different font sizes everywhere on the same row".

`docs/08-ux-spec.md` previously promised "the buy-in history column collapses behind an expand chevron per row" for mobile, but that responsive collapse was never built. `CLAUDE.md` had no enforceable rule about mobile fitness, so subsequent specs (0010 session detail, 0014 Venmo links, 0017 cheatsheets) all defaulted to desktop-first patterns.

This spec lands the missing mobile collapse, rebuilds the affected primitives, and adds the binding rule + ADR escape hatch so future specs can't quietly regress.

Relevant docs / specs:
- `docs/08-ux-spec.md` (responsive behavior section, updated by this change to match what we ship)
- `CLAUDE.md` (Mobile-first UX section + non-negotiable rule #20, added by this change)
- `specs/changes/0009-ui-design-system.md` (introduced the desktop-first primitives this spec hardens)
- `specs/changes/0010-session-detail-view.md` (introduced the player table this spec rebuilds)
- `specs/changes/0014-venmo-payment-links-and-player-edits.md` (introduced the payment list and settling modal Venmo column this spec re-flows)

## User-visible behavior

After this change, every signed-in user — explicitly when their viewport is ≤ 480 px wide — sees:

1. **Session detail (`/sessions/:name`)**
   - **Header.** Session name + status badge wrap to a second line if needed. The primary CTA for the current state (Settle up / Roll back / Unarchive) is always visible. Secondary actions (Archive, alternate rollback, etc.) collapse into a "More" overflow menu on mobile and become inline buttons at `md+`.
   - **Player roster (mobile).** No horizontal scroll. Each player is its own card. Card layout, top to bottom:
     - Top row: player name (tappable to edit) + optional Venmo glyph + per-player overflow menu (Edit, Add buy-in, Delete).
     - Three-stat strip: `Total in` / `Cash out` / `Net` arranged as labeled values in a single row with one type size and `tabular-nums`. While editable, the cash-out value is itself an inline `CurrencyInput` with `touch` height; while read-only it renders the formatted amount.
     - Buy-in pills wrap below; the "remove" affordance on each pill is a 44 × 44 px tap target (visually unchanged size for the pill itself; the hit area is enlarged via `before:` pseudo-element).
     - "Add buy-in" appears as a full-width inline editor (input + Add + Cancel) when invoked, or as a single full-width button when not.
   - **Player roster (`md+`).** Renders as today's HTML table — only restyled to use the new typography rules so the per-row size mix is gone.
   - **Default-buy-in helper line.** Stacks vertically on mobile (label, then editor). Save / Cancel stack as full-width buttons on mobile, inline on `md+`.

2. **Settle-up modal (`SettlingModal`)**
   - **Mobile.** Full-bleed modal (reuses the `HelpModal` shell pattern). Each player is a stacked card with `Total in` shown as a labeled value, `Cash out` and `Venmo handle` as full-width `touch`-height inputs. Inline error messages appear under the offending field. Sticky bottom bar holds Cancel + Confirm; respects `env(safe-area-inset-bottom)`.
   - **`md+`.** Centered dialog, today's table layout preserved (tightened typography only).

3. **Payment list**
   - **Mobile.** Each payment is a card. Top row: From → To with the amount large and right-aligned. Below: Pay / QR / Mark paid as a row of `touch`-height buttons that grow to fill width when there's only one. The Venmo deep-link button has the largest hit area.
   - **`md+`.** Same flexbox layout it has today; only typography normalized.

4. **App shell header (mobile)**
   - Hamburger button is a `touch`-sized icon button (44 × 44 px hit area). Sheet drawer nav links are 44 px tall.

5. **Dialog primitive**
   - Close affordance ("X") is a `touch`-sized icon button. Footer button stack on mobile uses full-width buttons; on `md+` collapses to an inline trailing row as today.

6. **Help modal diagrams**
   - `StreetsDiagram` no longer side-scrolls at 360 px — rows wrap into a vertical list per round below the `md` breakpoint.

7. **Sign-in page** — unchanged behavior (already mobile-friendly).

The look-and-feel on `md+` is intentionally close to today's: the focus of this spec is repairing mobile, not redesigning desktop.

## Non-goals

- **Dark-mode revisions.** Tokens already work in both modes; we won't repaint anything.
- **New features.** No new player fields, no new actions, no Venmo flow changes beyond layout.
- **Replacing the activity log layout.** Already mobile-acceptable.
- **Touching `/sessions` index visual design.** Pagination CTAs and FilterPills already wrap; only their `Button` size grows because the primitive grew.
- **Internationalization or copy changes** beyond the new "More" menu labels.
- **Refactoring data layer / actions / Firestore reads.** This is presentation only.
- **Replacing `<base-ui>` with anything else.** `Button`/`Input`/`Dialog`/`Sheet` continue to wrap `@base-ui/react`.
- **Adding a new icon library.** Reuse `lucide-react` and existing in-repo icons.
- **Adding `framer-motion` or new animation deps.** Keep `tw-animate-css` only.
- **Refactoring the help-content prose.** Only `StreetsDiagram` layout changes.

## Data model impact

None. No Firestore fields, no Server Actions, no new collections.

## Diagram impact

None. `docs/08-ux-spec.md` has no mermaid diagrams in the affected sections; the prose updates land alongside this spec.

## API impact

None. No new endpoints, no Server Action signature changes.

## Security/privacy impact

None. No auth surface changes. No new data exposed in the DOM.

## Local development impact

- No new dependencies.
- No new env vars.
- No new processes or ports.
- `npm run dev` behavior unchanged.

**Files added:**
- `src/components/ui/overflow-menu.tsx` — small wrapper around the existing `dropdown-menu.tsx` primitive that defaults to a `touch`-sized icon trigger (so the session-detail header and per-player overflow share one component).
- `src/app/(app)/sessions/[name]/player-card.tsx` — the mobile-card representation of a player row. Sibling to `player-row.tsx`.
- `src/app/(app)/sessions/[name]/player-card.test.tsx` — RTL coverage of the mobile editing flow (add buy-in, edit cash-out, open edit dialog).
- `src/app/(app)/sessions/[name]/player-list.tsx` — picks `<PlayerTable>` (md+) vs. a vertical list of `<PlayerCard>` (mobile) using a CSS-only switch (no JS-based viewport detection).
- `src/app/(app)/sessions/[name]/settling-card.tsx` — mobile stacked card used inside `SettlingModal`.

**Files edited:**
- `src/components/ui/button.tsx` — add `touch` (default `h-11`, `px-4`, `text-base`) and `icon-touch` (`size-11`) variants. Existing variants stay.
- `src/components/ui/input.tsx` — add a CSS-only mobile uplift: `h-11` by default, `md:h-8` (preserves desktop density). Don't change `text-base→md:text-sm` (already correct for iOS zoom).
- `src/components/ui/dialog.tsx` — `DialogContent` default close uses `icon-touch`; `DialogFooter` becomes `flex-col gap-2 sm:flex-row sm:justify-end` with full-width buttons on mobile.
- `src/components/layout/header.tsx` — hamburger trigger uses `icon-touch`; sheet nav rows are `min-h-11`.
- `src/components/layout/nav-link.tsx` — touch-size class.
- `src/app/(app)/sessions/[name]/player-table.tsx` — keep existing table; route through `<PlayerList>` so it only renders at `md+`.
- `src/app/(app)/sessions/[name]/session-view.tsx` — header action row collapses to "More" overflow menu on mobile (primary action stays a button).
- `src/app/(app)/sessions/[name]/payment-list.tsx` — restructure each `<li>` so on mobile the action buttons become full-width below the From/To/amount line; on `md+` they reflow inline.
- `src/app/(app)/sessions/[name]/settling-modal.tsx` — split internals into desktop table view (existing) and mobile stacked-card view via `<SettlingCard>`. Modal shell uses the `HelpModal`-style full-bleed wrapper on mobile.
- `src/components/help/how-to-play.tsx` — `StreetsDiagram` stacks rows vertically below `md`.
- `src/app/(app)/sessions/page.tsx`, `session-list.tsx`, `filter-pills.tsx` — pick up the new primitive sizing automatically; minor CSS adjustments only.
- `src/app/globals.css` — add `safe-area-inset-bottom` utility usage where modals stick.
- `docs/08-ux-spec.md` — already updated alongside this spec to match what we ship.
- `CLAUDE.md` — already updated with non-negotiable rule #20 and the Mobile-first UX section.

**Files unchanged:** `src/lib/**`, `src/app/api/**`, `firestore.rules`, `firebase.json`, all Server Actions, all auth code, all tests outside the touched components, all data-model docs.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| E2E (Playwright) | `npm run test:e2e` | Where existing tests cover affected flows | Yes (best-effort) | |
| Local smoke test | Manual — see below | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Mobile fitness is verified manually (the existing Playwright config is desktop-only; adding a mobile project is a follow-up). The smoke test below uses iPhone SE 375 × 667 in DevTools as the floor.

### Local smoke test (mobile, 375 × 667)

1. Sign in.
2. From `/sessions`, open an in-progress session.
3. Confirm: no horizontal page scroll. Header CTA visible without horizontal scroll. Tap "More" → see secondary actions.
4. Tap a player card → edit dialog opens, inputs are full-width and 44 px tall.
5. Tap "Add buy-in" on a player card → inline editor expands inside the card, no scroll required.
6. Type a cash-out value → blur commits; spinner appears; result reflected.
7. Tap "Settle up" → settling modal opens full-bleed; each player is a card; sticky Confirm at the bottom; no internal horizontal scroll.
8. Confirm settle → land in settling state. Each payment shows full-width Pay / QR / Mark paid stacked.
9. Open Help → "How to play" → scroll to the streets diagram → confirm it wraps vertically without horizontal scroll.
10. Repeat at 360 × 640 to verify the smaller iPhone-mini width.

## Test plan

- **Primitive unit tests.** `Button` snapshot covers each variant (including new `touch`/`icon-touch`) for both `cva` class assembly and forwarded props.
- **`PlayerCard`** RTL test: renders read-only state for `settled`/`archived`; renders editable controls for `in_progress`; clicking "Add buy-in" reveals the inline editor; cash-out blur calls `setCashOut`; opening the edit dialog focuses the name field; delete confirmation flow.
- **`SettlingModal`** existing tests are extended with a viewport assertion that the mobile stacked layout renders when `matchMedia("(max-width: 767px)")` is true. Where jsdom doesn't reproduce the layout, fall back to a structural check that `data-slot="settling-card"` exists for each player.
- **`PaymentList`** tests assert that on mobile the action buttons render as a stacked group (`data-mobile-actions=true` attribute) and on `md+` reflow inline.
- **`Header`** test asserts the hamburger trigger is at least 44 × 44 px (via class assertion).
- **No new logic in `actions.ts` / `totals.ts`** — those tests stay as-is.

## Acceptance criteria

- [ ] Opening any session detail page at 360 × 640 produces no horizontal page scroll.
- [ ] Every primary action on the session detail and settling modal has a tap target ≥ 44 × 44 px on mobile.
- [ ] Within any single player card / row, the body type size is consistent (one body size + one supporting size).
- [ ] Settling modal on mobile is full-bleed with sticky footer; no internal horizontal scroll.
- [ ] Payment list actions on mobile are stacked full-width buttons; on `md+` they reflow inline.
- [ ] Help modal "How to play" streets diagram does not horizontally scroll at 360 px.
- [ ] All existing unit and Playwright tests pass.
- [ ] New `PlayerCard` and `SettlingCard` tests cover read-only, editable, and error states.
- [ ] `npm run check` is green.
- [ ] `CLAUDE.md` rule #20 + Mobile-first UX section are present.
- [ ] `docs/08-ux-spec.md` Responsive behavior section reflects the shipped layouts.
- [ ] Spec conformance review completed before flipping status to `Implemented`.

## Rollout/deployment notes

No env vars, no migrations. Vercel preview deploy doubles as the smoke test for the mobile experience (use Chrome DevTools device mode against the preview URL).

## Implementation notes

### Order of operations
1. Update `Button` and `Input` primitives + `Dialog` close/footer first; verify `npm run build` and existing snapshots still pass (some may need re-snap because computed classes change). Touch any one-off `size="sm"` callsites the primitive change exposes.
2. Build `<PlayerCard>` and `<PlayerList>` next; flip `session-view.tsx` to use `<PlayerList>` instead of `<PlayerTable>` directly.
3. Restructure `session-view.tsx` header into primary + overflow.
4. Restructure `payment-list.tsx` into mobile-stacked + `md+` inline.
5. Build `<SettlingCard>` and rewire `SettlingModal` to switch on viewport (CSS-only — `<table className="hidden md:table">` + `<div className="md:hidden">` pattern).
6. Adjust `StreetsDiagram` wrapping.
7. Run `npm run check`. Walk the manual smoke test on a 375 × 667 viewport.

### Pitfalls
- Avoid JS-based viewport detection. Use Tailwind responsive classes so SSR markup matches first paint.
- The base-ui `Dialog.Popup` doesn't accept arbitrary `className` patterns for full-bleed at one breakpoint and centered at another — handle it the same way `HelpModal` does today.
- `CurrencyInput` already wraps `<Input>`; the `touch`-size uplift propagates automatically. Don't pass `className="h-7 ..."` overrides — those defeat the primitive.
- Several existing snapshots / class assertions test for `h-8` literally. Update the assertions to assert intent (e.g., test for `data-slot="button"` and the variant class) rather than the literal Tailwind classnames where possible.

## Open questions

None blocking. Two for follow-up specs (out of scope here):

- Should we add a Playwright "mobile" project against a 375 × 667 viewport for regression coverage? Recommended yes, separate spec.
- Should the side-rail be made collapsible on `md` (not just hidden < `md`)? Out of scope here.

## Links

- `CLAUDE.md` — Mobile-first UX section
- `docs/08-ux-spec.md` — Responsive behavior
- `specs/changes/0009-ui-design-system.md` — original primitives
- `specs/changes/0010-session-detail-view.md` — original session detail
- `specs/changes/0014-venmo-payment-links-and-player-edits.md` — payment list & settling Venmo column
- `specs/changes/0017-cheatsheets.md` — most recent help-modal contributor

## Revision: flow-level mobile fixes (2026-05-09)

After the first implementation pass, review surfaced that the per-card editing affordances still felt non-mobile-native (tiny inline pencil; cramped × buy-in remove buttons; the "Add buy-in" button buried below the pills) and that several remaining CTAs were below the 44 × 44 px floor (FilterPills, pagination, mobile HelpButtons, drawer NavLink rows, UserMenu, "Add Venmo for X" link, default-buy-in "Change" link, help-modal example summary). This revision expands the spec to cover:

1. **`<PlayerDetailsSheet>`** (new) — full-bleed on mobile, centered dialog on `md+`. Single source of player editing: name, Venmo handle, cash-out, buy-ins (each in a row with a touch-sized Remove button), Add buy-in inline, sticky Save / Cancel / Delete footer. Replaces the per-card edit dialog and absorbs buy-in management on mobile.
2. **`<AddBuyInModal>`** (new) — small focused dialog opened from the card's primary "+ Add buy-in" CTA. One currency input + Add + Cancel; full-width controls on mobile.
3. **`<DefaultBuyInModal>`** (new) — small focused dialog for editing the session's default buy-in; replaces the inline editor in the player-list footer.
4. **Card body simplification** — `<PlayerCard>` removes the inline pencil and the per-pill `×` remove control; the buy-in pills become display-only. The card surfaces a single primary "+ Add buy-in" CTA, the cash-out inline editor (unchanged), and a More overflow menu (Edit player → opens sheet, Delete player).
5. **Tap-target sweep across remaining surfaces:**
   - `FilterPills` → `min-h-11 px-4 py-2.5` on mobile.
   - Sessions index pagination → drop `size="sm"`.
   - `HelpButtons` → default size on mobile, `sm` on `md+`.
   - Drawer `NavLink` rows → `py-3` (~ 44 px row) on mobile, dense on `md+`.
   - `UserMenu` → default-sized Log out and `Avatar size="default"` on mobile.
   - "Add Venmo for X" in `PaymentList` → outline `<Button>` with the Venmo glyph, full-width on mobile.
   - Help modal `Example` `<details>` summary → wrapped in a `min-h-11 px-3 py-2.5` row.

**Files added (revision):**
- `src/app/(app)/sessions/[name]/player-details-sheet.tsx`
- `src/app/(app)/sessions/[name]/add-buy-in-modal.tsx`
- `src/app/(app)/sessions/[name]/default-buy-in-modal.tsx`

**Files edited (revision):**
- `src/app/(app)/sessions/[name]/player-card.tsx` — simplify to delegate edit/buy-ins to sheet + modal.
- `src/app/(app)/sessions/[name]/player-card.test.tsx` — update assertions for new structure.
- `src/app/(app)/sessions/[name]/player-list.tsx` — replace inline default-buy-in editor with modal trigger.
- `src/app/(app)/sessions/[name]/payment-list.tsx` — convert Add-Venmo text link to outline button.
- `src/app/(app)/sessions/filter-pills.tsx` — touch-sized pills on mobile.
- `src/app/(app)/sessions/session-list.tsx` — pagination buttons default size.
- `src/components/layout/help-buttons.tsx` — default size on mobile.
- `src/components/layout/nav-link.tsx` — `py-3 md:py-1.5`.
- `src/components/layout/user-menu.tsx` — default sizes on mobile.
- `src/components/help/how-to-play.tsx` — `<Example>` summary wrapped in touch row.

**Acceptance criteria (revision additions):**

- [ ] Tapping a player on mobile opens a sheet that contains name, Venmo, cash-out, buy-in management, Save, Cancel, and Delete — no inline pencil affordance survives on the card.
- [ ] The card's "+ Add buy-in" is the dominant per-card CTA and opens a focused mini-modal.
- [ ] Editing the session's default buy-in opens a modal — no inline editor.
- [ ] The "Add Venmo for X" affordance in `PaymentList` is a touch-sized outline button on mobile.
- [ ] No CTA in the app — including FilterPills, pagination, drawer nav, UserMenu, mobile HelpButtons, help-modal `<Example>` summaries — falls below 44 × 44 px on mobile.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-09 | Proposed | Initial draft |
| 2026-05-09 | Accepted | Approved by owner — proceed with implementation |
| 2026-05-09 | Accepted (revised) | Review surfaced per-card flow + tap-target gaps; spec expanded to add `<PlayerDetailsSheet>`, `<AddBuyInModal>`, `<DefaultBuyInModal>`, and a tap-target sweep across remaining surfaces |

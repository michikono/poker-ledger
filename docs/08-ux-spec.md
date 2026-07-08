# 08 — UX Spec

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define all screens, their states, and their interactions. This doc drives component design and is the authoritative source for UI behavior.

---

## Design system

shadcn/ui (`base-nova` style) + Tailwind CSS v4. Define and reuse components. Centralize all CTA language and copy strings to ensure consistency. Mobile-first.

**Brand palette** (defined as CSS custom properties in `src/app/globals.css`, exposed as Tailwind utilities via `@theme inline`):
- `--felt` — deep poker-table green; primary brand color (logomark, primary CTA hover, focus accents).
- `--chip-gold` — warm gold; accent highlights, icon glyphs inside the logomark.
- `--suit-red` — card-suit red; reserved for future use (e.g., negative balances, losses).
- `--suit-black` — card-suit near-black; reserved for future use.

Brand tokens are layered on top of the neutral shadcn chrome and used sparingly. Status colors (below) are intentionally separate from brand colors so semantic meaning never collides with branding.

**Logomark:** `<CardIcon>` (`src/components/icons/card-icon.tsx`) — a rounded-rectangle playing-card outline with a centered spade glyph, themed with `--felt` and `--chip-gold`. Mirrored as a static favicon at `src/app/icon.svg`. The two must stay in visual sync (favicons can't read CSS variables).

**Status tokens:** `--status-in-progress` (emerald), `--status-settling` (amber), `--status-settled` (slate-muted), `--status-archived` (neutral). Consumed exclusively by `<StatusBadge>`.

**Casing convention:**
- Status enum values in code: `in_progress`, `settling`, `settled`, `archived` (snake_case).
- Status displayed in UI: `In progress`, `Settling`, `Settled`, `Archived` (sentence case).
- Implementation: a single helper `formatStatus(status: SessionStatus): string` is the only thing that maps enum → display string. Implemented at `src/lib/sessions/format-status.ts`.

**App shell** (implemented in spec 0009):
- `<AppShell>` wraps every authenticated page; receives `firstName` for the user menu.
- Composed from `<SideRail>` (≥ 768px), `<Header>` (< 768px), and a `<main>` content area.
- `<SideRail>` shows the logomark + title at the top, the six nav items in the middle, and the user menu at the bottom.
- `<Header>` shows a hamburger that opens a left-side `<Sheet>` drawer with the same six nav items (sourced from `src/components/layout/nav-items.ts`).

**Toaster:** `<Toaster />` (sonner) is mounted in the root layout at `bottom-right`. Toasts auto-dismiss after 4s.

---

## Navigation model

A persistent side menu (collapsible on mobile) with six items:

1. **Search** — search bar for sessions by name (same behavior as the index search)
2. **New session** — starts the session creation flow
3. **In progress** — filtered view of active sessions
4. **Settling** — filtered view of sessions in settling state
5. **Settled** — filtered view of settled sessions
6. **Archived** — filtered view of archived (soft-deleted) sessions

**Responsive behavior of the side menu:**
- ≥ 768px (Tailwind `md:`): rendered as a fixed left rail (240px wide), always visible.
- < 768px: hidden by default; opens as a full-width overlay drawer when the user taps the hamburger button in the header. Drawer closes on navigation or on tap outside.

---

## Session states

| State | Description |
|---|---|
| `in_progress` | Active game — buy-ins and cash-outs can be edited |
| `settling` | Game over — buy-ins AND cash-outs locked, settlement table shown. To edit a cash-out, roll back to `in_progress` first. |
| `settled` | Fully settled — read-only |
| `archived` | Soft-deleted — hidden from main index, visible in Archived section of side menu |

> **Note:** Earlier drafts said cash-outs could be edited during `settling`. That was changed because Payment records become stale. The canonical rule is in `docs/07-business-logic.md` → `cashout-edits-only-via-rollback-once-settling`.

---

## Screens

### Screen: Session Index (`/sessions`)

**Purpose:** List sessions, filtered by status.
**Who sees it:** Any signed-in user.

**Default filter (spec 0033):** The bare `/sessions` route redirects to `/sessions?status=in_progress` — the live-game view is the default. "All" is an explicit filter reached via the **All** pill and the "All sessions" side-nav item (`/sessions?status=all`). Other filters: Settling, Settled, Archived.

**Ordering (within a filter):**
1. Search box at top
2. Sessions, most recent first

Archived sessions appear only under the Archived filter (and the side-menu Archived section).

**Components:**
- A connection-status light sits immediately right of the "Sessions" heading (background realtime sync — see Shared components).
- Paginated list — 10 sessions per page (client-side over up to 200 fetched sessions per status group)
- Each row: session name (link), creation date, player count, status badge
- Search box — autocompletes via `/api/sessions/search`. See `docs/06-api-contract.md` for query semantics. Selecting a result (arrow + Enter or click) navigates to `/sessions/:name`.
- Empty state: prompt to start a session with a CTA button.

**States:** Loading, Empty, Populated, Error.

---

### Screen: Create session (modal)

**Purpose:** Create a new session with optional default buy-in.
**Who sees it:** Any signed-in user.
**Trigger:** "New session" CTA in the side menu, or "New session" button on the empty Index page.

**Form fields:**
- **Default buy-in (optional)** — text input, dollar format (e.g., `25` or `25.00`). Empty = no default. Validated by the currency parser (see `docs/07` → `currency-input-parsing`).

**Validation:** if the field is non-empty, must parse to a positive integer cents value ≤ 2_000_000. Otherwise inline error: "Enter a valid amount, e.g., 25 or 25.00."

**Submit:** "Create" button. While the request is in flight, the button shows a spinner and is disabled. On success, redirect to `/sessions/:name`. On error, show toast (`NAME_COLLISION` → "Couldn't create a session — please try again.") and keep the modal open.

**Empty-field semantics:** the request to `createSession` sends `defaultBuyInCents: undefined` (omitted), not zero.

---

### Screen: Session View (`/sessions/:name`)

**Purpose:** View and interact with a specific session.
**Who sees it:** Any signed-in user.

**Header:**
- Session name
- Date created
- Status badge (uses `formatStatus` for the display string)
- Connection-status light immediately right of the status badge (background realtime sync — see Shared components)

**Player table:**

| Player | Buy-ins | Total bought in | Cash out | Net |
|---|---|---|---|---|

- Each player row shows their history of buy-ins (individual amounts, removable while `in_progress`), total bought-in amount, cash-out amount, and net gain/loss.
- Per-player actions (visible while `in_progress` only): Add buy-in, Remove buy-in (per entry), Set / Edit cash-out, Rename player.
- All fields are read-only while `settling`, `settled`, or `archived`. (To edit cash-outs after `settling`, roll back to `in_progress` first.)
- Player rename is allowed in any non-archived state.

**Table footer:**
- Total bought in (sum of all player buy-ins)
- Total cashed out (sum of all player cash-outs, counting only players with a cash-out set; null counts as 0 for display)
- Delta — shortfall between total buy-ins and total cash-outs, shown prominently. Color-coded:
    - **Green** when `cash_outs ≤ buy_ins` AND `shortfall ≤ 2% × buy_ins` AND `buy_ins > 0`
    - **Red** otherwise (over-cashout, > 2% shortfall, or zero buy-ins)
- Informational only — does not gate the "Mark as settling" button.

**Session CTAs:**

| State | Available CTAs |
|---|---|
| `in_progress` | Add player, Mark as settling, Archive session |
| `settling` | Roll back to in progress, Archive session |
| `settled` | Roll back to settling, Archive session |
| `archived` | Unarchive (restores to `previous_status`) |

CTA copy is **"Archive session"** (not "Delete"). Confirmation dialog: "Archive this session? It will be hidden from the index and can be restored from the Archived section."

**"Mark as settling" button:**
- Always enabled when the session has at least one player AND `total_buy_in > 0`. (A session with players but zero buy-ins shows the button disabled with tooltip "Add a buy-in before settling.")
- On click: opens the settling modal.

**Settling modal:**
- Shows all players with three columns: name, total bought in (read-only), cash-out amount (editable input, prefilled with any prior value).
- Delta indicator updates in real time as cash-out amounts are changed. Same color rule as the player table footer.
- "Confirm" button is disabled until ALL of: every cash-out filled (non-empty); every cash-out parses to a non-negative integer ≤ 2_000_000; total cash-outs ≤ total buy-ins; shortfall ≤ 2% of total buy-ins; total buy-ins > 0.
- Disabled-state tooltip surfaces the reason (e.g., "Player Billy is missing a cash-out", "Cash-outs exceed buy-ins by $5.00").
- On confirm: client invokes `transitionToSettling`. On success, modal closes; if `finalStatus === "settled"` (zero Payments produced), the page re-renders in `settled` state with copy "Everyone broke even — nothing to settle." On failure, server error mapped per "Error code → UI treatment" below.

**Settling view (shown when `settling` or `settled`):**
- Minimum-transaction settlement table: each row is "Player A pays Player B **$X.XX**".
- While `settling`: each row shows "Mark as paid" (if unpaid) or "Paid · Unmark" (if paid).
- While `settled`: all rows show "Paid · Unmark." Clicking "Unmark" on any row immediately auto-transitions the session back to `settling` and marks that payment unpaid.
- When the last unpaid payment is marked paid while `settling`, the session immediately auto-transitions to `settled` — no confirmation dialog. The page re-renders in `settled` state.
- All signed-in users see the same Mark/Unmark controls; the audit trail records who took the action.

**Empty state (no players yet):**
- Prompt to add players with a CTA. "Mark as settling" is not shown. "Archive session" is shown.

**Empty state (zero-Payment session, settled directly):**
- After `transitionToSettling` produces zero Payments, the session is `settled` with no payment rows. UI shows "Everyone broke even — nothing to settle." plus the activity log.

**Activity log:**
- Shown at the bottom of the session view, below all player data and the settle-up section.
- Append-only list of all changes. Most recent at top.
- Each entry shows: relative timestamp (e.g., `5m ago`, `2h ago`, `Yesterday at 3:00 PM`, `May 2 at 3:00 PM`), actor first name, and the description. The description includes `**$amount**` markers which the component renders as `<strong>` (no other markdown supported).
- Tie-breaking: same-timestamp entries display in document-ID order (Firestore default).
- Container is a fixed-height (`max-h: 320px md:max-h: 480px`) scrollable box. Loads up to 200 entries per session — older entries are not shown (deferred to post-MVP; documented in `docs/03 → Known limitations`).
- Empty state: "No activity yet." (only possible for a brand-new session before its `session_created` entry — should never appear in practice).

---

## Shared components

- **Status badge** — color-coded pill for `in_progress`, `settling`, `settled`, `archived`. Implemented at `src/components/status-badge.tsx`.
- **Currency display** — `formatCents(n: number): string` in `src/lib/currency/format.ts`. Returns USD-formatted string via `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100)`. Negative values render with leading `-` (e.g., `-$25.00`).
- **Currency input** — controlled input that converts dollars → cents on submit via `parseDollars(input: string): number | null`. See `docs/07 → currency-input-parsing` for the regex and accepted formats.
- **Delta indicator** — shows balance gap with color (green when shortfall ≤ 2% AND cash-outs ≤ buy-ins AND buy-ins > 0; red otherwise).
- **Confirmation dialog** — reusable modal for destructive or significant actions (archive, manual rollback). Two-button: "Cancel" and a contextual confirm label (e.g., "Archive", "Roll back").
- **Toast notifications** — for errors and non-blocking feedback. Auto-dismiss after 4s; clickable to dismiss early.
- **Activity log entry** — timestamp + actor + description (description rendered with `**...**` → `<strong>`).
- **Connection status light** (spec 0033) — small dot shown right of the page header on the session index (right of the "Sessions" heading) and the session detail header (right of the status badge). Green with a subtle pulse when background realtime sync is live; solid red and static when it's stopped (10-minute idle or connection loss). The light reacts immediately (a blip flashes red with no layout change). Pulse is suppressed under `prefers-reduced-motion`. It's a ≥44px tap target; tapping opens a short popover explaining the connection state — and, when not live, a "Refresh now" action that force-reconnects (spec 0034). Implemented at `src/components/realtime/connection-status-light.tsx`.
- **Stale sync banner** (spec 0033, 0034) — top-of-page banner shown on both surfaces when background sync stays stopped. **Debounced and visibility-aware:** it appears only after the connection has been non-live for ~10s of *visible* time, the delay restarts on tab-visible, and it never arms while the tab is hidden — so a brief blip or a lock/unlock resume never flashes it or shifts layout; only a sustained disconnect (persistent offline, or the 10-minute idle-out) surfaces it. Carries a "Refresh now" action. Shares its state (status + reconnect) with the connection light via a realtime-sync context (`src/components/realtime/realtime-sync-provider.tsx`). Implemented at `src/components/realtime/stale-sync-banner.tsx`.

---

## Error code → UI treatment

This is the canonical mapping from server `ErrorCode` (see `docs/06-api-contract.md`) to UI behavior. All components must conform.

| Error code | UI treatment | Copy |
|---|---|---|
| `UNAUTHENTICATED` | Redirect to `/sign-in?redirect=<current path>` + toast | "Session expired — please sign in again." |
| `INVALID_INPUT` | Inline error on the offending field | Use `error.message` from server; fall back to "Invalid input." |
| `INVALID_AMOUNT` | Inline error on the amount input | "Enter a valid amount, e.g., 25 or 25.00." |
| `INVALID_PLAYER_NAME` | Inline error on the name input | "Name must be 1–50 characters." |
| `DUPLICATE_PLAYER_NAME` | Inline error on the name input | "A player with that name already exists." |
| `SESSION_NOT_FOUND` | Toast + redirect to `/sessions` | "Session not found." |
| `SESSION_NOT_EDITABLE` | Toast | "This session can't be edited in its current state." |
| `SESSION_SETTLED` | Toast | "This session is settled. Roll it back to make changes." |
| `SESSION_ARCHIVED` | Toast | "This session is archived. Unarchive it to edit." |
| `INVALID_STATE_TRANSITION` | Toast | "Can't perform that action right now." |
| `BALANCE_OUT_OF_RANGE` | Inline in the settling modal — Confirm stays disabled | Show specific reason (e.g., "Cash-outs exceed buy-ins by $5.00"). |
| `SESSION_DATA_STALE` | Toast + auto-reload | "Someone else just updated this session. Refreshing." |
| `PAYMENT_NOT_FOUND` / `PLAYER_NOT_FOUND` | Toast + auto-reload | "Some data is out of date — refreshing." |
| `NAME_COLLISION` | Toast | "Couldn't create a session — please try again." |
| `INTERNAL_ERROR` | Toast | "Something went wrong — please try again." |

**Network errors (action did not reach server):** toast "Network error — check your connection." with a "Retry" action.

---

## Error boundaries

- `src/app/(app)/error.tsx` — fallback for any error in the `(app)` route group. Renders generic copy plus a "Try again" button (`reset()`).
- `src/app/(app)/sessions/error.tsx` — scoped error boundary for the index page (already exists from spec 0004).
- `src/app/(app)/sessions/[name]/error.tsx` — scoped error boundary for the session view. Handles Firestore read failures.
- `src/app/global-error.tsx` — root-level fallback for fatal layout errors. Returns minimal HTML (no auth context).

Error boundaries do not log to a third-party service in MVP — Vercel function logs are sufficient. Documented as a known limitation.

---

## Responsive behavior

**Mobile-first is mandatory.** See `CLAUDE.md → Mobile-first UX` for the binding rules. This section names the specific shapes each surface takes at each breakpoint; deviating from any rule requires an ADR in `/specs/decisions/`.

Tailwind breakpoints used:
- Default (mobile, ≥ 360 px): single-column layout, side menu hidden behind hamburger, primitives use the `touch` size variants (≥ 44 × 44 px tap targets).
- `md:` (768 px+): two-column layout (rail + content). Tabular surfaces may upgrade to real `<table>` elements; primitives may step down to dense desktop sizes.
- `lg:` (1024 px+): wider content; modals stay centered with `max-w-*`.

**Specific responsive rules:**
- **Session detail header:** primary CTA stays visible at all widths. Secondary actions (rollback, archive, unarchive) collapse into an overflow "More" menu on mobile and become a row of buttons on `md+`.
- **Player roster on mobile (< 768 px):** rendered as a vertical list of player cards — name + Venmo glyph in the top row, total in / cash out / net stacked beneath, buy-in pills wrap below, and a "More" affordance per row holds Add buy-in / Edit / Delete. **No horizontal scroll permitted.**
- **Player roster on `md+`:** rendered as a real `<table>` with the columns documented in "Session View" above.
- **Settling modal on mobile:** rendered full-screen (`HelpModal`-style shell), one player per stacked card, sticky footer with Confirm/Cancel respecting `env(safe-area-inset-bottom)`. On `md+` it becomes a centered dialog with the multi-column table.
- **Payment list on mobile:** each payment is a card with the From/To pair on a single line, amount large and right-aligned, and Pay / QR / Mark paid laid out as full-width tappable buttons stacked beneath. On `md+` controls reflow inline.
- **Activity log on mobile:** same scrollable box, max-height 320 px (vs. 480 px on desktop).
- **Side menu drawer:** slides in from left, takes ~ 80% viewport width, has a backdrop. Nav items use `touch`-sized rows.
- **Help modal:** `HelpModal` is full-bleed on mobile with a sticky bottom Close button. Inline diagrams must wrap, not horizontally scroll, at 360 px.

---

## Accessibility requirements

No specific requirements for MVP. Use shadcn/ui defaults (they are accessible by default). Future considerations: focus-trap in modals; `aria-live` on the activity log; keyboard shortcuts.

---

## Empty states

- **Index — no sessions:** "No sessions yet. Start a new one." with a "New session" CTA button.
- **Session — no players:** "No players yet. Add the first one." with an "Add player" CTA. "Mark as settling" is not shown. "Archive session" is shown.
- **Session — zero-Payment settled:** "Everyone broke even — nothing to settle." (shown when `transitionToSettling` produced zero Payments and the session went straight to `settled`.)
- **Search — no results:** "No sessions match your search."

---

## Related docs

- `01-user-flows.md`
- `02-domain-model.md`
- `12-mvp-scope.md`
- `07-business-logic.md`
- `06-api-contract.md`

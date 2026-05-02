# 08 — UX Spec

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define all screens, their states, and their interactions. This doc drives component design and is the authoritative source for UI behavior.

---

## Design system

shadcn/ui + Tailwind CSS. Define and reuse components. Centralize all CTA language to ensure consistency. Mobile-first.

---

## Navigation model

A persistent side menu (collapsible on mobile) with six items:

1. **Search** — search bar for sessions by name (same behavior as the index search)
2. **New session** — starts the session creation flow
3. **In Progress** — filtered view of active sessions
4. **Settling** — filtered view of sessions in settling state
5. **Settled** — filtered view of settled sessions
6. **Archived** — filtered view of archived (soft-deleted) sessions

---

## Session states

| State | Description |
|---|---|
| `in_progress` | Active game — buy-ins and cash-outs can be edited |
| `settling` | Game over — buy-ins locked, cash-outs editable, settlement shown |
| `settled` | Fully settled — read-only |
| `archived` | Soft-deleted — hidden from main index, visible in Archived section of side menu |

---

## Screens

### Screen: Session Index (`/sessions`)

**Purpose:** List all sessions ordered by status then recency.
**Who sees it:** Any signed-in user.

**Ordering:**
1. Search box - a field to find any session
2. In Progress (most recent first)
3. Settling (most recent first)
4. Settled (most recent first)
Archived sessions are hidden from this page. Access them via the Archived section in the side menu.

**Components:**
- Paginated list — 10 sessions per page
- Each row: session name, date, number of players, status badge
- Search box — autocompletes as you type with matching session names (wildcard). Results ordered: alphabetical match first, then most recent. Selecting a result (arrow + Enter or click) navigates to `/sessions/:name`.
- Empty state: prompt to start a session with a CTA button.

**States:** Loading, Empty, Populated, Error

---

### Screen: Session View (`/sessions/:name`)

**Purpose:** View and interact with a specific session.
**Who sees it:** Any signed-in user.

**Header:**
- Session name
- Date created
- Status badge

**Player table:**

| Player | Buy-ins | Total bought in | Cash out | Net |
|---|---|---|---|---|

- Each player row shows their history of buy-ins (individual amounts, removable while `in_progress`), total bought-in amount, cash-out amount (editable), and net gain/loss.
- Per-player actions (visible while `in_progress`): Add buy-in, Remove buy-in (per entry), Set / Edit cash-out.
- Cash-out is editable while `settling` but buy-ins are locked.
- All fields are read-only while `settled`.

**Table footer:**
- Total bought in (sum of all player buy-ins)
- Total cashed out (sum of all player cash-outs, counting only players with a cash-out set)
- Delta — shortfall between total buy-ins and total cash-outs, shown prominently. Color-coded: green when shortfall ≤ 2% and cash-outs do not exceed buy-ins; red otherwise. Informational only — does not gate the "Mark as Settling" button.

**Session CTAs:**

| State | Available CTAs |
|---|---|
| `in_progress` | Add Player, Mark as Settling, Delete (archive) |
| `settling` | Roll Back to In Progress, Delete (archive) |
| `settled` | Roll Back to Settling, Delete (archive) |
| `archived` | Unarchive (restores to pre-archive status) |

**"Mark as Settling" button:**
- Always enabled when the session has at least one player. Validation happens inside the modal, not on the button.
- On click: opens the settling modal (see below).

**Settling modal:**
- Shows all players with two columns: total bought in (read-only) and cash-out amount (editable input, prefilled with any prior value).
- Delta indicator updates in real time as cash-out amounts are changed. Shows the shortfall between total buy-ins and total cash-outs.
- "Confirm" button inside the modal is disabled until: all cash-out fields are filled, total cash-outs ≤ total buy-ins, and shortfall ≤ 2% of total buy-ins.
- On confirm: server validates and transitions session to `settling`.

**Settling view (shown when `settling` or `settled`):**
- Minimum-transaction settlement table: shows each payment (who pays whom, how much).
- While `settling`: each payment row shows "Mark as Paid" (if unpaid) or "Paid / Unmark" (if paid).
- While `settled`: all rows show "Paid / Unmark." Clicking "Unmark" on any row immediately auto-transitions the session back to `settling` and marks that payment unpaid.
- When the last unpaid payment is marked paid while `settling`, the session immediately and automatically transitions to `settled` — no confirmation dialog.

**Empty state (no players yet):**
- Prompt to add players with a CTA. "Mark as Settling" is not shown. "Delete session" is shown.

**Activity log:**
- Shown at the bottom of the session view, below all player data and the settle-up section.
- Append-only list of all changes: buy-ins added/removed, cash-outs set, state transitions, payments marked paid, player additions.
- Each entry: timestamp, actor first name, player name impacted (if applicable), human-readable description. Any numerical values ($) in bold.
- Most recent entries at the top. 
- A field that has a self contained scroll box (no pagination).

---

## Shared components

- **Status badge** — color-coded pill for `in_progress`, `settling`, `settled`, `archived`
- **Currency display** — always formatted as `$X.XX` (from integer cents)
- **Delta indicator** — shows balance gap with color (green when shortfall ≤ 2% and cash-outs ≤ buy-ins; red otherwise)
- **Confirmation dialog** — reusable modal for destructive or significant actions (archive, state transitions)
- **Toast notifications** — for errors and non-blocking feedback
- **Activity log entry** — timestamp + actor + description

---

## Responsive behavior

Mobile-first. The player table must work on small screens — consider collapsing buy-in history behind an expand toggle on mobile. The settle-up section must be readable on mobile (full-width payment rows).

---

## Accessibility requirements

No specific requirements for MVP. Use shadcn/ui defaults (they are accessible by default).

---

## Error states and messaging

- Errors shown as toast notifications.
- Fields causing validation errors highlighted in red with inline message.
- Network errors: toast with retry option where applicable.

---

## Empty states

- **Index — no sessions:** Prompt to start a session with a CTA button.
- **Session — no players:** Prompt to add players with a CTA. "Mark as Settling" is not shown. "Delete session" (archive) is shown.

---

## Related docs

- `01-user-flows.md`
- `02-domain-model.md`
- `12-mvp-scope.md`
- `07-business-logic.md`

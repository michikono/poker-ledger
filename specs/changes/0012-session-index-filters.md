# Change 0012: Session Index Filters

## Status
Implemented

## Owner
Michi Kono

## Goal

Give the sessions index page inline navigation across all four session states, with URL-based deep linking so that side nav links automatically activate the correct filter on arrival.

Also: show live session counts next to "In progress" and "Settling" in the side nav, and make the logo/title in the side rail clickable.

## Context

The sessions index currently shows one flat list of all non-archived sessions with no inline navigation between status groups. The six nav items in `src/components/layout/nav-items.ts` link to `/sessions?status=<value>`, but the page ignores the `?status` param entirely — all links land on the same unfiltered list. Archived sessions are additionally excluded from `fetchVisibleSessions`, so the "Archived" nav link would be broken even if filtering were wired.

The revised design makes the sessions index self-contained: four section tables (one per status) are visible at once on the default view, and a filter pill bar lets users jump to a single-status paginated view. Filter state lives entirely in the URL — pill clicks are plain `<Link>` navigations that trigger a server re-render with only the relevant sessions fetched. This keeps pagination simple: each filtered view is an independent server-rendered page with its own `?page=` param.

## User-visible behavior

### Sessions index — default state (`/sessions`)

- Four sections render on the page in order: **In Progress**, **Settling**, **Settled**, **Archived**.
- Each section has a heading and a table of sessions with that status, most recent first.
- An empty section shows a minimal per-status empty message (no CTA).
- A filter pill bar sits below the page heading and above the sections: `In Progress` · `Settling` · `Settled` · `Archived`.
- No pill is active in the default state.
- A search bar is visible. It filters session names client-side across all visible sections simultaneously.
- The "New session" button is visible.
- No side nav item is highlighted.
- No pagination — the default view fetches all sessions across all four statuses and renders them without a page limit. (Session counts are expected to be small for a poker ledger; if this becomes a concern it is a follow-up.)

### Sessions index — filtered state (`/sessions?status=<value>`)

- The server fetches **only** the matching status, paginated at 10 per page.
- Exactly one filter pill is active — the one matching `?status`.
- Only the matching section is visible; the other three are not rendered.
- The active pill is visually distinct (same `bg-accent text-accent-foreground` treatment as the hover state).
- The search bar is **hidden** on filtered views.
- Pagination controls appear below the section when there are more than 10 sessions.
- The `?page=` param controls the current page (default 1). Invalid page values clamp to 1.
- The page `<h1>` changes to reflect the active filter:

| `?status` | Heading |
|---|---|
| (none) | Sessions |
| `in_progress` | In Progress |
| `settling` | Settling |
| `settled` | Settled |
| `archived` | Archived |

- An invalid or unrecognised `?status` value falls back to the default (all sections, no pill active, heading "Sessions").

### Filter pill interaction

- Pills are plain `<Link>` elements — clicking one triggers a full server navigation.
- Clicking an **inactive** pill navigates to `/sessions?status=<value>` (server fetches only that status, page resets to 1).
- Clicking the **active** pill navigates to `/sessions` (server re-renders the default four-section view).
- The active pill is determined server-side from `searchParams.status` — no client state needed.
- The browser back button restores the previous URL and view as a normal navigation.

### Deep links from the side nav

The side nav status links (`/sessions?status=in_progress`, etc.) drive the filter state via the URL. On arrival the page reads `?status`, renders only the matching section, and shows the matching pill as active — the user lands in the correct filtered view without any extra interaction.

### Empty states

| Context | Empty copy |
|---|---|
| No sessions at all (default view, all sections empty) | "No sessions yet." + New session CTA |
| Section empty in default view | "No {status label} sessions." (no CTA) |
| Filtered view, no sessions | "No {status label} sessions." (no CTA) |
| Search with no matches (default view only) | "No sessions match your search." (no CTA) |

The "New session" CTA appears only when every section is empty on the default view.

### Active side nav item

The currently active nav item is visually highlighted when its `?status` filter is active in the URL:

| Nav item | Active when |
|---|---|
| New session (CTA) | never highlighted |
| In progress | `?status=in_progress` |
| Settling | `?status=settling` |
| Settled | `?status=settled` |
| Archived | `?status=archived` |
| Search input | never highlighted |

No item is highlighted on the default `/sessions` view.

### Side nav counts

The "In progress" and "Settling" nav items show a live count badge when the count is greater than zero. The badge disappears when the count reaches zero. Counts are fetched server-side on each layout render via two lightweight Firestore `count()` aggregate queries.

### Side rail logo link

The "Poker Ledger" icon + title in the side rail is a clickable link to `/sessions`. The mobile header already has this behaviour; this change makes the desktop side rail consistent.

### Side nav structure

The nav is reorganised into three distinct zones, visually separated:

**Zone 1 — Primary action:**
- A "New session" button rendered as a full-width primary CTA (using the primary/felt colour treatment). Clicking it opens the create-session dialog directly — it does not navigate to a different page. A visual separator (or extra spacing) distinguishes it from the search input below.

**Zone 2 — Search:**
- An inline text input (not a link or icon button) rendered below the "New session" CTA.
- Typing and submitting (Enter) navigates to `/sessions?q=<value>`, applying a name search server-side.
- Clearing the input navigates back to `/sessions`.
- The search input is always visible in the nav; it is not a collapsible or deferred element.
- Placeholder text: "Search sessions…"

**Zone 3 — Status filters:**
- Four items in order: In Progress · Settling · Settled · Archived.
- These are the standard nav link rows (icon + label + optional count badge).
- Active highlighting applies to this group only.

**Zone 4 — User account (bottom of nav, below a separator):**
- An avatar circle showing the user's first initial (felt colour background).
- The user's first name displayed as static text — not a link, not a button, no interaction.
- A "Log out" link/button directly visible beside or below the name — no dropdown, no hidden menu.
- Clicking "Log out" signs the user out and redirects to the sign-in page.

This replaces the current dropdown `UserMenu` for the rail variant. The existing dropdown pattern is removed.

The mobile drawer (`Header`) mirrors this structure: CTA button, then search input, then four filter links, then the user account zone at the bottom.

## Non-goals

- Pagination on the default (all-sections) view — deferred; session counts are expected to stay small.
- Full-text / fuzzy search — nav search matches by session name only (substring, case-insensitive).
- Any change to the session detail page.
- Any change to the data model.
- Multi-select filtering (showing two or more status sections while hiding others).

## Data model impact

None. Archived sessions already exist in Firestore with `status: "archived"`. This spec only adds a query to fetch them.

## Diagram impact

None. No domain model, architecture, API contract, or user flow diagrams are affected.

## API impact

No new Server Actions or API routes. New read helpers in `src/lib/sessions/queries.ts`:

**`fetchSessionsByStatus(status: SessionStatus): Promise<SessionSummary[]>`** — queries Firestore for the given status, ordered by `created_at DESC`. Used by the filtered view for all four statuses (including archived). Returns `SessionSummary[]`.

**`fetchAllStatusGroups(): Promise<Record<SessionStatus, SessionSummary[]>>`** — four parallel `fetchSessionsByStatus` calls. Used by the default view. Returns a map of status → sessions.

**`fetchNavCounts(): Promise<NavCounts>`** — two parallel `count()` aggregate queries for `in_progress` and `settling`. Returns `{ in_progress: number; settling: number }`. Called in the app layout, not the sessions page.

`fetchVisibleSessions()` can be removed or left as an alias once all call sites are updated.

The `?q=` param (from the nav search input) is a name substring filter applied server-side before returning results. When `?q=` is present alongside no `?status=`, all four groups are fetched and filtered by name. When `?q=` is present with a `?status=`, only that status is fetched and filtered by name.

## Security/privacy impact

None. Archived sessions are owned by the same users and already readable via Firebase Auth token verification in the layout.

## Local development impact

None. The emulator supports all queries used here. No new env vars or emulator services.

## Quality gates

| Gate | Command | Required for completion | Required for merge |
|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes |
| Lint | `npm run lint` | Yes | Yes |
| Typecheck | `npm run type-check` | Yes | Yes |
| Unit tests | `npm test` | Yes | Yes |
| Build | `npm run build` | Yes | Yes |
| Local smoke test | Manual (see below) | Yes | Yes |
| Aggregate | `npm run check` | Yes | Yes |

## Test plan

**Unit tests (write alongside implementation):**

1. **`fetchSessionsByStatus`** — emulator-based:
   - Returns only sessions with the given status.
   - Returns empty array when none exist.
   - Ordered most recent first.
   - Works for all four statuses including `archived`.

2. **`fetchNavCounts`** — emulator-based:
   - Returns correct counts for `in_progress` and `settling`.
   - Returns zero counts when no matching sessions exist.

3. **`<SessionsPage>` / routing** — unit or smoke:
   - Default render shows all four section headings.
   - `?status=in_progress` renders only the In Progress section.
   - `?status=bogus` falls back to the default four-section render.

4. **`<FilterPills>`**:
   - No pill has the active style when `status` is undefined.
   - The matching pill has the active style for each valid `?status` value.

5. **`<SessionList>` / grouped view**:
   - Default: all four sections rendered with correct headings.
   - Filtered: only the matching section rendered, pagination controls present when count > 10.
   - Search filters across all sections in the default view.
   - No-match message shown when search yields nothing.
   - Whole-page empty state shown when all sessions arrays are empty.

6. **`<NavLink>` / active state** — unit test that the correct item receives the active class for each `?status` value and for the unfiltered case.

**Not unit-tested:**
- Firestore index correctness (covered by emulator integration tests above).

**Local smoke test checklist:**
- [ ] Visit `/sessions` — all four sections visible, no nav item highlighted, search box visible, heading "Sessions", no filter pill active
- [ ] Click "In progress" filter pill — full page navigation to `?status=in_progress`, only In Progress section visible, pill active, heading "In Progress", search hidden, "In progress" nav item highlighted
- [ ] Click the active "In progress" pill — navigates to `/sessions`, all sections shown, no pill active
- [ ] Click "In progress" in the side nav — same result as clicking the pill
- [ ] Repeat for Settling, Settled, Archived
- [ ] On a filtered view with > 10 sessions: pagination controls appear; Next/Previous navigate correctly via `?page=` param
- [ ] Archive a session via the detail page; visit `/sessions?status=archived` — archived session appears
- [ ] Visit `/sessions?status=bogus` — falls back to default view, no pill active, heading "Sessions"
- [ ] Nav counts: "In progress" and "Settling" show counts when sessions exist in those states; badges absent when count is zero
- [ ] Logo in side rail is clickable and navigates to `/sessions`
- [ ] "New session" in the nav is a CTA button, visually distinct from the status items below it
- [ ] Search input in the nav: type a name and press Enter → navigates to `/sessions?q=<value>` showing matching sessions; clear the input and press Enter → returns to `/sessions`
- [ ] Mobile drawer has the same three-zone structure

## Acceptance criteria

- [ ] Default `/sessions` shows all four status sections with no pagination
- [ ] Filter pills render for all four statuses; no pill is active by default
- [ ] Clicking an inactive pill performs a server navigation to `?status=<value>` showing only that section
- [ ] Clicking the active pill navigates to `/sessions` and restores the default view
- [ ] `/sessions?status=in_progress` (and each other valid status) renders only the matching section with the pill active
- [ ] Filtered views are paginated at 10 per page; `?page=N` controls the current page
- [ ] Invalid `?status` values fall back to the default view
- [ ] Page `<h1>` reflects the active filter
- [ ] Active side nav item is visually highlighted for each status filter
- [ ] No side nav item is highlighted on the default `/sessions` view
- [ ] Search bar visible on default view, hidden on filtered views
- [ ] Search filters across all sections in the default view
- [ ] Empty states use per-context copy; CTA only on whole-page empty state
- [ ] `fetchSessionsByStatus` unit tests pass against the emulator
- [ ] `fetchNavCounts` unit tests pass against the emulator
- [ ] `<SessionList>` unit tests updated and passing
- [ ] `<FilterPills>` unit tests passing
- [ ] Active nav item unit tests passing
- [ ] Nav counts show on "In progress" and "Settling" in the side nav
- [ ] Logo in side rail navigates to `/sessions`
- [ ] "New session" renders as a primary CTA button, visually separated from the four status filter items
- [ ] Search is an inline text input in the nav; submitting navigates to `/sessions?q=<value>`; clearing returns to `/sessions`
- [ ] User account zone: avatar initial + first name (non-interactive) + direct "Log out" action visible without a dropdown
- [ ] Mobile drawer mirrors the same four-zone nav structure
- [ ] Local smoke test checklist completed
- [ ] `npm run check` passes

## Rollout/deployment notes

No new Firestore indexes needed. The per-status queries and `count()` aggregates use existing indexes. No new env vars.

## Implementation notes

**RSC page (`src/app/(app)/sessions/page.tsx`):**

Reads `searchParams.status` and `searchParams.page`. When a valid status filter is present, fetches only that status with offset-based pagination. When no filter, fetches all four groups in parallel:

```ts
type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default async function SessionsPage({ searchParams }: Props) {
  const { status, page } = await searchParams;
  const filter = isSessionStatus(status) ? status : undefined;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  if (filter) {
    const sessions = await fetchSessionsByStatus(filter);
    // slice for pagination, pass filter + page to client component
  } else {
    const groups = await fetchAllStatusGroups();
    // pass all groups to client component, no pagination
  }
}
```

Pagination is handled by slicing the already-fetched array (Firestore offset queries are not recommended; fetching the full status list and slicing server-side is fine given expected volumes).

**`<FilterPills>` component (server component):**

Receives `activeFilter: SessionStatus | undefined` as a prop (passed from the RSC). Renders a pill for each status. Each pill is a `<Link>`:
- Inactive pill → `href="/sessions?status=<value>"`
- Active pill → `href="/sessions"` (deactivates by returning to base URL)

No `useSearchParams` or client state needed.

**`<SessionList>` refactor:**

Split into two render modes driven by props:
- **Default mode** (no filter): renders four `<StatusSection>` components, each receiving its session array. Includes client-side search input.
- **Filtered mode** (filter prop present): renders one `<StatusSection>` with pagination controls.

**Active nav item (`<NavLink>` client component):**

Extract a small `<NavLink>` client component that uses `usePathname` + `useSearchParams` to compare against each item's `href` and applies the active class when they match. Used by both `SideRail` and the mobile `Header` drawer.

**`isSessionStatus` helper:**

Narrow an unknown string to `SessionStatus | undefined`. Lives in `src/lib/sessions/types.ts`.

**User account zone:**

The current `UserMenu` dropdown is replaced with a flat layout: avatar + first name (static text) + "Log out" button. The `UserMenu` component should be simplified or replaced — the dropdown `DropdownMenu` wrapper is no longer needed for the rail variant. The "Log out" button calls the existing `signOut` server action directly.

**"New session" CTA in the nav:**

The CTA must open the create-session dialog, not navigate. Since `SideRail` and the mobile `Header` are server components, the CTA must be extracted into a small client component (e.g. `<NewSessionButton>`) that owns the `CreateSessionDialog` open state — the same pattern already used on the sessions page. The `CreateSessionDialog` component should be reused as-is; only the trigger changes.

**Nav counts and logo link (already implemented on this branch):**

`fetchNavCounts()` is already implemented in `src/lib/sessions/queries.ts` and called from the app layout. The logo link in `side-rail.tsx` is already a `<Link>`. These do not need further implementation work.

## Open questions

None.

## Links

- `docs/08-ux-spec.md` — navigation model and session index screen spec
- `src/components/layout/nav-items.ts` — nav item definitions
- `src/lib/sessions/queries.ts` — existing query helpers
- `src/app/(app)/sessions/page.tsx` — RSC to modify
- `src/app/(app)/sessions/session-list.tsx` — client component to modify

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-03 | Proposed | Initial draft — URL filter + side nav only approach |
| 2026-05-03 | Proposed | Revised: 4 section tables + inline filter pills + URL deep linking; nav counts and logo link added |
| 2026-05-03 | Proposed | Revised: server-side filtering via Link navigation; filtered views paginated; default view fetches all four groups in parallel, no pagination |
| 2026-05-03 | Proposed | Revised: nav reorganised into three zones — New session CTA → Search input → Status filters |
| 2026-05-03 | Implemented | All acceptance criteria met; npm run check passes |

# Change 0012: Session Index Filters

## Status
Proposed

## Owner
Michi Kono

## Goal

Make the six nav items functional: wire `?status=` filtering on the sessions index so that "In progress", "Settling", "Settled", and "Archived" each show only the relevant sessions, and highlight the active nav item.

## Context

The six nav items in `src/components/layout/nav-items.ts` already link to `/sessions?status=<value>`, but the sessions index page ignores the `?status` param entirely — all links land on the same unfiltered list. The "Archived" link is additionally broken because `fetchVisibleSessions` excludes archived sessions from its Firestore query, so even if filtering were wired up, archived sessions would never appear.

This is the last gap between the implemented code and the MVP UX spec (`docs/08-ux-spec.md` § Navigation model, § Session Index).

## User-visible behavior

### Status filtering

- `/sessions` — current behavior unchanged: shows all non-archived sessions ordered by status priority then recency.
- `/sessions?status=in_progress` — shows only `in_progress` sessions, most recent first.
- `/sessions?status=settling` — shows only `settling` sessions, most recent first.
- `/sessions?status=settled` — shows only `settled` sessions, most recent first.
- `/sessions?status=archived` — shows only `archived` sessions, most recent first.

An invalid `?status` value (anything not in the enum) is treated as no filter (falls back to unfiltered view).

### Page heading

The `<h1>` on the sessions index changes to reflect the active filter:

| `?status` | Heading |
|---|---|
| (none) | Sessions |
| `in_progress` | In progress |
| `settling` | Settling |
| `settled` | Settled |
| `archived` | Archived |

### Empty states

Each filtered view has its own empty-state copy:

| Filter | Empty copy |
|---|---|
| (none) | "No sessions yet." + New session CTA |
| `in_progress` | "No sessions in progress." |
| `settling` | "No sessions settling." |
| `settled` | "No settled sessions." |
| `archived` | "No archived sessions." |

Filtered empty states do not show the New session CTA.

### Active nav item

The currently active nav item is visually highlighted (same `bg-accent text-accent-foreground` treatment as hover). The active item is determined by matching the current pathname + `?status` param:

| Nav item | Active when |
|---|---|
| New session | never highlighted |
| In progress | `?status=in_progress` |
| Settling | `?status=settling` |
| Settled | `?status=settled` |
| Archived | `?status=archived` |
| Search | never highlighted (deferred — see spec 0013) |

No item is highlighted when visiting `/sessions` with no status param.

### Search box

The search box is hidden on filtered views (`?status=*`). It is only shown on the unfiltered index (`/sessions`). Rationale: the search box filters the already-fetched list client-side; combining it with a status filter adds complexity for minimal gain, and the filtered lists are short enough to not need it.

## Non-goals

- Session search / autocomplete (`/api/sessions/search`) — deferred to a follow-up spec.
- `?focus=search` behavior for the Search nav item — deferred.
- Pagination on the archived view — use the same 10-per-page client-side pagination already in `<SessionList>`.
- Any change to the session detail page.
- Any change to the data model.

## Data model impact

None. Archived sessions already exist in Firestore with `status: "archived"`. This spec only adds a query to fetch them.

## Diagram impact

None. No domain model, architecture, API contract, or user flow diagrams are affected.

## API impact

No new Server Actions or API routes. One new read helper:

**`fetchArchivedSessions(): Promise<SessionSummary[]>`** — queries Firestore for sessions where `status == "archived"`, ordered by `created_at DESC`. Lives in `src/lib/sessions/queries.ts` alongside `fetchVisibleSessions`. Returns `SessionSummary[]` (same shape). No `sortSessions` call needed — result is already a single-status list ordered by date.

## Security/privacy impact

None. Archived sessions are owned by the same users and already readable via Firebase Auth token verification in the layout. No new auth surface.

## Local development impact

None. The emulator already supports all queries used here. No new env vars or emulator services.

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

1. **`fetchArchivedSessions`** — emulator-based:
   - Returns only archived sessions.
   - Returns empty array when none exist.
   - Ordered most recent first.

2. **`filterSessions`** — no changes needed; status filtering happens before this function is called.

3. **`<SessionList>`** — update existing tests to cover:
   - Empty state copy varies by filter prop.
   - Search box is hidden when a status filter is active.

4. **`<NavItems>` / active highlight** — unit test that the correct item is marked active for each `?status` value and for the unfiltered case.

**Not unit-tested:**
- RSC `page.tsx` routing logic (covered by smoke test).

**Local smoke test checklist:**
- [ ] Visit `/sessions` — unfiltered list, no nav item highlighted, search box visible, heading "Sessions"
- [ ] Click "In progress" in nav — URL is `/sessions?status=in_progress`, "In progress" nav item highlighted, heading "In progress", only in-progress sessions shown, search box hidden
- [ ] Click "Settling" — correct filter applied and nav item highlighted
- [ ] Click "Settled" — correct filter applied and nav item highlighted
- [ ] Archive a session via the session detail page, then click "Archived" in nav — archived session appears, heading "Archived", nav item highlighted
- [ ] Unarchive the session from the archived view — session disappears from archived list
- [ ] Visit `/sessions` again — unarchived session reappears in unfiltered list
- [ ] Visit `/sessions?status=bogus` — falls back to unfiltered view, no nav item highlighted
- [ ] Empty state: visit a filtered view with no matching sessions — correct per-filter copy, no New session CTA

## Acceptance criteria

- [ ] `/sessions?status=in_progress` shows only in-progress sessions
- [ ] `/sessions?status=settling` shows only settling sessions
- [ ] `/sessions?status=settled` shows only settled sessions
- [ ] `/sessions?status=archived` shows only archived sessions (fetched via `fetchArchivedSessions`)
- [ ] `/sessions` (no param) shows all non-archived sessions — existing behavior preserved
- [ ] Invalid `?status` values fall back to the unfiltered view
- [ ] Page `<h1>` reflects the active filter
- [ ] Active nav item is visually highlighted for each status filter
- [ ] No nav item is highlighted on the unfiltered `/sessions` view
- [ ] Search box is visible on `/sessions` and hidden on all filtered views
- [ ] Empty states use the per-filter copy and show the New session CTA only on the unfiltered view
- [ ] `fetchArchivedSessions` unit tests pass against the emulator
- [ ] `<SessionList>` unit tests updated and passing
- [ ] Active nav item unit tests passing
- [ ] Local smoke test checklist completed
- [ ] `npm run check` passes

## Rollout/deployment notes

No new Firestore indexes needed — `where("status", "==", "archived") + orderBy("created_at", "desc")` uses the same per-status index already defined for visible sessions in `firestore.indexes.json`. No new env vars.

## Implementation notes

**RSC page changes (`src/app/(app)/sessions/page.tsx`):**

The page receives `searchParams` and reads `status`. If `status === "archived"`, call `fetchArchivedSessions()`. Otherwise call `fetchVisibleSessions()` as today. Pass `statusFilter` down to `<SessionList>` alongside `sessions`.

```ts
type Props = { searchParams: Promise<{ status?: string }> };

export default async function SessionsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter = isSessionStatus(status) ? status : undefined;
  const sessions = filter === "archived"
    ? await fetchArchivedSessions()
    : await fetchVisibleSessions();
  // serialize + pass filter to <SessionList>
}
```

**`isSessionStatus` helper** — narrow an unknown string to `SessionStatus | undefined`. Lives in `src/lib/sessions/types.ts` or alongside the query.

**`fetchArchivedSessions` (`src/lib/sessions/queries.ts`):**

```ts
export async function fetchArchivedSessions(): Promise<SessionSummary[]> {
  const snap = await adminDb
    .collection("sessions")
    .where("status", "==", "archived")
    .orderBy("created_at", "desc")
    .get();
  return Promise.all(snap.docs.map(async (doc) => { /* same shape as fetchVisibleSessions */ }));
}
```

**`<SessionList>` changes:**

Add an optional `statusFilter?: SessionStatus` prop. When set:
- Hide the search input.
- Use filter-specific empty copy.
- The existing `filterSessions` call is skipped (or query is always `""`).

**Active nav item (`src/components/layout/nav-items.ts` + consumers):**

`SideRail` and the mobile drawer both render nav items. To highlight the active item, make the link rendering aware of the current pathname + search params. Use Next.js `usePathname` + `useSearchParams` in a small `<NavLink>` client component that wraps each `<Link>` and applies the active class when `href` matches.

The `New session` and `Search` items are never highlighted (their `href` values — `/sessions` and `/sessions?focus=search` — don't correspond to a filter state).

## Open questions

None. Design is fully specified in `docs/08-ux-spec.md`.

## Links

- `docs/08-ux-spec.md` — navigation model and session index screen spec
- `src/components/layout/nav-items.ts` — nav item definitions
- `src/lib/sessions/queries.ts` — `fetchVisibleSessions` (reference implementation)
- `src/app/(app)/sessions/page.tsx` — RSC to modify
- `src/app/(app)/sessions/session-list.tsx` — client component to modify

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-03 | Proposed | Initial draft |

# Change 0004: Sessions Index Page

## Status
Implemented

## Owner
Michi Kono

## Goal

Replace the `/sessions` placeholder with a functional index page that lists all non-archived sessions, supports search filtering, and paginates results.

## Context

The app shell and auth are complete (specs 0001–0003). The `/sessions` route renders "Coming soon." This change delivers the primary landing view that all users see after signing in.

Relevant docs: `docs/01-user-flows.md`, `docs/08-ux-spec.md`, `docs/05-data-model.md`, `docs/12-mvp-scope.md`.

## User-visible behavior

1. A signed-in user at `/sessions` sees a list of all non-archived sessions.
2. Sessions are grouped and ordered: `in_progress` first, `settling` second, `settled` third. Within each group, most recent first.
3. Each row shows: session name (linked to `/sessions/:name`), creation date, player count, status badge.
4. A search box at the top filters the visible list by session name (case-insensitive, contains match).
5. Pagination: 10 sessions per page with prev/next controls. The current page and total count are shown.
6. Empty state (no sessions exist): "No sessions yet." with a "New Session" button. The button is rendered but has no action — session creation is spec 0005.
7. Loading skeleton displayed while the initial data fetch completes.
8. Error state displayed if Firestore read fails.

## Non-goals

- Creating sessions (spec 0005).
- Side navigation menu (future spec).
- Session detail page (`/sessions/:name`).
- Search autocomplete API route (`/api/sessions/search`) — client-side filter on the fetched list is sufficient for MVP scale.
- Firestore indexes in production (required before production load — documented as a deployment note, not a gate blocker for local smoke test).

## Data model impact

No schema changes. Player count is fetched via `getCountFromServer()` on each session's `players` subcollection (N+1 reads). Acceptable at MVP scale (expected < 50 sessions). If scale demands it, a denormalized `player_count` field on the session document is the natural next step — not in scope here.

Firestore security rules must be updated to allow authenticated reads on `sessions` and `sessions/{id}/players`. Current rules deny all access. This change updates `firestore.rules`.

## Diagram impact

None. The index page is described in existing docs (`docs/08-ux-spec.md`). No new entities, flows, or architecture changes.

## API impact

No new server actions or API routes. Initial data load uses RSC (server component queries Firestore directly). Search filter is client-side only. The `/api/sessions/search` route defined in `docs/06-api-contract.md` is deferred.

## Security/privacy impact

Firestore security rules updated to allow reads:
- `sessions/{sessionId}`: read if `request.auth != null`
- `sessions/{sessionId}/players/{playerId}`: read if `request.auth != null`

No write rules are changed. Auth gate at the layout level already blocks unauthenticated users from reaching `/sessions`. Firestore rules are a defense-in-depth layer.

## Local development impact

No new environment variables. No setup changes. shadcn/ui is installed as part of this change — it adds components under `src/components/ui/` and updates `tailwind.config.ts` and `globals.css`. This is an additive change with no impact on `npm run dev`.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (Playwright): not yet written for this flow. Will be introduced in a future spec once the session creation flow exists, making it possible to create fixture data.

## Test plan

Unit tests (Vitest):
- `sortSessions(sessions)` — pure function that applies the status-priority + recency ordering. Test all permutations of status and created_at.
- `filterSessions(sessions, query)` — pure function for case-insensitive contains match. Test empty query, no match, partial match, full match.

Component tests (Testing Library):
- `SessionList` — renders loading skeleton, empty state, populated list, error state.
- `StatusBadge` — renders correct label and color class for each of the four status values.

No TDD on the RSC data-fetching layer — it is thin glue code with no logic.

## Acceptance criteria

- [ ] `/sessions` shows a list of sessions fetched from Firestore (or the emulator locally).
- [ ] Sessions are ordered: in_progress → settling → settled; most recent first within each group.
- [ ] Archived sessions are not shown on this page.
- [ ] Each row shows session name, creation date, player count, and status badge.
- [ ] Session name is a link that navigates to `/sessions/:name`.
- [ ] Search box filters the list by session name (case-insensitive, contains match). Clears pagination back to page 1 on input.
- [ ] Pagination shows 10 sessions per page with prev/next controls and a page indicator.
- [ ] Empty state renders when no non-archived sessions exist, with a "New Session" button (no action for now).
- [ ] Loading skeleton renders during the initial fetch.
- [ ] Error state renders if Firestore throws.
- [ ] shadcn/ui is initialized and components (Badge, Button, Input, Skeleton) are installed.
- [ ] Firestore rules allow authenticated reads on `sessions` and `sessions/{id}/players`.
- [ ] `sortSessions` unit tests pass.
- [ ] `filterSessions` unit tests pass.
- [ ] `SessionList` component tests cover all four states.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.
- [ ] No regressions to sign-in flow or existing layout.

## Rollout/deployment notes

- No new environment variables.
- Firestore composite index `(status ASC, created_at DESC)` must be created in the Firebase Console before production use. Not required for local emulator. Instructions: Firebase Console → Firestore → Indexes → Add composite index on `sessions` collection with fields `status ASC, created_at DESC`.
- shadcn/ui components are checked into Git — no additional setup needed for deployers.

## Implementation notes

**File layout:**
- `src/app/(app)/sessions/page.tsx` — RSC; fetches sessions and player counts; passes to `SessionList`
- `src/app/(app)/sessions/session-list.tsx` — client component; owns search state, pagination state, renders rows
- `src/app/(app)/sessions/session-row.tsx` — presentational row component
- `src/lib/sessions/sort.ts` — `sortSessions()` pure function
- `src/lib/sessions/filter.ts` — `filterSessions()` pure function
- `src/components/ui/status-badge.tsx` — reusable status badge (uses shadcn/ui Badge)

**Data fetching approach:**
- Fetch all three status groups in parallel: `Promise.all([query(in_progress), query(settling), query(settled)])`.
- For each session, call `getCountFromServer()` on its players subcollection. These can also run in parallel via `Promise.all`.
- Pass the result array (sorted) to `SessionList` as a prop.

**shadcn/ui init:**
Run `npx shadcn@latest init` in the worktree. Select TypeScript, App Router, Tailwind. Then add components: `npx shadcn@latest add badge button input skeleton`.

**Status-priority ordering:**
Map status to a numeric priority (`in_progress = 0, settling = 1, settled = 2`) for sort comparison.

**Pagination:**
Client-side slice of the sorted+filtered array. State: `currentPage` (integer). Reset to 1 on search query change.

## Open questions

None — ready for implementation.

## Links

- `docs/01-user-flows.md`
- `docs/05-data-model.md`
- `docs/08-ux-spec.md`
- `docs/12-mvp-scope.md`
- `docs/06-api-contract.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved for implementation |
| 2026-05-03 | Implemented | Merged via PR #11 |

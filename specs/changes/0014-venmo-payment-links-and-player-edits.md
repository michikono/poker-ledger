# Change 0014: Venmo payment links and player edit form

## Status
Accepted

## Owner
Michi Kono

## Goal

Let players settle up faster at the end of a session by generating Venmo deep-links (and matching QR codes) per payment row, and consolidate per-player editing into a single inline form with name + Venmo handle and a confirmed delete.

## Context

Today, when a session reaches `settling`/`settled`, the payment list shows "X pays Y $Z" with a `Mark paid` button, but the user still has to manually open Venmo, search for the recipient, type the amount, and add a note. This change removes that friction by emitting a Venmo URL per row using the recipient's stored handle.

The same change consolidates two related UX gaps in the session detail view:

- The player edit affordance is currently a name-only inline rename, with the `Delete player` button appearing as a side-effect of clicking the name. There is no place to store a Venmo handle, and the destructive `Delete player` action fires immediately with no confirmation.
- The `Add buy-in` form occupies its own table column on the player row, doubling the horizontal footprint of the buy-in UI on a table that is already wide.

Bundling these together is intentional: storing the Venmo handle requires extending the player edit form, and once that form is being touched it is the natural moment to also fix the delete-confirmation gap and reclaim the buy-in column.

The Venmo URL scheme used (`https://venmo.com/<handle>?txn=pay&amount=<dollars>&note=<text>`) is widely used but **not** part of a public Venmo API; behavior could change. This is accepted as a non-blocking risk — the feature degrades gracefully (the link 404s or lands on the user's profile) and a payer can always tap `Mark paid` without using the link at all.

## User-visible behavior

### Payment list (`settling`/`settled` sessions)

For each unpaid payment row "X pays Y $Z":

- If Y has a Venmo handle stored on their player record:
  - A primary **Pay** button appears before `Mark paid`. Clicking it opens `https://venmo.com/<Y_handle>?txn=pay&amount=<Z>&note=<encoded note>` in a new tab. On mobile, the device's universal-link handler launches the Venmo app with the payment screen pre-filled.
  - A secondary **QR** button appears next to **Pay**. Clicking it opens a modal containing a QR code that encodes the same URL, captioned with payee name, payee handle, and amount, plus a Close button.
- If Y does not have a Venmo handle stored:
  - Neither **Pay** nor **QR** appears.
  - A small text link **Add Venmo for {Y}** appears in the actions area. Clicking it scrolls to / opens the player edit form for Y.
- Once a payment is marked paid, **Pay** and **QR** are hidden from that row (only the existing `Paid` badge and `Unmark` remain).

The note text emitted in the URL is `Poker on YYYY-MM-DD ({session name})`, where the date is the session's `createdAt` (UTC) in ISO format.

### Player edit form (`player-row.tsx`)

Clicking a player's name (in any non-archived status) replaces the static name with an inline edit form containing:

- **Name** input (existing behavior; 1–50 chars, unique-per-session).
- **Venmo handle** input with a leading `@` adornment, optional, max 30 chars; helper text on validation error.
- A row of buttons: **Save** | **Cancel** | **Delete player**.

`Save` persists both fields atomically through a single server action. `Cancel` reverts both fields and collapses the form.

`Delete player` always opens a confirmation dialog (`<Dialog>`) titled **Delete player?** with copy

> Delete {name}? This permanently removes their buy-ins and cash-out from the session. This cannot be undone.

and buttons **Cancel** | **Delete**. Only the **Delete** action invokes the existing `deletePlayer` server action.

### Buy-in column restructuring (`player-row.tsx`)

The "Add buy-in" `<td>` and its column header are removed entirely. Inside the existing buy-in chips `<td>`, the column now renders, top-down:

1. (Editable status only) An **Add buy-in** CTA button. Clicking the CTA replaces it inline with the existing input + `Add` form (and a `Cancel` button to abort). On successful submit the form clears and collapses back to the CTA. On `Cancel` or `Esc`, it collapses without submitting.
2. The existing wrapped row of buy-in chips, unchanged in style and removal behavior.

Non-editable statuses (`settling`, `settled`, `archived`) render no CTA and no form, only the chips.

## Non-goals

The following are **explicitly out of scope** for this change:

- Charge-style links (`txn=charge`).
- Inline (always-on) QR codes — QR is modal-only behind the **QR** button.
- Multi-currency support — Venmo is USD-only, matching the app.
- Payment confirmation, webhooks, or any post-link Venmo state syncing — `Mark paid` remains a manual user action.
- Cross-session player identity / a per-user "profile" record. The Venmo handle lives only on the per-session player. (A future spec may migrate to a user-level profile and fall through; that spec is not blocked by this one.)
- Importing handles from device contacts or any external source.
- Group-payment links (e.g., `Venmo group` URLs).
- Venmo-style receipt parsing or confirmation screenshots.
- Any change to the settling algorithm or the set of payments that are produced.

## Data model impact

Add one optional, nullable field to `Player`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `venmo_username` | string \| null | No | Stored as the bare handle, no leading `@`. Validated `^[A-Za-z0-9_.-]{5,30}$` on write. Default `null`. |

No new collections, no new indexes (the field is not queried). No backfill required — existing players default to `null`.

`docs/05-data-model.md` Player table is updated to add this row.

## Diagram impact

- `docs/02-domain-model.md` — `erDiagram`: add `venmoUsername` (nullable string) to the `Player` entity.
- `docs/05-data-model.md` — `erDiagram`: add `venmo_username` (nullable string) to the `players` table.
- `docs/01-user-flows.md` — `flowchart`: add a "Pay via Venmo / Show QR" branch off the existing settle-up flow.
- `docs/06-api-contract.md` — extend the existing `updatePlayerName` entry to a unified `updatePlayer` (or add a sibling `updatePlayerVenmo` — see Open questions). No new sequence diagrams.

## API impact

**Modify:** `updatePlayerName(input, token)` is extended (and renamed) to `updatePlayer(input, token)`:

```ts
input: {
  sessionId: string;
  playerId: string;
  name: string;                  // 1–50 chars, trimmed (existing rules)
  venmoUsername: string | null;  // null clears; otherwise validated handle
}

returns: ActionResult<void>
```

**Validation:**
- Existing name rules unchanged.
- `venmoUsername`: trimmed; leading `@` stripped; if non-empty after stripping, must match `/^[A-Za-z0-9_.-]{5,30}$/`; otherwise stored as `null`.

**Side effects:** As today for name; additionally writes `Player.venmo_username`. Changelog entries:
- `player_renamed` (existing) only when name changes.
- `player_venmo_updated` (new) only when handle changes; metadata `{ player_id, had_handle: boolean, has_handle: boolean }`. Does **not** record the actual handle value to avoid leaking PII into the changelog.

The existing call site (`player-row.tsx` rename branch) is migrated to the new signature. A short-lived back-compat shim (`updatePlayerName` delegating to `updatePlayer` with the player's existing handle) may be retained for a single release if it simplifies the diff; remove in the same PR if not strictly needed.

No new server actions are required for the link itself — URL construction is a pure client helper.

## Security/privacy impact

- Venmo handles are inherently public on Venmo, but the app should still treat them like email: never log them, never include them in error messages, and never embed them in fixtures or test snapshots (use `example-handle`).
- The new `player_venmo_updated` changelog entry deliberately records only booleans for `had_handle` / `has_handle`; the handle string itself is **not** logged.
- Firestore security rules for `Player` already deny client writes; the new field rides the existing Admin-SDK-only write path, so no rules change is required. Add a unit test asserting the rule still rejects client writes that include the new field.
- No additional secrets or credentials. The Venmo URL contains no token from this app.
- `qrcode.react` (proposed dependency) is a small, well-maintained MIT library with no network calls — QR rendering is purely local.

## Local development impact

- One new runtime dependency: `qrcode.react` (~5 kB gzipped, MIT). Add via `npm install qrcode.react`. Update `package.json` and `package-lock.json` only.
- No new env vars.
- No emulator config changes.
- Local dev still runs end-to-end with `npm run dev`. The Venmo URL is constructed client-side; opening the link in a browser will navigate to `https://venmo.com/<handle>` regardless of whether the local emulator is running, so there is nothing to mock for local dev.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format` (Biome write) | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| E2E (optional for v1) | `npm run test:e2e` | No | No | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual | Yes | Yes | |
| Spec conformance review | Manual | Yes | Yes | |

`npm run check` is the aggregate gate and must pass.

## Test plan

**Pure logic (TDD, unit):**

- `buildVenmoPayUrl({ handle, amountCents, note })` — returns the canonical URL; URL-encodes the note; renders amount as `N.NN`; rejects empty handle by returning `null`; strips a leading `@`; rejects handles failing the validator by returning `null`.
- `parseVenmoHandle(input: string): string | null` — trims, strips leading `@`, validates against `/^[A-Za-z0-9_.-]{5,30}$/`, returns canonical form or `null`.
- `formatVenmoNote(session: { name: string; createdAt: Date }): string` — returns `Poker on YYYY-MM-DD (${session.name})`, ISO date in UTC.

**Server action (integration, against the Firestore emulator):**

- `updatePlayer` updates name and handle independently; clearing the handle (passing `null` or empty) writes `null`; invalid handle is rejected with `INVALID_VENMO_USERNAME`; concurrent updates serialize.
- `player_venmo_updated` changelog entry is written with the documented booleans only — no handle string.
- Existing `updatePlayerName` callers (if shim is retained) still work end-to-end.

**Component (Vitest + Testing Library):**

- `PaymentList` renders **Pay** + **QR** when payee has a handle; renders **Add Venmo for {Y}** otherwise; both hide once payment is marked paid (regardless of session status).
- `PlayerRow` edit form renders Name + Venmo handle + Save/Cancel/Delete; Delete opens the confirm dialog and only fires `deletePlayer` after the modal's Delete is clicked; the dialog's Cancel does not delete.
- `PlayerRow` buy-in column renders the **Add buy-in** CTA (editable only); clicking it reveals the form; submitting collapses back to the CTA on success; existing chip removal behavior unchanged.

**Excluded from automation (manual smoke):**

- Tap-to-open behavior of the Venmo URL on iOS/Android (cannot be automated reliably without device tests).
- Visual rendering of the QR code (covered by manual smoke and one snapshot of the `<QRCodeSVG>` element with a known input).

## Acceptance criteria

- [ ] Each unpaid payment in a `settling`/`settled` session shows **Pay** and **QR** when the payee has a stored handle.
- [ ] Tapping **Pay** opens `https://venmo.com/<handle>?txn=pay&amount=<dollars>&note=<encoded>` in a new tab.
- [ ] Tapping **QR** opens a modal containing a scannable QR code that encodes the same URL, with payee/amount caption and a Close button.
- [ ] Each unpaid payment whose payee has no handle shows an **Add Venmo for {payee}** affordance and no Pay/QR buttons.
- [ ] Paid payments hide both Pay and QR.
- [ ] Note text is exactly `Poker on YYYY-MM-DD (${session name})`, URL-encoded.
- [ ] Player edit form contains Name + Venmo handle + Save/Cancel/Delete; the form persists both fields atomically.
- [ ] Delete player always opens a confirm dialog and never deletes without the modal's Delete being clicked.
- [ ] The "Add buy-in" column is gone; the buy-in column hosts a CTA at the top (editable only) and the chips beneath; the CTA expands inline to the existing form on click.
- [ ] `venmo_username` is stored on `Player`, validated on write, and never written to the changelog as a string.
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.
- [ ] `docs/02-domain-model.md`, `docs/05-data-model.md`, `docs/01-user-flows.md`, and `docs/06-api-contract.md` updated to reflect the new field and unified action.

## Rollout/deployment notes

- No env vars to set in Vercel.
- No Firestore index changes.
- No data migration; existing players default to `venmo_username = null`.
- Single PR is fine — the change is small enough that a feature flag would be more friction than the rollout it enables.
- Post-merge: monitor for any Venmo URL behavior regressions over the following few sessions.

## Implementation notes

Suggested file map for the implementer:

- `src/lib/venmo/url.ts` — pure helpers: `parseVenmoHandle`, `buildVenmoPayUrl`, `formatVenmoNote`. Tests in `src/lib/venmo/url.test.ts`. **TDD this file first.**
- `src/lib/sessions/types.ts` — extend `Player` / `SessionPlayerView` with `venmoUsername: string | null`.
- `src/app/(app)/sessions/[name]/actions.ts` — replace `updatePlayerName` with `updatePlayer`; emit the new changelog entry. Update `actions.test.ts` accordingly.
- `src/app/(app)/sessions/[name]/player-row.tsx` — restructure the edit form (Name + Venmo + Save/Cancel/Delete); add the delete-confirm `<Dialog>`; restructure the buy-in column (CTA + collapsible form + chips).
- `src/app/(app)/sessions/[name]/payment-list.tsx` — render Pay/QR/Add-Venmo affordances per row; gate by `paid` flag; new `<QRModal>` component (could colocate inside this file or split to `qr-modal.tsx`).
- `package.json` — add `qrcode.react` runtime dep.
- `docs/02-domain-model.md`, `docs/05-data-model.md`, `docs/01-user-flows.md`, `docs/06-api-contract.md` — diagram and contract updates per *Diagram impact* and *API impact*.

Order of operations:

1. TDD `src/lib/venmo/url.ts` and the handle validator.
2. Extend types and `updatePlayer` server action; update tests.
3. Player edit form changes (Name + Venmo + delete-confirm dialog) — no UI for buy-in restructuring yet.
4. Buy-in column restructuring.
5. Payment list Pay/QR/Add-Venmo wiring + QR modal.
6. Update docs/diagrams.
7. Manual smoke: confirm Pay link opens Venmo on a real phone with prefill; confirm QR scans to the same URL.

Known pitfalls:

- The existing rename form is inside the Name `<td>`; the new combined form must remain accessible (label/aria) and not break the keyboard-only flow.
- `qrcode.react` exports both `QRCodeSVG` and `QRCodeCanvas`; prefer `QRCodeSVG` for Tailwind sizing and theming.
- The note's date should come from `session.createdAt` (UTC ISO), not from `Date.now()`, so the receipt is stable across when the link is generated.

## Open questions

1. **Action naming.** Rename `updatePlayerName` → `updatePlayer` (preferred), or add a sibling `updatePlayerVenmo`? Renaming is cleaner long-term but touches every existing test that imports the name. *Recommendation: rename, delete the old name; the back-compat shim is not worth carrying.*
2. **Add-Venmo affordance UX.** Should `Add Venmo for {Y}` (i) scroll to and open Y's edit form in the player table, (ii) open a small inline dialog asking only for the handle, or (iii) just route to the player edit form without the scroll? *Recommendation: (i) — least new UI, reuses the form we are already building.*
3. **QR caption format.** Caption text in the modal: `Y · @y_handle · $Z` or a vertical stack with a "Tap or scan to pay" subtitle? *Recommendation: vertical stack with subtitle — easier to read at arm's length.*

These are non-blocking; they can be resolved during implementation review without re-opening the spec.

## Links

- `docs/02-domain-model.md` — Player entity (to be updated)
- `docs/05-data-model.md` — `players` table (to be updated)
- `docs/06-api-contract.md` — `updatePlayerName` (to be replaced by `updatePlayer`)
- `docs/01-user-flows.md` — settle-up flow (to be updated)
- `docs/04-security-threat-model.md` — Player PII handling
- `specs/changes/0010-session-detail-view.md` — established the player table structure being modified here
- `specs/changes/0006-settlement-algorithm.md` — produces the payments this spec links from

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-04 | Proposed | Initial draft |
| 2026-05-04 | Accepted | Accepted by owner; implementation begins on `feature/0014-venmo-payment-links` |

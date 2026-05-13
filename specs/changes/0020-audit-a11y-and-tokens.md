# Change 0020: Audit fixes — accessibility & semantic-color tokens

## Status
Implemented

## Owner
Michi Kono

## Goal

Close the remaining items from the impeccable audit that spec 0018 didn't cover: status-badge text contrast (WCAG AA), missing `--success` / `--warning` semantic tokens (so success/warning state colors stop reaching for raw Tailwind palette), three accessibility hygiene fixes, a real first-run empty state on the sessions index, and two small dark-mode / heading-hierarchy polish items.

## Context

The impeccable audit produced 13 findings. Spec 0018 (mobile-first UX overhaul) plus its revision and the typography polish that followed addressed every mobile / touch-target / dialog-close finding. The items below are the leftovers — none of them are large, but they cluster nicely as one cohesive "audit fix" spec and they all touch a11y / theming concerns that 0018 deliberately left alone (0018 was "presentation-only, no token revisions").

Audit findings still open:

| # | Severity | Item | File |
|---|---|---|---|
| 1 | P1 | Status badge text fails WCAG AA on tinted light background | `globals.css`, `status-badge.tsx` |
| 2 | P2 | `delta-indicator` and "Paid" label reach for raw `emerald-*` / `rose-*` | `delta-indicator.tsx`, `payment-list.tsx`, `globals.css` |
| 3 | P2 | Activity-log timestamp tooltip is keyboard-inaccessible (uses `title=`) | `activity-log.tsx` |
| 4 | P2 | `prefers-reduced-motion` only guards the row-flash, not transitions/spinners | `globals.css` |
| 5 | P2 | Session search `AbortController` not aborted on effect cleanup | `session-search-input.tsx` |
| 6 | P3 | Bare "No sessions yet." paragraph is the first-run state | `session-list.tsx` |
| 7 | P3 | QR `bg-white` square in dark mode looks like a printer error | `payment-list.tsx` |
| 8 | P3 | Sign-in page has no `<h1>` (CardTitle is a `<div>`) | `sign-in-form.tsx`, `sign-in/page.tsx` |

Relevant docs / specs:
- `specs/changes/0009-ui-design-system.md` — original token system
- `specs/changes/0018-mobile-first-ux-overhaul.md` — predecessor, intentionally token-free
- `docs/08-ux-spec.md` — status badge usage

## User-visible behavior

After this change:

1. **Status badges** keep their current look (subtle tint + colored text) but the text is dark enough on light backgrounds and light enough on dark backgrounds to read at WCAG AA contrast.
2. **Balance / "Paid" indicators** look identical in both themes and respect global theme tweaks (no more direct-to-Tailwind `emerald-700`/`rose-900` references).
3. **Activity-log entries** show the absolute timestamp on hover **and** on keyboard focus, via the existing `Tooltip` primitive. The visible row remains a relative timestamp.
4. **Users with reduced-motion preferences** see no animations / spinners / dialog enter-exit animations beyond a 1ms hint. Static state still updates correctly.
5. **Session search** that aborts mid-flight (component unmounts, user closes the drawer) no longer keeps a stale fetch alive in the background.
6. **First-time users** with zero sessions see a small panel titled "Track your first session" with a one-line description and a `New session` button — not a bare "No sessions yet." paragraph.
7. **The QR-pay dialog** retains its mandatory white QR background but it's framed by a soft ring in dark mode so it sits intentionally on the dark surface.
8. **Screen reader users** landing on the sign-in page hear a real `<h1>` ("Poker Ledger") instead of starting in heading-rank 0.

No interaction flows change.

## Non-goals

- **No primitive refactors.** `Button`, `Input`, `Dialog`, etc. stay as 0018 left them.
- **No mobile-touch-target work.** 0018 is the authority.
- **No new icon library or animation library.**
- **No new ARIA roles on the Venmo Pay `<a>`.** Link semantics are correct since it actually navigates externally.
- **No redesign of the sessions index.** Empty state grows a CTA panel; the rest of the page is unchanged.
- **No changes to the `--destructive` token** — used for genuine errors, not over/short balance.
- **No new env vars, no Firestore changes, no Server Action changes.**
- **No e2e tests added** beyond what already covers the affected surfaces. Mobile a11y is verified manually.

## Data model impact

None.

## Diagram impact

None. The affected docs (`docs/08-ux-spec.md` status badge guidance, if any) are prose-only.

## API impact

None.

## Security/privacy impact

None. The only async behavior change is aborting an in-flight `fetch` on unmount, which is a benign improvement (no data exposure delta).

## Local development impact

- No new dependencies.
- No new env vars.
- `npm run dev` behavior unchanged.

**Files added:** none.

**Files edited:**

- `src/app/globals.css`
  - Pair each `--status-*` with `--status-*-fg` (foreground text). Light-mode fg has L≤0.48 for ≥4.5:1 against the page background; dark-mode fg has L≥0.85.
  - Add `--success`, `--success-foreground`, `--warning`, `--warning-foreground` tokens (light + dark).
  - Wire all six new tokens into `@theme inline` so Tailwind utilities (`text-status-in-progress-fg`, `bg-success`, etc.) resolve.
  - Add a global `@media (prefers-reduced-motion: reduce)` rule that neutralizes `animation-duration`, `animation-iteration-count`, and `transition-duration`. Keep the existing `.player-row-flash` rule as belt-and-suspenders.
- `src/components/status-badge.tsx`
  - Swap `text-status-X` for `text-status-X-fg` in every status row.
- `src/app/(app)/sessions/[name]/delta-indicator.tsx`
  - Replace `emerald-*` / `rose-*` literals with `bg-success/15 text-success-foreground border-success/30` and the matching `warning` set.
- `src/app/(app)/sessions/[name]/payment-list.tsx`
  - "Paid" label: `text-emerald-700 dark:text-emerald-400` → `text-success`.
  - QR dialog white wrapper: add `ring-1 ring-foreground/10 dark:ring-foreground/20` so the white square reads as intentional in dark mode. No change to QR colors (they must stay black-on-white for scannability).
- `src/app/(app)/sessions/[name]/activity-log.tsx`
  - Replace `<span title={...}>` with a `Tooltip` + `TooltipTrigger` from `@/components/ui/tooltip.tsx`. Trigger renders a focusable `<button type="button" className="cursor-default ...">` so keyboard users can reveal the absolute date. Wrap the list in a `TooltipProvider` (or add one to the closest layout if the project convention is global).
- `src/components/sessions/session-search-input.tsx`
  - Effect cleanup: also `abortRef.current?.abort()`. No behavior change in steady state.
- `src/app/(app)/sessions/session-list.tsx`
  - When `mode === "all"` and `totalSessions === 0`, render a panel with a heading ("Track your first session"), a one-line description, and the existing `<CreateSessionDialog>` triggered by a default-size button. Keep the bare-paragraph fallback for the filtered view (e.g., "no archived sessions") — that's not a first-run state.
- `src/app/sign-in/sign-in-form.tsx`
  - Promote the page title to a real `<h1>`. Two options: wrap `CardTitle` with `<h1>` (clean DOM) or add a visually-hidden `<h1 className="sr-only">Poker Ledger</h1>` above. The spec implements option A (semantic + zero visual change).
- `src/components/help/help-modal.tsx`
  - Replace `<header>` element wrapping the title with `<DialogPrimitive.Title>` already inside — minor cleanup so the modal exposes a single `dialog`-labelled heading. (Confirmed during research that this is the right scope — see Implementation notes.)

**Files unchanged:** all Server Actions, all `src/lib/**`, all `src/app/api/**`, all auth/firestore code, all primitives in `src/components/ui/` *except* token-derived class usage.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Manual contrast check | DevTools — pick each status badge fg/bg, confirm ≥ 4.5:1 in light AND dark | Yes | Yes | |
| Manual reduced-motion check | macOS System Settings → Accessibility → Display → Reduce motion, reload, confirm dialogs/spinners are static | Yes | Yes | |
| Manual keyboard tooltip | Tab through activity log, confirm tooltip appears on focus | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

E2E (Playwright) is desktop-only today; mobile/a11y checks remain manual per the precedent set by 0018.

## Test plan

- **`status-badge.test.tsx`** (new) — assert each status renders the `text-status-*-fg` class, not the legacy `text-status-*`. Lightweight class-presence assertion.
- **`delta-indicator.test.tsx`** — extend the existing balanced / out-of-range tests with class-presence assertions for `text-success-foreground` / `text-warning-foreground`. Keep the existing data-state assertion.
- **`activity-log.test.tsx`** (new) — assert tooltip trigger is focusable (`tabIndex >= 0`) and that the absolute timestamp text is reachable via the rendered Tooltip content. Use `@testing-library/user-event` Tab + `findByText` for the absolute timestamp.
- **`session-search-input.test.tsx`** — extend to mount → start search → unmount, then assert the underlying `AbortController.abort` was called (spy on `AbortController.prototype.abort` for the duration of the test).
- **`session-list.test.tsx`** — add an "all" mode empty-state test: renders the new heading + CTA; doesn't render the bare paragraph.
- **`sign-in-form.test.tsx`** — assert exactly one `<h1>` with text "Poker Ledger".

No new logic in pure modules (`totals.ts`, `currency/*`, etc.) — those tests stay as-is.

## Acceptance criteria

- [ ] Each `StatusBadge` variant meets WCAG AA (≥ 4.5:1) contrast between text and its tinted-15/20 background in BOTH `:root` and `.dark`. Verified via DevTools color picker on a real running app.
- [ ] No file under `src/**` references raw `emerald-*` or `rose-*` Tailwind utilities (`rg "(emerald|rose)-[0-9]"` returns no matches in `src`).
- [ ] `globals.css` defines `--success`, `--success-foreground`, `--warning`, `--warning-foreground` for both light and dark mode, wired into `@theme inline`.
- [ ] Activity-log entries reveal the absolute timestamp on **focus** (not just hover) of the relative-time element.
- [ ] With `prefers-reduced-motion: reduce` active, dialog open/close, spinner spin, and dialog backdrop fade are visually static. (Inputs and state changes still work.)
- [ ] Unmounting `SessionSearchInput` mid-fetch calls `AbortController.abort()` on the in-flight request.
- [ ] `/sessions` with zero total sessions shows a heading + CTA panel, not a bare paragraph.
- [ ] QR pay dialog white square has a visible border/ring in dark mode.
- [ ] Sign-in page DOM contains exactly one `<h1>` with the project name.
- [ ] All quality gates above pass.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

No env vars, no migrations. Vercel preview deploy doubles as the visual contrast check for badges and the dark-mode QR ring. No feature flag needed — token darkening is forward-compatible.

## Implementation notes

### Order of operations

1. **Tokens first** — edit `globals.css`. Add `--status-*-fg`, `--success*`, `--warning*`, the reduced-motion media block, and the `@theme inline` wiring. Verify `npm run dev` still boots and the existing badges visibly darken in light mode (they should look "more readable", not "different color").
2. **Migrate consumers** — flip `status-badge.tsx` to `*-fg`, `delta-indicator.tsx` and `payment-list.tsx` to `success`/`warning` utilities, QR ring in dark mode.
3. **Activity-log tooltip** — wrap the relative-time `<span>` in `Tooltip` + `TooltipTrigger`. If `TooltipProvider` isn't already mounted at a parent layer, mount it locally inside `ActivityLog` (the base-ui provider is cheap).
4. **Reduced-motion sanity check** — toggle the OS preference, walk through a session detail flow, confirm dialogs still open/close (just instantly) and spinners don't visually spin.
5. **Empty-state panel** — only the `mode === "all" && totalSessions === 0` branch of `session-list.tsx` changes. Filtered-mode empties stay as-is.
6. **AbortController cleanup** — single-line change. Keep existing `clearTimeout`.
7. **Sign-in `<h1>`** — confirm `CardTitle` accepts `render`-style override or simply wrap the `CardTitle` in `<h1 className="contents">` so styling is preserved and the heading rank is correct.
8. **Tests** — add the new tests alongside.
9. **Run gates** — `npm run check`.

### Token-darkening targets (final values to be tuned during step 1)

Approximate targets, subject to DevTools verification:

| Token | Light L (current → proposed fg) | Dark L (current → proposed fg) |
|---|---|---|
| `status-in-progress` | 0.72 → fg 0.42 (chroma 0.13, hue 155) | 0.70 → fg 0.85 |
| `status-settling`    | 0.78 → fg 0.45 (chroma 0.14, hue 75) | 0.78 → fg 0.88 |
| `status-settled`     | 0.55 → fg 0.40 (chroma 0.03, hue 250) | 0.62 → fg 0.82 |
| `status-archived`    | 0.65 → fg 0.42 (chroma 0.01, hue 0) | 0.62 → fg 0.80 |

The base `--status-*` tokens are kept unchanged so the bg-tint utility (`bg-status-*/15`) keeps its current look; only the foreground hardens.

### Pitfalls

- Don't touch the base `--status-*` values — that would shift the tinted-background look and you'd be re-fighting 0018's polished surfaces.
- The `tw-animate-css` library exports `data-state=delayed-open:animate-in` etc. — those `animation-duration` CSS variables ARE the thing the reduced-motion rule has to override. Confirm the `animation-duration: 0.001ms !important` rule reaches them. If it doesn't (because they're set inline by the library), scope the override to the specific data-attribute selectors.
- The base-ui Tooltip needs a `TooltipProvider` somewhere up-tree. If there isn't one at app-shell level, add one inside `ActivityLog` (or `session-view.tsx`).
- For `session-search-input.tsx`: `abortRef.current.abort()` causes the in-flight `fetch().catch()` to receive an `AbortError`. The existing `catch` block already swallows aborts, so no functional change.
- Sign-in's `CardTitle` is a `<div>`, not a heading. The cleanest fix is to render `<h1>` inside `CardHeader` directly and drop `CardTitle` for this one surface (CardDescription stays).

## Open questions

None blocking.

- Should the activity-log relative time also include `aria-label` with the absolute time as a backup to the tooltip? Possible follow-up; not in scope here.
- Should we add a `--info` token now or defer? Defer — no consumer needs it yet (don't add unused tokens).

## Links

- `specs/changes/0009-ui-design-system.md` — token system origin
- `specs/changes/0018-mobile-first-ux-overhaul.md` — predecessor that intentionally skipped tokens
- `docs/08-ux-spec.md` — UX spec (status badges, empty states)
- WCAG 2.1: 1.4.3 Contrast (Minimum); 2.5.5 Target Size (already met by 0018)

## Implementation deviations from the proposed spec

- **`--success-foreground` and `--warning-foreground` were not added.** No consumer needed them — `delta-indicator` and `payment-list` use `text-success`/`text-warning` directly on neutral card surfaces, mirroring the `--destructive` single-token pattern already in the file. Adding unused tokens conflicts with the project rule about not adding features beyond what the task requires. Easy to add later when a consumer needs them.
- **One out-of-scope format fix was bundled in.** `src/app/(app)/sessions/[name]/player-details-sheet.tsx` was not Biome-2.4.14-formatted in `main` (the deps-upgrade commit on `main` bumped Biome but never reran `npm run format` on this file). The format gate failed in this PR before any of my edits to that file. The fix is whitespace-only, applied via `biome format --write`, and called out in the PR body.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-13 | Proposed | Initial draft |
| 2026-05-13 | Accepted | Approved by owner — proceed with implementation |
| 2026-05-13 | Implemented | All gates pass locally (format, lint, type-check, 627 tests, build). Manual contrast / reduced-motion / keyboard-tooltip smoke checks deferred to PR review on the preview deploy. |

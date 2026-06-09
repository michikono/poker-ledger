# Change 0021: Destructive contrast, `--loss` token, em-dash sweep

## Status
Accepted

## Owner
Michi Kono

## Goal

Clear every remaining P1 / P2 / P3 from the post-0020 impeccable audit in a single coordinated pass: harden `text-destructive` to WCAG AA on neutral surfaces, decouple "negative net" from "destructive action", remove em-dashes from user-facing copy, and tidy up two final polish items.

## Context

After 0018 and 0020 the audit score rose from 13 to 19. The remaining items cluster around two themes: one more token-readability fix (`--destructive` is roughly 3.75:1 on neutral surfaces, below WCAG AA 4.5:1 for body text) and a copy-law violation (53 em-dash occurrences in source, of which ~30 are in user-facing strings). Bundling them keeps the token surface coherent and the PR small.

Findings closed:

| # | Severity | Item |
|---|---|---|
| 1 | P1 | `text-destructive` body text fails WCAG AA on `bg-card` / `bg-background` |
| 2 | P2 | Em-dashes in user-facing copy (toasts, inline notices, help-modal prose) |
| 3 | P3 | Negative-net display reuses `--destructive`, conflating loss with error |
| 4 | P3 | `cursor-default` on activity-log tooltip trigger hides mouse affordance |
| 5 | P3 | `—` placeholder glyph for empty money cells reads the same character as the banned em-dash and isn't documented as a tabular exemption |

Relevant prior specs:
- `specs/changes/0009-ui-design-system.md` — original token system
- `specs/changes/0020-audit-a11y-and-tokens.md` — paired `--status-*-fg` precedent

## User-visible behavior

1. **Error messages and destructive button/badge labels read at WCAG AA.** Same color *family*, darker in light mode, brighter in dark mode. Tinted destructive backgrounds keep their current look.
2. **Negative net amounts** in player cards / rows render in a deeper warning red that is visually distinct from error messages.
3. **Toasts, inline notices, and the how-to-play guide** no longer use em-dashes. Sentences read identically in meaning.
4. **Activity-log timestamps** show a pointer cursor on hover so mouse users discover the tooltip.
5. **`—` placeholders in money cells** are unchanged visually; a code comment documents the intentional tabular convention.

No interaction flows change.

## Non-goals

- **No primitive refactors** beyond swapping token names in class strings.
- **No mobile-touch / layout changes** (0018 territory).
- **No motion changes** (0020 closed reduced-motion).
- **No new components, no new dependencies, no env vars.**
- **No comment-only em-dash changes.** Source comments and commit messages are out of scope; only user-rendered strings.
- **No changes to commit messages or PR titles** in this repo's history.

## Data model impact

None.

## Diagram impact

None.

## API impact

None.

## Security/privacy impact

None.

## Local development impact

None. No new env vars, no new deps, no new processes.

**Files edited:**

- `src/app/globals.css`
  - Add `--destructive-fg` (light + dark), wire into `@theme inline`.
  - Add `--loss` (light + dark), wire into `@theme inline`.
- `src/components/ui/button.tsx` — destructive variant uses `text-destructive-fg`.
- `src/components/ui/badge.tsx` — destructive variant uses `text-destructive-fg`.
- `src/components/ui/dropdown-menu.tsx` — `data-variant=destructive` uses `text-destructive-fg`.
- `src/app/(app)/sessions/create-session-dialog.tsx` — inline error class → `text-destructive-fg`; em-dash in `NAME_COLLISION_TOAST`.
- `src/app/(app)/sessions/[name]/player-list.tsx` — inline error class.
- `src/app/(app)/sessions/[name]/player-details-sheet.tsx` — four inline error spans, two tinted boxes (kept as-is since the bg-tint+text combo is high-contrast enough at AA against the tinted bg), em-dashes in user-visible copy.
- `src/app/(app)/sessions/[name]/default-buy-in-modal.tsx` — inline error class.
- `src/app/(app)/sessions/[name]/settling-modal.tsx` — three inline error spans; em-dashes in toast strings.
- `src/app/(app)/sessions/[name]/player-card.tsx` — negative-net class → `text-loss`; tabular-placeholder comment.
- `src/app/(app)/sessions/[name]/player-row.tsx` — negative-net class → `text-loss`; tabular-placeholder comment.
- `src/app/(app)/sessions/[name]/payment-list.tsx` — em-dash in confirm-modal copy.
- `src/app/(app)/sessions/[name]/session-view.tsx` — em-dash in zero-payment banner.
- `src/app/(app)/sessions/[name]/activity-log.tsx` — drop `cursor-default` on tooltip trigger.
- `src/app/sign-in/sign-in-form.tsx` — tinted-error box stays (sufficient contrast on the tint), but `text-destructive` → `text-destructive-fg` for consistency.
- `src/components/help/how-to-play.tsx` — long-form em-dash sweep.

**Files unchanged**: all Server Actions, all `src/lib/**`, all `src/app/api/**`, auth/Firestore code, tests except where assertions reference token class names.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Manual contrast check | DevTools — destructive button label and error message on `bg-card`, light + dark | Yes | Yes | |
| Em-dash audit | `rg "—" src` returns only comment lines or tabular `—` placeholders | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- **Token-class assertions** added where they exist for related tokens (status-badge precedent):
  - `delta-indicator.test.tsx` already asserts `text-success` / `text-warning` — no change.
  - `player-card.test.tsx` (or `player-row.test.tsx`) — assert negative net renders `text-loss` and not `text-destructive`.
- **Em-dash regression test** (cheap): a small unit test that reads a curated list of UX-string source files and asserts no `—` appears outside the tabular-placeholder constants. (Skipped if it introduces friction.)
- **Existing tests stay green.** No semantic flow changes.

## Acceptance criteria

- [ ] `text-destructive-fg` exists in `globals.css` light + dark, wired into `@theme inline`.
- [ ] `text-loss` exists in `globals.css` light + dark, wired into `@theme inline`.
- [ ] `text-destructive` is no longer used for body text on neutral surfaces. (Tinted-bg uses stay if the new value still meets AA against the tint.)
- [ ] Negative-net displays in `player-card` and `player-row` use `text-loss`, not `text-destructive`.
- [ ] No user-facing string under `src/**` contains `—`. (Source comments and the tabular `—` placeholder are exempt; the placeholder usage carries a comment.)
- [ ] `activity-log.tsx` tooltip trigger no longer carries `cursor-default`.
- [ ] All quality gates pass (or failures documented with remediation).
- [ ] Spec conformance review completed.

## Rollout/deployment notes

None. Token darkening is forward-compatible; no migrations.

## Implementation notes

### Token targets

Light mode:
- `--destructive`: keep at `oklch(0.577 0.245 27.325)` (used for tinted bg / border).
- `--destructive-fg`: `oklch(0.42 0.2 27)` — darker than base; meets ≥ 4.5:1 against L=1.0 card surface.
- `--loss`: `oklch(0.48 0.18 25)` — distinct from `--destructive`; slightly warmer, less saturated so it reads as "money lost" rather than "error".

Dark mode:
- `--destructive`: keep at `oklch(0.704 0.191 22.216)`.
- `--destructive-fg`: `oklch(0.85 0.16 25)` — lighter, still saturated red.
- `--loss`: `oklch(0.78 0.16 25)`.

Tune in DevTools during step 1 if a value reads off.

### Em-dash mapping cheat-sheet

Most em-dashes in this codebase serve one of three roles. Replace per the role:

- **Parenthetical aside** ("…X — Y — …Z."): switch to commas or parentheses.
- **Reason-after-statement** ("X — Y."): switch to a period or colon, depending on whether Y is a complete sentence.
- **Apposition / "namely"**: switch to a colon or comma.

Examples:
- `"Couldn't create a session — please try again."` → `"Couldn't create a session. Please try again."`
- `"Everyone broke even — nothing to settle."` → `"Everyone broke even. Nothing to settle."`
- `"Read-only — this session can no longer be edited."` → `"Read-only. This session can no longer be edited."`
- `"Scanning opens Venmo only — you'll still need to mark this payment paid here after."` → `"Scanning opens Venmo only. You'll still need to mark this payment paid here after."`

### Pitfalls

- **Don't touch the tabular `—` placeholder** in `player-row.tsx` / `player-card.tsx` / `player-details-sheet.tsx`. Add a one-line comment near the usage explaining it's a tabular convention so future audits don't re-flag it.
- **Don't touch comments / JSDoc / commit messages.** Out of scope.
- **The destructive button/badge variants render `text-destructive` on `bg-destructive/10`.** The tinted bg in light mode is L≈0.96 (still near-white), so the contrast against `text-destructive` (L=0.58) is still ~3.8:1 → AA fail at body sizes. Migrate these consumers too.
- **`text-destructive` inside `bg-destructive/10` boxes** (e.g., the error-box pattern in `sign-in-form` and `player-details-sheet`): bg tint is L≈0.94. text-destructive contrast on that is similar (~3.6:1). Migrate these too — single coherent shift.

### Order of operations

1. Add tokens in `globals.css`; verify `npm run dev` boots and look at a `destructive` button + an error message.
2. Migrate variants (`button`, `badge`, `dropdown-menu`) — biggest blast radius first.
3. Migrate inline error-text consumers across app screens.
4. Switch negative-net to `text-loss`.
5. Em-dash sweep (search `src` for `—`, fix each user-facing hit).
6. Drop `cursor-default` on activity-log tooltip trigger; add tabular `—` comment.
7. Run gates.

## Open questions

None blocking.

## Links

- `specs/changes/0020-audit-a11y-and-tokens.md` — preceding token work (paired-fg pattern, semantic state tokens)
- `specs/changes/0009-ui-design-system.md` — token system origin

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-13 | Proposed | Initial draft |
| 2026-05-13 | Accepted | Approved by owner: "run these all at once" |

# Change 0009: UI Design System & App Shell

## Status
Accepted

## Owner
Michi Kono

## Goal

Establish a polished, mobile-first UI design system and authenticated app shell — replacing the inline-styled header in `src/app/(app)/layout.tsx`, installing the shadcn/ui components the MVP roadmap depends on, codifying a no-hard-refresh form convention, and restyling the sign-in page — so every subsequent feature spec inherits a consistent and pretty look-and-feel by default.

## Context

The current authenticated layout (`src/app/(app)/layout.tsx`) uses inline `style={{...}}` objects (`padding: "1rem"`, `borderBottom: "1px solid #eee"`). The sign-in page is similarly bare. shadcn/ui was initialized in spec 0004 with four components (Badge, Button, Input, Skeleton); the design tokens are wired in `globals.css` (`@import "shadcn/tailwind.css"`) and Geist is loaded as the font, but nothing ties the pieces together into an actual app shell. Every new feature spec is currently forced to either ship ugly UI or invent its own polish.

`docs/08-ux-spec.md` already specifies the chrome in detail — a six-item side menu (Search, New session, In progress, Settling, Settled, Archived), rendered as a 240px left rail at `md:` breakpoints and as a hamburger-triggered drawer below — so the design is decided; it just hasn't been built. This spec builds it, plus the foundational primitives (additional shadcn components, status-color tokens, form patterns) that downstream specs will compose with.

It is **partially parallel-safe** with spec 0005 (create-session). 0009 owns chrome, primitives, and the sign-in page. 0005 owns session-page-specific files (`src/app/(app)/sessions/page.tsx`, `session-list.tsx`, `[name]/page.tsx`, etc.). The narrow conflict surface is `globals.css`, `src/app/layout.tsx`, `src/components/status-badge.tsx`, and `package.json` — see **Coordination with in-flight worktrees** below.

Relevant docs: `docs/08-ux-spec.md`, `docs/01-user-flows.md`, `docs/12-mvp-scope.md`.

## User-visible behavior

After this change, a signed-in user sees:

1. **App shell.** Every authenticated page is wrapped in a responsive shell:
   - **≥ 768px (md+):** a 240px fixed left rail with the six menu items from `docs/08-ux-spec.md`, the app title at top, and a user menu (avatar + display name + sign-out) at bottom.
   - **< 768px:** the rail collapses; a slim header bar shows the app title, a hamburger button on the left, and the avatar on the right. Tapping the hamburger opens a full-width sheet drawer that contains the six menu items. Drawer dismisses on item-tap or backdrop-tap.
2. **Six menu items navigate (links exist; filter behavior arrives in later specs):**
   - Search → `/sessions?focus=search` (the param is read by a later spec; today the link just navigates to `/sessions`).
   - New session → `/sessions` (the empty-state / header CTA there opens the create-session dialog from 0005).
   - In progress / Settling / Settled / Archived → `/sessions?status=<value>` (param ignored until a follow-up spec wires filtering).
3. **Sign-in page** restyled with the same design tokens, centered card, large Google button, no inline styles.
4. **Form interactions never cause hard refreshes.** All forms in the app submit via Server Actions (or `router.push` after a successful client-side handler), use `useTransition`/`useFormStatus` for pending states, and update the page via `revalidatePath` / `revalidateTag` rather than `window.location.reload()`. This is documented as a project-wide convention in `docs/15-local-development.md` (or a dedicated section in `docs/08-ux-spec.md`); the only form this spec actually wires is sign-in.
5. **Toast notifications** appear in the lower right (mobile: bottom center) for transient feedback. Toasts dismiss after 4s by default, are dismissible by swipe/click, stack up to 3.
6. **Status badges** use semantic per-status colors: in_progress = emerald, settling = amber, settled = slate/muted, archived = neutral/dashed. Sentence-case labels via `formatStatus()` helper.
7. **Poker-themed brand palette** layered on top of the neutral shadcn chrome — used sparingly for the logomark, primary CTAs, and hover/focus accents. Four brand tokens: `--felt` (deep poker-table green, primary brand color), `--chip-gold` (CTA / accent highlight), `--suit-red` (hearts/diamonds — reserved for future use, e.g. negative balances), `--suit-black` (spades/clubs — reserved for future use). The brand tokens are *separate from* the status tokens so semantic colors don't get tangled with branding.
8. **Card-suit logomark.** A small SVG playing-card icon (rounded-corner card outline with a spade glyph centered, in `--felt` and `--chip-gold`) appears next to the app title in the side rail and centered above the sign-in card. The same SVG is registered as the favicon (`src/app/icon.svg`).

## Non-goals

- **Restyling the sessions index, session row, session-list states (loading/empty/error), or `/sessions/:name`.** Those files belong to spec 0005 (in-flight) and to follow-up feature specs. Once 0009 lands, 0005 (or its successor) can rebase and pick up the new primitives. Forcing the polish to land here would create a hard merge-conflict with the in-flight 0005 worktree.
- **Dark mode.** shadcn tokens are dark-mode-ready; flipping the toggle is a one-line change in a follow-up. Out of scope here to avoid doubling the visual-QA surface.
- **Filter routes (`/sessions?status=...`).** This spec only emits the links; honoring the param happens in a follow-up that owns the filter logic.
- **A command-palette / global search dialog.** The "Search" menu item links to `/sessions` for now. A dedicated spec can replace it with a `cmdk`-style palette later.
- **Animation libraries beyond `tw-animate-css`** (already installed) **and shadcn's built-in motion.** No Framer Motion.
- **Custom illustrations or marketing imagery.** Type and whitespace carry the look.
- **Localization / i18n.** English-only per `docs/12-mvp-scope.md`.
- **Replacing or re-theming the existing four shadcn components** (Badge, Button, Input, Skeleton). They stay; the status badge wrapper is refreshed.
- **Removing the `@base-ui/react` dependency.** It's installed; not removing or expanding its use here.
- **Auth flow changes.** Sign-in is restyled, not refactored; the existing `src/app/sign-in/page.tsx` and `actions.ts` keep their behavior.

## Data model impact

None.

## Diagram impact

None. `docs/08-ux-spec.md` already describes the navigation model in prose; no mermaid diagrams in that doc to update. If a `flowchart` for navigation is added later, it can reflect the implemented shell — not in scope here.

## API impact

None. No new endpoints, no Server Action signature changes. The sign-in Server Action is unchanged.

## Security/privacy impact

None. The auth gate stays at `src/app/(app)/layout.tsx`'s session-cookie verification — only its presentation changes. The user menu surfaces `displayName.split(" ")[0]` (already computed) and sign-out; no new fields are exposed.

## Local development impact

**New runtime dependencies (added to `package.json`):**
- `sonner` — toast primitive used by shadcn's Toaster wrapper.
- `vaul` — drawer primitive used by shadcn's Sheet/Drawer (mobile menu). shadcn's `add sheet` will pull this in.
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-avatar`, `@radix-ui/react-label`, `@radix-ui/react-separator` — pulled in by `npx shadcn@latest add ...`. shadcn handles these transitively; no manual `npm install` required.

No new env vars. No new processes. `npm run dev` behavior unchanged.

**Files added:**
- `src/components/layout/app-shell.tsx` — composes header + side rail/drawer + main.
- `src/components/layout/header.tsx` — top bar (app title, hamburger on mobile, user menu).
- `src/components/layout/side-rail.tsx` — md+ left rail.
- `src/components/layout/mobile-drawer.tsx` — sheet-based drawer for < md.
- `src/components/layout/nav-items.ts` — single source of truth for the six menu items (label, href, icon).
- `src/components/layout/user-menu.tsx` — avatar + display name + sign-out trigger (re-uses the existing `SignOutButton`).
- `src/components/ui/dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `sonner.tsx`, `card.tsx`, `separator.tsx`, `tooltip.tsx`, `avatar.tsx`, `label.tsx` — vanilla shadcn add. (`form.tsx` was originally listed but the project's `base-nova` shadcn style does not ship it; deferred to a later spec that introduces an actual react-hook-form-backed form. Sign-in continues to use `useState` / `useTransition`.)
- `src/components/icons/card-icon.tsx` — playing-card SVG logomark (card outline + suit glyph). Accepts `className` and `size` props; consumes `--felt` and `--chip-gold` via `currentColor` / `fill` so it themes with the palette. Composed from a hand-rolled `<svg>` (no new icon-set dependency); the suit glyph is a Lucide `<Spade>` re-used inside the card frame.
- `src/app/icon.svg` — favicon, same artwork as `card-icon.tsx` but flattened to static colors. Picked up automatically by Next.js App Router file conventions.
- `src/lib/sessions/format-status.ts` — `formatStatus(status: SessionStatus): string` returning sentence-case labels per `docs/08-ux-spec.md`.
- `src/lib/sessions/format-status.test.ts` — exhaustive enum-coverage test.

**Files edited:**
- `src/app/(app)/layout.tsx` — replace inline-styled header with `<AppShell>{children}</AppShell>`. Auth-gating logic untouched.
- `src/app/layout.tsx` — keep Geist; add Geist Mono via `next/font/google` for monetary/numeric displays (`--font-mono` CSS variable). Add `<Toaster />` (sonner) at the body level.
- `src/app/globals.css` — add per-status color tokens (`--status-in-progress`, `--status-settling`, `--status-settled`, `--status-archived`), brand palette tokens (`--felt`, `--chip-gold`, `--suit-red`, `--suit-black`), and confirm font variables.
- `src/components/status-badge.tsx` — refresh to consume `formatStatus` and the new status-color tokens; keep its existing public props.
- `src/app/sign-in/page.tsx` — restyle: centered Card with logo, headline, sub-headline, and a styled "Continue with Google" button. Behavior unchanged.

**Files unchanged:**
- All existing shadcn components, all `src/lib/firebase/*`, `src/lib/auth/*`, `src/app/(app)/sessions/*`, `src/app/sign-in/actions.ts`, `firestore.rules`, `firebase.json`, all docs except `docs/08-ux-spec.md` (a small note about the implemented shell) and `docs/15-local-development.md` (the no-hard-refresh form convention).

## Coordination with in-flight worktrees

- **0005 (create-session, in flight):** narrow file-level conflict on `src/app/globals.css`, `src/app/layout.tsx`, `src/components/status-badge.tsx`, and `package.json`. **Recommended sequencing: land 0009 first.** 0005 then rebases onto post-0009 main; its restyling work in `session-list.tsx` and `[name]/page.tsx` adopts the new shadcn primitives (Card, Sheet, Dialog) and the refreshed status badge naturally. The merge resolutions are mechanical (accept 0009's globals/layout/badge wholesale; keep 0005's session-folder additions).
- **0006 (settlement algorithm), 0007 (state-transition validator), 0008 (per-worktree dev ports):** zero file overlap.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual — see below | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

Integration tests (Playwright): N/A for this spec (no new flows; the sign-in flow is unchanged in behavior). A future spec can add visual regression once a stable feature flow exists.

**Local smoke test (manual, required):**
1. Sign-in page renders the centered card with the new styling at desktop and at 360px viewport widths. The Google button is at least 44px tall on mobile.
2. After sign-in, the authenticated app shell renders. At ≥ 768px the left rail is visible with all six items. At < 768px the hamburger button opens the drawer; tapping a menu item closes the drawer and navigates.
3. The user menu (avatar + first name) appears in the rail on desktop and in the header on mobile. Sign-out works.
4. Trigger a toast (e.g., temporarily wire the sign-out button to also fire a `toast.success("Signed out")`; revert before commit) and verify it renders correctly on desktop and mobile.
5. Visit `/sessions` and confirm the existing index page renders inside the new shell without layout breakage. (No restyle of the index itself in this spec — it just inherits the shell.)
6. No console warnings about missing Tailwind utilities, hydration mismatches, or Server Component boundaries.

## Test plan

**Unit tests (TDD where reasonable):**
- `formatStatus(status)` — `src/lib/sessions/format-status.test.ts`. Cases: `"in_progress"` → `"In progress"`, `"settling"` → `"Settling"`, `"settled"` → `"Settled"`, `"archived"` → `"Archived"`. TS exhaustiveness check (compile-time `never` assertion) covers any future enum additions.

**Component tests (Testing Library):**
- `<AppShell>` — `src/components/layout/app-shell.test.tsx`. Renders the rail at desktop viewport and the header (with hamburger) at mobile viewport. Use `window.matchMedia` mock or a fixed-prop variant for the test. Asserts the six menu items are rendered with correct `href` values from `nav-items.ts`.
- `<MobileDrawer>` — opens on hamburger click, closes on backdrop click and on item click (use `userEvent`). Asserts `aria-expanded` and focus-trap behavior delegated to the shadcn Sheet primitive (one smoke assertion is enough).
- `<UserMenu>` — renders display name and avatar; sign-out trigger calls the bound action.
- `<StatusBadge>` — refresh of the existing test suite (already in `src/components/status-badge.test.tsx`). Asserts each status renders the correct label (via `formatStatus`) and the right CSS class for color. Keep the existing four-status enum coverage.

**No new integration / E2E tests** — sign-in flow behavior is unchanged; visual polish is verified by the manual smoke test.

## Acceptance criteria

- [ ] `src/app/(app)/layout.tsx` no longer uses inline `style={{}}` objects; it renders `<AppShell>{children}</AppShell>`.
- [ ] At ≥ 768px viewports, the left rail is visible with the six menu items from `docs/08-ux-spec.md` in the documented order.
- [ ] At < 768px viewports, the rail is hidden; a header bar with a hamburger button is visible. Tapping the hamburger opens a sheet drawer with the same six items.
- [ ] Drawer dismisses on backdrop tap and on menu-item tap.
- [ ] User menu (avatar + first name) is visible on every authenticated page; sign-out works.
- [ ] Sign-in page renders a centered card with the new styling; Google button hit target is ≥ 44px tall on mobile.
- [ ] All nine new shadcn primitives are installed under `src/components/ui/` (dialog, sheet, dropdown-menu, sonner, card, separator, tooltip, avatar, label). `form.tsx` is intentionally deferred — `base-nova` style does not ship one.
- [ ] `<Toaster />` is mounted in the root layout; calling `toast.success(...)` from any component renders a visible toast.
- [ ] `formatStatus()` helper exists and is the only mapping from `SessionStatus` enum to display string in the codebase (grep verifies no other inline mappings).
- [ ] Per-status color tokens are defined in `globals.css` and consumed by `<StatusBadge>`; no per-status colors are hardcoded in component files.
- [ ] Brand palette tokens (`--felt`, `--chip-gold`, `--suit-red`, `--suit-black`) are defined in `globals.css`. `--felt` and `--chip-gold` are referenced by the logomark; `--suit-red` and `--suit-black` are declared but unused in this spec.
- [ ] `<CardIcon>` renders next to the app title in the side rail and centered above the sign-in card. `src/app/icon.svg` is registered as the favicon and renders in the browser tab.
- [ ] Geist Mono is loaded and exposed via `--font-mono` for future monetary/numeric displays.
- [ ] No hard-refresh form pattern is documented in `docs/15-local-development.md` (or `docs/08-ux-spec.md`) — Server Actions only, `revalidatePath` instead of `router.refresh()` where possible, no `window.location.reload()`.
- [ ] All unit and component tests pass.
- [ ] Manual smoke test (6 steps) passes.
- [ ] `npm run check` passes.
- [ ] Spec conformance review completed.
- [ ] No regressions to sign-in or existing `/sessions` page (which inherits the new shell unchanged in behavior).

## Rollout/deployment notes

- **Vercel:** no env-var or build changes. The new shadcn components and dependencies are checked into the repo (`src/components/ui/*`) and the lockfile.
- **Bookmarks:** none affected — no URL changes.
- **First-time-after-merge experience for in-flight worktrees:** 0005 must rebase onto post-0009 main and accept the new `globals.css` / `layout.tsx` / `status-badge.tsx`. Resolution is mechanical; flagged in the PR body.

## Implementation notes

**Order of operations (suggested):**
1. Run `npx shadcn@latest add dialog sheet dropdown-menu sonner card separator tooltip avatar label` — generates the nine primitives in `src/components/ui/`. (`form` is not available in the `base-nova` style; deferred.)
2. Add brand and status tokens to `globals.css`.
3. Build `<CardIcon>` and add `src/app/icon.svg`. Verify the favicon renders in a browser tab.
4. Add `formatStatus.ts` + tests (TDD) and refresh `<StatusBadge>` to consume it. Verify existing badge tests pass.
5. Build `<AppShell>` + `<Header>` + `<SideRail>` + `<MobileDrawer>` + `<UserMenu>` + `nav-items.ts`. Layer them in. Place `<CardIcon>` next to the app title in `<SideRail>` and `<Header>`.
6. Wire `<AppShell>` into `src/app/(app)/layout.tsx`, remove the inline styles. Verify auth-gating still redirects unauthenticated requests to `/sign-in`.
7. Mount `<Toaster />` in `src/app/layout.tsx`.
8. Add Geist Mono via `next/font/google`, expose `--font-mono`.
9. Restyle `src/app/sign-in/page.tsx` using `<Card>` + the existing button; place `<CardIcon>` centered above the headline.
10. Update `docs/08-ux-spec.md` (small "implemented" note) and `docs/15-local-development.md` (the no-hard-refresh convention).
11. Run the manual smoke test at desktop and at a 360px viewport.

**Color token shape:**

```css
/* globals.css — illustrative, not literal */
:root {
  /* Status (semantic) — used by <StatusBadge> */
  --status-in-progress: oklch(0.72 0.15 155);  /* emerald-ish */
  --status-settling:    oklch(0.78 0.16 75);   /* amber-ish */
  --status-settled:     oklch(0.55 0.02 250);  /* slate-muted */
  --status-archived:    oklch(0.65 0.01 0);    /* neutral */

  /* Brand (poker-themed) — used by logomark, primary CTAs, accents */
  --felt:        oklch(0.42 0.12 155);  /* deep poker-table green */
  --chip-gold:   oklch(0.78 0.13 80);   /* warm gold for accents */
  --suit-red:    oklch(0.55 0.22 25);   /* card-suit red — reserved */
  --suit-black:  oklch(0.20 0.02 250);  /* card-suit near-black — reserved */
}
```

Status and brand tokens are intentionally separate. The badge consumes status tokens via Tailwind `bg-[color-mix(...)]` or arbitrary-value class; pick whichever reads cleaner. Do not hardcode HSL/hex literals in `status-badge.tsx` or in the logomark.

Brand tokens are used sparingly: `--felt` for the logomark fill and the primary button hover state; `--chip-gold` for the suit glyph and focus rings on primary CTAs. `--suit-red` and `--suit-black` are declared now but reserved for future features (e.g., negative-balance display, win/loss rows). Do not apply them to chrome in this spec.

**Card-suit logomark:**

The icon is a rounded-rectangle card outline (~24×32 viewBox) with a centered Lucide `<Spade>` glyph. Two color slots: `stroke`/`fill` of the card frame uses `--felt`; the spade glyph uses `--chip-gold`. The component accepts `size` (default 24) and `className`. The static `src/app/icon.svg` mirrors the artwork with hardcoded equivalents of `--felt` / `--chip-gold` (favicons can't read CSS variables). Keep the two in visual sync — if the brand colors change later, both must update together.

**No-hard-refresh form convention (to document):**
- Forms submit via Server Actions (`<form action={serverAction}>` or `useFormState`), never via `<form action="/api/...">` POSTs.
- Pending states use `useFormStatus()` (in client child components) or `useTransition()` (when the trigger is a non-form button).
- After a successful mutation, the action calls `revalidatePath(path)` or `revalidateTag(tag)`. Do not call `router.refresh()` unless `revalidate*` is structurally impossible.
- Never call `window.location.reload()` or `router.replace(window.location.href)`.
- Modal/dialog dismissal is controlled by React state, not by navigation.
- A linter rule for `window.location.reload()` is desirable but out of scope; manual review enforces it for now.

**`<AppShell>` shape (sketch):**

```tsx
// Server component; renders rail + drawer trigger; children passed as <main>.
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <SideRail user={user} className="hidden md:flex" />
      <Header user={user} className="md:hidden" />  {/* renders the hamburger + MobileDrawer */}
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
```

**Mobile drawer:** use shadcn's `<Sheet side="left">` for the drawer, not `<Dialog>`. Sheet has the swipe/backdrop semantics and slide animation built in via `vaul`.

**Avatar fallback:** initials from `firstName[0]` when no photo URL is available (Firebase Auth users may not have one).

**Why a single `nav-items.ts`?** The rail and the drawer must render the same items in the same order. Centralizing the data eliminates drift. Importing in two places is fine.

## Open questions

1. **Hamburger position on mobile** — left or right of the title? **Recommendation:** left, so the title stays centered; matches iOS / Material conventions. Decide before Accepted.
2. **Should the rail be collapsible to icons-only on desktop?** **Recommendation:** no — premature complexity for an MVP with six items.
3. **Should toasts default to top-right or bottom-right on desktop?** **Recommendation:** bottom-right; less likely to conflict with the future header CTA. shadcn's default `<Toaster />` position works.
4. **Do we want a Geist Mono usage in this spec, or save it until a feature actually displays money?** **Recommendation:** load the font now (zero-cost; `next/font` is build-time), but don't apply it anywhere yet. Future specs opt in via `font-mono`.
5. **Suit choice for the logomark — spade, club, heart, or diamond?** **Recommendation:** spade. Strongest silhouette at favicon sizes (16×16) and reads as "poker" without color (a red heart at favicon scale on a light browser tab is muddy). Decide before Accepted.
6. **Should the brand palette be exposed as Tailwind theme colors (e.g., `bg-felt`) or only as CSS custom properties referenced via arbitrary values (`bg-[var(--felt)]`)?** **Recommendation:** add them to the Tailwind theme so consumers can write `bg-felt` / `text-chip-gold`. shadcn's existing token-extension pattern in `tailwind.config` supports this without ceremony.

## Links

- `docs/08-ux-spec.md` — navigation model, screens, design system declaration
- `docs/01-user-flows.md` — flows the shell wraps
- `docs/12-mvp-scope.md` — MVP scope (mobile-first; no dark mode)
- `docs/15-local-development.md` — to be updated with the form convention
- `specs/changes/0004-sessions-index-page.md` — the spec that initialized shadcn
- `specs/changes/0005-create-session.md` — in-flight; coordinates on rebase

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Brand palette + card-suit logomark added; ready to implement |

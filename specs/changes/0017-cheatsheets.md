# Change 0017: Hand-rankings cheatsheet + how-to-play guide, AppShell top-right icons, mobile sheet color fix

## Status

Implemented

## Owner

Michi Kono

## Goal

Give first-time poker players two on-demand help references: a *Hand rankings* **cheatsheet** (10 hands, strongest → weakest, with generated SVG visuals, 7-card NL Hold'em odds, and a one-line explanation each) and a *How to play* **guide** (NL Texas Hold'em rules: blinds, dealer rotation, action order, betting, min-raise, all-in, showdown, joining mid-game — written for first-timers, not as a memory aid). Both are accessed from icon buttons in the AppShell's top-right corner and rendered in a reusable full-screen mobile-friendly help modal. Bundle one small UI fix that surfaced while reading the same code surface: the mobile side-menu's white-on-white text bug.

Terminology used throughout this spec:

- **cheatsheet** — quick visual reference for users who already know how to play (here: the hand rankings).
- **guide** — newbie-friendly explanation for users who do *not* yet know how to play (here: how to play).
- **help modal** — the shared full-screen UI primitive that hosts either kind of content.

## Context

This app's primary users are casual home-game players. Non-regulars frequently sit down without a confident grasp of either hand strengths or the basic flow of NL Hold'em (blinds, action order, min-raise, showdown). Asking the table mid-hand is awkward and slows the game.

This content exists everywhere on the internet but nowhere in this app. Adding two compact, mobile-first references — one for *what beats what*, one for *how a hand actually plays out* — gives a player a 30-second self-serve answer without leaving the session.

Both pieces are scoped to no-limit Texas Hold'em cash play (the only game this app supports). Variants (Omaha, tournament structure, fixed-limit, pot-limit, mixed games) are explicitly out of scope.

The mobile side-menu bug: in the mobile sheet (`src/components/layout/header.tsx`), `<SheetContent>` inherits the default `bg-popover text-popover-foreground` styling from the shared `Sheet` primitive, but the nav links inside use `text-sidebar-foreground` (near-white). In light mode the popover background is also near-white, producing white-on-white text. The fix is one className on the SheetContent — bundled here because we're touching the same surface for the new top-right icons.

## User-visible behavior

After this change, on every page:

- **Top-right of the screen** shows two compact buttons, each with an icon next to a short text label:
  - 🏆 **Hand rankings** — `lucide-react` `Trophy` icon + label `"Rankings"`.
  - 📖 **How to play** — `lucide-react` `BookOpen` icon + label `"Rules"`.
  - Short labels ("Rankings" / "Rules") are used to fit on mobile alongside the existing hamburger and brand. The full descriptive title is in `aria-label` (`"Hand rankings"` / `"How to play"`) and in the modal's header for screen readers and ambiguity-free desktop UX.
- Tapping either opens a full-screen modal (mobile-first):
  - Modal occupies the full viewport on phones.
  - Body scrolls; a Close button is fixed at the bottom of the modal, visible at every scroll position. The body has bottom padding equal to the close button's height so the last paragraph can scroll fully into view above the button.
  - On desktop the modal caps at a comfortable max-width (e.g., `max-w-2xl`) but still fills the viewport vertically.
- **Hand rankings cheatsheet** lists the 10 hands strongest → weakest, each with:
  - A generated SVG image of an example 5-card hand.
  - The hand's name.
  - The 7-card Hold'em probability of *exactly this rank* at showdown (e.g., "Royal flush — 1 in 30,940 (0.0032%)").
  - A one- or two-sentence plain-English explanation (e.g., for *full house*: "Three of one rank and two of another. Higher trip wins; if those tie, higher pair.").
- **How to play guide** is **for someone who has never played** — written for first-timers, not as a memory aid. Two non-negotiable rules govern the prose:
  1. **Plain English first; jargon parenthetically.** Every poker term is introduced via the everyday word, with the term-of-art clarified in parens the first time. Examples: "the two cards each player gets face-down (their *hole cards*)", "the player who put in the last bet on the final card (the *river*)", "the forced bets posted by the two players sitting clockwise from the dealer (the *small blind* and *big blind*, often shortened to *SB* and *BB*)". After the first introduction the term may be used freely.
  2. **Worked examples, expandable.** Several sections include a "Show me an example" toggle. Click expands a short worked scenario inline; collapsed by default to keep the page scan-able. Implemented with the native `<details>`/`<summary>` HTML element (no JS state, accessible, keyboard-friendly). Examples are *required* in the sections marked **(Example)** below; others may add them at the implementer's discretion.

  Sections (this is the structural outline — final prose authored during track 5, but each section's example content is fixed here):
  - **What the game is, in one sentence.** "Each player tries to make the best 5-card poker hand using any combination of their own 2 face-down cards plus 5 shared face-up cards on the table."
  - **The goal of a hand. (Example)** Explain "best 5-card hand" with a worked example: *Your two cards: A♥ K♥. The five shared cards: A♠ K♣ 7♦ 4♣ 2♥. You have 7 cards available; you pick the best 5: the two aces, the two kings, and the 7. That's "two pair, aces and kings". The 4 and the 2 are ignored.*
  - **Who deals; the button.** Explain that someone shuffles and deals each hand. A small "dealer button" puck moves to the next player clockwise after each hand — that player is "the dealer" for accounting purposes (where the blinds and action start), even if one designated person is physically dealing the cards.
  - **Forced bets — the blinds.** The two players directly clockwise from the dealer button are required to put in money before any cards are dealt: the *small blind* and the *big blind* (often called "SB" and "BB"). The big blind is double the small blind. These forced bets give everyone a reason to play. Inline SVG diagram: a round table with six seats, a "D" puck on one, "SB" and "BB" labels on the next two clockwise, and a clockwise arrow.
  - **The deal.** Each player is dealt 2 cards face-down — their *hole cards*. Only that player sees them.
  - **The four rounds of betting (the *streets*). (Example)**
    - **Pre-flop** — before any shared cards are revealed. Action starts with the player to the left of the big blind (sometimes called *under the gun* or UTG). Each player, in clockwise order, can fold, call (match the big blind), or raise.
    - **Flop** — three shared cards (the *community cards*) are dealt face-up in the middle. A new betting round begins, this time starting from the first player still in the hand to the left of the dealer button.
    - **Turn** — a 4th community card is dealt. Another betting round.
    - **River** — a 5th community card is dealt. Final betting round.
    - **Show me an example:** *Pre-flop, you check your hole cards (A♥ K♥) and call the BB. Flop comes A♠ 7♦ 4♣ — you bet, opponent calls. Turn is K♣ — you bet, opponent calls. River is 2♥ — you bet, opponent folds. You win the pot without showing your hand.*
  - **What you can do on your turn — the betting actions.** Explained one at a time, each with a one-line plain definition:
    - **Fold** — give up your cards and exit this hand. You lose anything you've already put in. You stop being part of this hand.
    - **Check** — pass. You only have this option when nobody has put a bet in front of you yet this round.
    - **Call** — match the current bet to stay in the hand.
    - **Bet** — be the first this round to put money in. (You can only "bet" if no one else has yet.)
    - **Raise** — increase a bet that's already there.
    - **All-in** — push every chip you have. Available any time; covered in its own section below.
  - **How big can you bet? (No-limit.)** "No-limit" means there's no cap on bet size other than the chips in front of you. You can bet 1 chip, the size of the pot, or everything you have, in any betting round.
  - **Minimum raise. (Example)** A raise has to be *at least* the size of the most recent bet or raise. The first raise pre-flop has to be at least double the big blind. **Show me an example:** *BB is $2. The first player to act raises to $6 (raise size: $4). The next person who wants to re-raise must raise by at least $4 more — to $10 or higher.*
  - **All-in &amp; side pots. (Example)** When you bet all your chips, you're "all-in". You can still win the part of the pot you put chips into, but if other players keep betting beyond your stack, that extra money goes into a *side pot* you're not eligible for. **Show me an example:** *Three players all-in. Player A has $50, player B has $100, player C has $200. The first $50 from each player goes into the main pot ($150) — A can win it. The next $50 from B and C goes into side pot 1 ($100) — only B or C can win it. C's last $100 has nothing to call, so it's returned uncalled.*
  - **Showdown — who wins. (Example)** If two or more players are still in after the river's betting round, they show their cards. The last player who put in a bet or raise on the river shows first; if no one bet on the river (everyone checked), the first remaining player to the dealer's left shows first. Best 5-card hand wins. **Show me an example:** *On the river, you bet $20, opponent calls. You show first (you were the last aggressor): A♥ K♥ giving you two pair, aces and kings. Opponent shows 8♠ 8♣ giving them three eights ("three of a kind"). Three of a kind beats two pair — opponent wins.*
  - **Buying in.** When you sit down, you put cash into chips. There's no fixed minimum or maximum at this table — players agree on a sensible buy-in on the spot (a typical home-game starter is ~50× the big blind, but it's flexible). You can re-buy or top off any time.
  - **Joining the table mid-game. (Example)** If you arrive after a hand has started, you wait for that hand to finish. Then you have two choices: post an amount equal to the big blind to start receiving cards on the very next hand, or wait until the big blind position rotates around to your seat (then you're dealt in for free starting that hand). **Show me an example:** *You sit down. The hand in progress finishes. The big blind (BB) is currently in seat 3, and you're in seat 6. If BB is $2, you can either pay $2 right now and play the next hand, or sit out 3 hands until the BB rotates to your seat 6, and then you're in.*
- **Mobile side-menu** (the slide-out sheet behind the hamburger): nav-link text is now legible. No layout change — only the sheet's background and text colors.

User-menu (avatar + name + Log out) remains accessible via the side rail on desktop and via Zone 4 of the slide-out sheet on mobile. The mobile header's right-side avatar button is replaced by the two help icons.

Session-view's existing action buttons (Settle up, Roll back, Archive, Unarchive) are **unchanged** — they stay where they are today, in the session header.

## Non-goals

- Strategy content. No starting-hand charts, pot odds, ranges, position theory, bluffing tips. Both help pages cover *rules* only.
- Other poker variants. NL Texas Hold'em only.
- Tournament-specific concepts (antes, levels, ICM).
- Per-session blind values inside the guide. Blinds vary per session; the guide teaches the *concept* without dollar amounts.
- Straddles. Not allowed at this table; not mentioned in the guide to avoid implying they are.
- Internationalisation. English copy only.
- Animations beyond the existing modal open/close transition.
- Persisting "user has read the help" or analytics on help-modal opens.
- Replacing the existing Dialog primitive globally — the new modal coexists with `<Dialog>` for cases (Settle up, Archive confirm, etc.) where centred dialogs are still right.

## Data model impact

None. No Firestore schema changes, no new fields, no migrations.

## Diagram impact

None in `/docs`. The blinds diagram inside the *How to play* guide is rendered inline as an SVG by the React component — it isn't a `/docs` mermaid diagram.

## API impact

None. No server actions added, removed, or changed.

## Security/privacy impact

None. Static content only; no user data read or written; no new external network calls; no new dependencies that touch credentials.

## Local development impact

One new npm script:

- `npm run gen:hand-rankings` — runs `scripts/generate-hand-svgs.mjs` to (re)generate the 10 hand SVGs into `public/help/hand-rankings/`. The script is idempotent: same hand-data → same SVG bytes. Outputs are committed to git.

No new env vars, no new runtime dependencies, no setup steps changed. Documented in `docs/15-local-development.md` under the "Commands" table.

## Quality gates


| Gate           | Command                 | Required for completion                   | Required for merge | Status |
| -------------- | ----------------------- | ----------------------------------------- | ------------------ | ------ |
| Format         | `npm run format:check`  | Yes                                       | Yes                |        |
| Lint           | `npm run lint`          | Yes                                       | Yes                |        |
| Typecheck      | `npm run type-check`    | Yes                                       | Yes                |        |
| Unit tests     | `npm test`              | Yes                                       | Yes                |        |
| Emulator tests | `npm run test:emulator` | Yes (data-layer changes only — none here) | Yes                |        |
| Build          | `npm run build`         | Yes                                       | Yes                |        |
| E2E smoke      | `npm run test:e2e`      | Yes                                       | Yes                |        |
| Aggregate      | `npm run check`         | Yes                                       | Yes                |        |


No gates added or removed.

## Tracks

This spec is delivered as **five small PRs**. All five required for `Implemented`. Order is a preference, not a dependency graph — implementers may parallelise the leaf tracks.

### Track 1 — Hand data + SVG generation

The static foundation everything else builds on.

- Create `src/lib/help/hand-rankings-data.ts` with a typed `HAND_RANKINGS` array of 10 entries, strongest → weakest. Each entry: `{ rank: HandRank, name: string, oddsLabel: string, oddsHumanReadable: string, explanation: string, svgPath: string }`. `HandRank` is a string-literal union (`"royal-flush" | "straight-flush" | …`).
- Create `scripts/generate-hand-svgs.mjs`. Hardcodes the 10 example hands (a `[Card, Card, Card, Card, Card]` per hand), renders each as a 5-card horizontal SVG, writes to `public/help/hand-rankings/{rank}.svg`. Idempotent. The script is standalone Node.js (no TypeScript runtime needed; project doesn't currently ship `tsx`).
- Card visual: rounded white background with subtle border and shadow, rank in top-left and bottom-right corners (mirrored), large suit symbol centred. Hearts/diamonds in red (`#c4263a`), spades/clubs in black. Cards overlap by ~30% so all 5 fit in roughly a 4× single-card width.
- Add `npm run gen:hand-rankings` script to `package.json`. Run it once during this track's PR; commit the 10 generated SVGs.
- Tests: unit tests for `HAND_RANKINGS` invariants — exactly 10 entries, slugs unique, ordered strongest → weakest, every `svgPath` resolves under `public/help/hand-rankings/` (existence check via Node `fs`).

### Track 2 — `HelpModal` component + mobile sheet color fix

Two related changes to the same UI layer.

- Create `src/components/help/help-modal.tsx` — a wrapper around the existing `Dialog` primitive that:
  - Caps width at `max-w-2xl` on `md:` breakpoints; full viewport otherwise (`h-svh w-screen` mobile).
  - Renders header (title prop) + scrollable body (`overflow-y-auto p-4 pb-20`) + bottom-anchored close button (`absolute bottom-0 inset-x-0 p-4 bg-background/85 backdrop-blur-sm border-t`).
  - The `pb-20` on the body guarantees the last paragraph can scroll above the close button.
  - Close button: `<Button className="w-full" variant="default">Close</Button>`. Clicking calls the `onOpenChange(false)` callback.
- Fix `src/components/layout/header.tsx`'s `<SheetContent side="left" …>` className to add `bg-sidebar text-sidebar-foreground` (matches the desktop side rail). Also fix the `<Suspense fallback>` link inside the same sheet to use the same `text-sidebar-foreground/75` / `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` classes the in-Suspense `<NavLink>` already uses, so the brief flicker during navigation doesn't revert to the broken colors.
- Tests: render-test for `HelpModal` open/close, that close button is reachable, that body has the bottom padding class (snapshot on the body element's className). Render-test for the mobile sheet asserts `bg-sidebar` is present on the SheetContent.

### Track 3 — AppShell top-right buttons

Wire the icon buttons into the shell, on every page.

- Create `src/components/layout/help-buttons.tsx` exporting a `<HelpButtons>` client component that renders two icon-plus-label buttons (`<Button size="sm" variant="ghost">` with `Trophy`/`BookOpen` icons followed by short text labels `Rankings` / `Rules`), tracks `open` state for each, and renders the corresponding `<HandRankingsCheatsheet>` / `<HowToPlayGuide>` as a sibling. Both are dynamically imported (`next/dynamic`, `ssr: false`) so the help content (~1 KB of SVG references + prose) doesn't ship in the AppShell bundle until needed.
- On mobile, drop the "Poker Ledger" *text* from the brand link in `<Header>` (keep the `<CardIcon>` glyph). Two icon-plus-label buttons in the right-hand slot need the horizontal space; the brand glyph alone is unambiguous next to the hamburger menu. Desktop is unaffected — brand text lives in the side rail.
- Modify `src/components/layout/header.tsx`: replace the right-side `<UserMenu />` element with `<HelpButtons />`. The hamburger sheet's Zone 4 already contains `<UserMenu />`, so logout remains reachable via the menu.
- Modify `src/components/layout/app-shell.tsx`: on `md:` and up, render a thin `~h-12` top bar inside the `<main>` flex column, right-aligned, containing `<HelpButtons />`. Below it, the existing `{children}`. The bar uses `border-b` to separate from the page content. Mobile already has the buttons inside `<Header />`.
- Tests: render-test for `HelpButtons` clicks open the corresponding modal. Render-test for `Header` confirms `<UserMenu />` is no longer in the right-side slot but `<HelpButtons />` is. Render-test for `AppShell` confirms the desktop top bar contains the buttons; mobile path doesn't.

### Track 4 — Hand rankings cheatsheet

The hand-rankings cheatsheet's content.

- Create `src/components/help/hand-rankings.tsx` exporting `<HandRankingsCheatsheet open onOpenChange>` that wraps `<HelpModal>` with title "Hand rankings (Texas Hold'em)" and renders the 10-row body.
- Each row shows the SVG image (`<img src={svgPath} alt={`${name} example`} />`), name (heading), odds label, and explanation. Layout: `flex` row on `md:`, `flex-col` on mobile.
- Add a short header note above the list: "From strongest to weakest. Odds are the chance you'll make exactly this rank by the river in a 7-card Texas Hold'em hand."
- Tests: render-test that all 10 hand names appear in strongest → weakest order; each `<img>` has alt text; the modal opens.

### Track 5 — How to play guide

The *How to play* guide's content + the inline blinds diagram.

- Create `src/components/help/how-to-play.tsx` exporting `<HowToPlayGuide open onOpenChange>` that wraps `<HelpModal>` with title "How to play (No-Limit Texas Hold'em)" and renders the newbie-friendly prose described under *User-visible behavior*.
- **Terminology rule:** every poker term-of-art is introduced via the everyday word with the term in parens the first time it appears (e.g., "the two cards each player gets face-down (their *hole cards*)"). This is enforced by code review, not by tests — but a single rendered-text smoke check asserts that the strings "hole cards", "the river", "small blind", and "big blind" each appear at least once, so we don't accidentally ship a draft where a key term was renamed but its first-introduction-in-parens was lost.
- **Worked-example component.** Create a small `<HowToPlayExample>` (or just inline `<details>`/`<summary>`) used in the sections marked *(Example)* in the user-visible-behavior outline:
  - **Goal of a hand** — best-5-of-7 worked example.
  - **Streets** — pre-flop / flop / turn / river walked through one hand.
  - **Min raise** — pre-flop $4 raise example.
  - **All-in &amp; side pots** — three-player different-stack example.
  - **Showdown** — last-aggressor-shows-first example.
  - **Joining mid-game** — post-the-BB vs wait-for-the-BB example.
  - Use the native `<details>`/`<summary>` HTML element (zero JS state, accessible, works without React hydration). Style the summary as a small button-like row with an "expand" caret. Five examples is enough — don't add more "for completeness".
- Inline a small SVG diagram in the *Forced bets* section: a circle representing the table, six dots for seats, a labelled "D" puck for the dealer button, "SB" and "BB" labels on the next two clockwise seats, and a clockwise arrow indicating action order. Authored directly in the component (no need to add to the generated-SVG pipeline; it's a one-off illustration).
- Use semantic structure: `<h2>` for sections, `<p>` for prose, `<ul>` where lists make sense (betting actions). Aim for ~50–65 character line length on mobile (use `max-w-prose` or similar). The total scroll length is going to be substantial — that's fine, the modal scrolls.
- Tests:
  - render-test asserts all section headings appear and the "hole cards", "the river", "small blind", "big blind" strings render somewhere (jargon-introduction smoke check).
  - render-test confirms each `(Example)` section has a `<details>` element collapsed by default; clicking the `<summary>` reveals the example content.
  - render-test confirms the blinds diagram renders with an accessible `<title>` like "Dealer, small blind, and big blind".

## Test plan

By file, post-change:


| File                                     | Tests added                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/help/hand-rankings-data.ts`     | unit: 10 entries, ordered, unique slugs, every SVG file exists under `public/help/hand-rankings/`                                                                                                                                                                                      |
| `src/components/help/help-modal.tsx`     | unit: open/close, body has `pb-20`, close button is reachable                                                                                                                                                                                                                          |
| `src/components/help/hand-rankings.tsx`  | unit: all 10 names appear in order, alt text present                                                                                                                                                                                                                                   |
| `src/components/help/how-to-play.tsx`    | unit: section headings present; jargon-introduction smoke check (`hole cards`, `the river`, `small blind`, `big blind` all rendered); each `(Example)` section has a `<details>` element; clicking each `<summary>` reveals its example content; blinds diagram has identifiable title |
| `src/components/layout/help-buttons.tsx` | unit: clicking each button opens the right modal                                                                                                                                                                                                                                       |
| `src/components/layout/header.tsx`       | unit: right-side slot is `<HelpButtons />`, not `<UserMenu />`; SheetContent has sidebar bg                                                                                                                                                                                            |
| `src/components/layout/app-shell.tsx`    | unit: desktop top bar contains `<HelpButtons />`; mobile path doesn't                                                                                                                                                                                                                  |
| `scripts/generate-hand-svgs.mjs`         | not unit-tested directly; tested transitively by the file-existence assertions in `hand-data.test.ts` and by visual review of the committed SVGs                                                                                                                                       |


E2E: existing `e2e/smoke.spec.ts` keeps passing (help buttons render but unauth users still redirect to `/sign-in`). No new E2E case added — visual review covers the help content.

TDD applies to the React components (write the open/close test first, then the body). The SVG generator is a one-off; manual visual review is the gate, not a unit test.

## Acceptance criteria

Track 1:

- [ ] `src/lib/help/hand-rankings-data.ts` exports `HAND_RANKINGS` with 10 entries, strongest → weakest.
- [ ] `scripts/generate-hand-svgs.mjs` exists; `npm run gen:hand-rankings` regenerates the 10 SVGs deterministically.
- [ ] `public/help/hand-rankings/*.svg` — 10 files committed.
- [ ] Re-running the generator produces no diff (idempotency check).
- [ ] Unit tests for `HAND_RANKINGS` invariants pass.

Track 2:

- [ ] `src/components/help/help-modal.tsx` exists.
- [ ] Modal body has `pb-20` (or equivalent — the value is whatever guarantees the close button can't cover the last line).
- [ ] Close button is positioned at the bottom and visible at every scroll position; its background includes a backdrop blur or semi-opaque fill so content scrolling underneath is muted but readable.
- [ ] `src/components/layout/header.tsx`'s `<SheetContent>` has `bg-sidebar text-sidebar-foreground`. The `<Suspense fallback>` link uses `text-sidebar-foreground/75` and the matching hover classes.
- [ ] Manual smoke (light mode, mobile viewport): hamburger menu opens; nav-link text is legible. No regression in dark mode.

Track 3:

- [ ] `src/components/layout/help-buttons.tsx` exists with two icon buttons (Trophy, BookOpen) and `aria-label`s.
- [ ] Mobile header right-side slot is `<HelpButtons />` (no `<UserMenu />`).
- [ ] User-menu / logout is still reachable via the hamburger sheet's Zone 4.
- [ ] On `md:` and up, AppShell renders a thin top bar above page content with right-aligned `<HelpButtons />`.

Track 4:

- [ ] All 10 hand rows render in strongest → weakest order with their SVG, name, odds, explanation.
- [ ] Header note explains the odds are 7-card Hold'em "exactly this rank" probabilities.

Track 5:

- [ ] All sections from the *User-visible behavior* outline render as headings/prose.
- [ ] **Newbie-friendly check.** Every poker term-of-art is introduced via the everyday word with the term in parens the first time (manual review). The four-string smoke test (`hole cards`, `the river`, `small blind`, `big blind`) passes.
- [ ] Each section marked `(Example)` in the outline has an expandable `<details>`/`<summary>` worked example, collapsed by default. Six examples total: best-5-of-7, streets, min raise, side pots, showdown, joining mid-game.
- [ ] Blinds diagram is inline SVG with accessible `<title>`.
- [ ] No mention of straddles, antes, or other variants.

Spec-level:

- [ ] All quality gates pass on every PR.
- [ ] Spec conformance review completed.
- [ ] No regression in existing tests.
- [ ] Visual review of generated SVGs and the live help screens passes (manual).

## Rollout/deployment notes

None. Static content + UI-only changes. Each PR is independently shippable to preview and production via the standard branch → PR → merge workflow. Vercel preview will let us visually review each help screen before merging.

## Implementation notes

Suggested PR order:

1. **Track 1** — hand data + SVG generation. Foundational; everything else references the SVGs.
2. **Track 2** — `HelpModal` + mobile sheet color fix. Blocks tracks 4 and 5 (they consume the modal).
3. **Track 3** — AppShell top-right buttons (entry points wired up; opens placeholder modal until tracks 4–5 land).
4. **Track 4** — Hand rankings cheatsheet content.
5. **Track 5** — How to play guide content.

Pitfalls:

- `**hand-data.ts` typecheck.** Use a `const` assertion + `satisfies readonly HandInfo[]` so TypeScript enforces the union exhaustiveness — adding an 11th hand without updating the rank union is a type error.
- **SVG file size.** Five-card hands at reasonable visual size will be 2–4 KB each. Total ~30 KB committed. Acceptable for a feature that's almost always in the user's mental model. Don't inline as data URIs in JSX — keep them as static files served from `/public` so they're cacheable.
- **Modal close-button overlap.** The `pb-20` on the body matters. Verify on a small mobile viewport (e.g., 360×640) that the last paragraph can be scrolled completely above the close button. Use `min-h-svh` not `min-h-screen` (the latter is broken on iOS Safari with the URL bar visible).
- `**next/dynamic` for help content.** The hand-rankings cheatsheet and how-to-play guide are client-only and ~3–4 KB gzipped each. Lazy-load with `next/dynamic({ ssr: false })` to keep the AppShell bundle lean — every page loads the AppShell.
- **Mobile sheet fix is light-mode-specific.** The bug only manifests in light mode. Verify dark mode still looks right after the className change (sidebar colors are designed for both modes — no regression expected, but check).
- **AppShell top bar must not break the existing Vercel layout.** Render only on `md:` and up. The mobile path renders no extra top bar; the help buttons live inside the existing `<Header>`.
- **Track 3 PRs the buttons before content lands.** Until tracks 4 and 5 ship, the buttons should still open *something* — either a placeholder modal with "coming soon" copy or the buttons should be feature-flagged off. Spec implementer's choice; default to feature-flag (a const `HELP_ENABLED = false` in `help-buttons.tsx`) until tracks 4 and 5 are merged. Cleaner than shipping placeholder copy.

## Open questions

None — all resolved during pre-spec discussion.

## Links

- `specs/changes/0009-ui-design-system.md` — original UI design-system spec; the help modal and top-bar changes follow the established Tailwind variable conventions (`bg-sidebar`, `bg-popover`, etc.).
- `specs/changes/0014-venmo-payment-links-and-player-edits.md` — origin of the existing `<Dialog>` usage patterns; the new `<HelpModal>` extends rather than replaces.
- Wikipedia, *Poker probability* — source of the 7-card Hold'em probabilities used in the *Hand rankings* cheatsheet content.
- `lucide-react` icon library: `Trophy`, `BookOpen` — already a dependency.

## Status history


| Date       | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-07 | Proposed | Initial draft following clarification round (NL Hold'em, no straddles, re-buy any time, 7-card odds, top-right icon buttons, bundled mobile-sheet color fix).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-05-07 | Proposed | Revision after content-feedback pass: rewrote the *How to play* outline as newbie-friendly prose (terminology rule: plain-English first with the term-of-art parenthesised on first use). Added six expandable worked examples (`<details>`/`<summary>`) for the trickier sections; added jargon-introduction smoke test and example-toggle test to track 5's test plan.                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-07 | Proposed | Renamed throughout: the *How to play* content is a **guide**, not a cheatsheet — the term "cheatsheet" now refers only to the hand-rankings reference. Shared infrastructure renamed neutrally: `<CheatsheetModal>` → `<HelpModal>`, `<CheatsheetButtons>` → `<HelpButtons>`, `<HowToPlayCheatsheet>` → `<HowToPlayGuide>`, `src/components/cheatsheets/` → `src/components/help/`, `src/lib/cheatsheets/hand-data.ts` → `src/lib/help/hand-rankings-data.ts`, `public/cheatsheets/hands/` → `public/help/hand-rankings/`, `npm run gen:cheatsheets` → `gen:hand-rankings`, `CHEATSHEETS_ENABLED` flag → `HELP_ENABLED`. `<HandRankingsCheatsheet>` keeps the suffix since that piece *is* a cheatsheet. |
| 2026-05-07 | Accepted    | Approved; implementation begun. |
| 2026-05-08 | Implemented | All five tracks merged: #64 (track 1 — hand data + SVG generation), #65 (track 2 — HelpModal + mobile sheet color fix), #66 (track 3 — AppShell help buttons), #67 (track 4 — hand-rankings cheatsheet content), #68 (track 5 — how-to-play guide content + flipped HELP_ENABLED on). |



# Change 0032: Suppress noImportantStyles lint warnings in the reduced-motion block

## Status
Implemented

## Owner
Michi Kono

## Goal
Clear the four `lint/complexity/noImportantStyles` warnings that `npm run lint` reports in `src/app/globals.css` without weakening the `prefers-reduced-motion` accessibility override, so `npm run lint` is warning-clean.

## Context

`npm run lint` (Biome 2.4.14) reports four `lint/complexity/noImportantStyles` warnings, all in `src/app/globals.css` inside the `@media (prefers-reduced-motion: reduce)` block:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

There are no other lint warnings in the 183 files checked. These `!important` declarations are the canonical accessibility pattern: they must override author-level animation/transition declarations **regardless of specificity** so that a user's OS-level reduced-motion preference is reliably honored. Biome's offered autofix simply removes `!important`, which would silently defeat the accessibility behavior (and contradict the existing code comment).

The correct resolution is therefore to suppress the rule with a documented justification, not to change the CSS behavior.

Relates to: spec `0020-audit-a11y-and-tokens.md` (a11y work), `docs/16-quality-gates.md` (lint gate).

## User-visible behavior

"User" here is twofold:

- **App users** experience no change. The reduced-motion override is byte-for-byte unchanged — motion is still suppressed for users who request reduced motion.
- **Developers / Claude Code** get a warning-clean `npm run lint`, so the lint gate signal is no longer diluted by an intentional, justified pattern.

## Non-goals

- **Removing `!important` from the reduced-motion block.** That is exactly the behavior being preserved; Biome's autofix is explicitly rejected.
- **Disabling `lint/complexity/noImportantStyles` repo-wide** in `biome.json`. The rule stays on everywhere else; only this one accessibility-critical block is suppressed, in place, with a reason.
- **Any other CSS or styling change.**

## Data model impact

None.

## Diagram impact

None. (Lint/CSS-comment change; no domain, data, API, architecture, or user-flow diagram is affected.)

## API impact

None.

## Security/privacy impact

None.

## Local development impact

None. `npm run lint` becomes warning-clean; no setup, env var, or local-only behavior changes.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | Pass |
| Lint | `npm run lint` | Yes | Yes | Pass (0 warnings) |
| Typecheck | `npm run type-check` | Yes | Yes | Pass |
| Unit tests | `npm test` | Yes | Yes | Pass (740) |
| Build | `npm run build` | Yes | Yes | Pass |
| Aggregate | `npm run check` | Yes | Yes | Pass |

## Test plan

No new automated test. The change is a CSS comment-only suppression; its correctness is verified deterministically by the lint gate itself (`npm run lint` must report zero warnings) and by the unchanged reduced-motion declarations (no behavior to unit-test). Manual confirmation: the four declarations and their `!important` flags are untouched.

## Acceptance criteria

- [x] `npm run lint` reports 0 warnings.
- [x] The four reduced-motion declarations retain their `!important` flags (behavior unchanged).
- [x] The suppression carries a justification explaining why `!important` is required.
- [x] `lint/complexity/noImportantStyles` remains enabled repo-wide (no `biome.json` rule change).
- [x] All quality gates pass.

## Rollout/deployment notes

None — CSS comment only. Lands as a normal feature-branch → PR → auto-merge.

## Implementation notes

Wrap the four declarations in a Biome `biome-ignore-start lint/complexity/noImportantStyles: <reason>` / `biome-ignore-end` range with a reason describing the reduced-motion override. A range suppression keeps the justification in one place rather than repeating an ignore comment on each of the four lines.

## Open questions

None.

## Links

- `src/app/globals.css` — the reduced-motion override
- `docs/16-quality-gates.md` — lint gate

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-19 | Proposed | Initial draft — four noImportantStyles warnings in the reduced-motion block; suppress with justification rather than remove !important |
| 2026-06-19 | Accepted | Accepted to implement; autofix (removing !important) rejected as it breaks the accessibility override |
| 2026-06-19 | In Progress | Adding biome-ignore range with justification around the reduced-motion declarations |
| 2026-06-19 | Implemented | biome-ignore range landed; `npm run lint` warning-clean, declarations unchanged; PR #112 |

# Change 0015: React-idiom audit and cleanup

## Status
Proposed

## Owner
Michi Kono

## Goal

Audit the codebase for places where we reach for non-idiomatic React patterns (DOM querying for cross-component coordination, `useEffect` masquerading as event handlers, manual scroll/focus management, local state that duplicates URL state, etc.) and replace them with React-native primitives where doing so improves clarity without changing behaviour.

## Context

While implementing spec 0014 (Venmo payment links), the first cut of the *Add Venmo for {payee}* affordance reached across components by calling `document.querySelector('[data-testid="player-row-X"]')` and synthesising a click on whatever `<button>` happened to be first in the row. The fix that landed in 0014 swapped this for `useImperativeHandle` + a refs map in the parent — the React-native pattern for "imperatively kick a child to do a thing." That swap raised the question: where else are we reaching for non-React patterns when an idiomatic API exists?

This spec is the followup. It is scoped as a code-only audit + targeted refactor; it adds no user-facing features.

## User-visible behavior

None. This change is invisible to end users. Any user-visible regression during the audit is a bug, not an intent.

## Non-goals

- Performance work (Suspense boundaries, memoization tuning, virtualization, bundle splitting).
- Migrating off any libraries (base-ui, sonner, qrcode.react, etc.).
- Architectural rewrites — the goal is local cleanup, not redesign.
- Test rewrites unless a test directly exercises a smell that's being fixed.
- Server-side / Firestore / API code review (this is a client-React audit).

## Audit scope

Patterns to look for in `src/`:

1. **`document.querySelector` / `document.getElementById` in component code.** These usually indicate a missing ref or context. Refs (`useImperativeHandle` for parent-driven imperatives, plain `useRef` for own DOM access) are the answer.
2. **`useEffect` whose dependency array is an event-shaped value** — e.g., a `nonce` counter, a `Date.now()` timestamp, or a boolean flipped on click. These are usually event handlers in disguise. The React docs ("You Might Not Need an Effect") cover this directly.
3. **`useState` that duplicates URL state.** If a piece of state is "what's currently shown / selected / filtered," and it's already in the URL via `useSearchParams`, lifting it out removes a class of sync bugs. Conversely, transient UI state should *not* be in the URL.
4. **Manual `setTimeout` / `requestAnimationFrame` for "do X after render."** Often a `useLayoutEffect` or a ref callback is correct. Sometimes nothing is needed at all and the timeout is papering over a render-order bug.
5. **Mutation of refs inside the render body** (rather than in event handlers or effects). React tolerates this but it's a smell — the render function should be pure.
6. **Cross-component coordination via `data-testid`.** `data-testid` is for tests, not for production navigation. If a production code path queries a `data-testid`, that's the same smell as #1 with extra indirection.
7. **Manual scroll/focus management** that should be `<form>` autofocus, `<a href="#anchor">` + native scroll, or browser-native focus restoration.
8. **`forwardRef` boilerplate that's no longer needed.** This project is on React 19, so `ref` is a regular prop on function components — `forwardRef` is no longer required.

## Approach

1. Grep + manual review of `src/` for each of the above.
2. Produce a punch list (live in this spec or a separate working doc) of findings, each with file:line, the smell, and the proposed React-native replacement.
3. Fix the highest-value items in one or more focused PRs (each small enough to review independently — single-pattern PRs preferred over a mega-refactor).
4. For anything we *intentionally* keep non-idiomatic, add a one-line comment with the *why* so future-us doesn't waste time re-litigating it.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

No new tests are expected from this work; existing tests must continue to pass since user-facing behaviour is unchanged. If a refactor reveals a missing test, add it.

## Test plan

Each refactor PR keeps the existing suite green. Where a refactor changes a component's public API (e.g., `forwardRef` → `ref` prop), update the component's tests to use the new API. No new behavioural tests are required.

## Acceptance criteria

- [ ] Punch list produced (in this spec or a working doc), covering at minimum the 8 patterns above.
- [ ] Each finding either resolved in a follow-up PR or explicitly justified to remain (with a one-line comment in the code).
- [ ] No behavioural regressions detected by the existing test suite.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

None. Code-only refactor; no env vars, no migrations, no feature flags.

## Implementation notes

- This spec can be split across multiple PRs, one per pattern — preferred over a single mega-PR.
- The audit is **non-exhaustive by design.** If something doesn't surface during grep + read, it's fine to defer.
- If an idiomatic React API doesn't exist for what we're trying to do, that's a useful signal — the abstraction may be off.

Suggested initial grep queries (not exhaustive):

```sh
grep -rn "document\.querySelector\|document\.getElementById" src/
grep -rn "forwardRef" src/
grep -rn "data-testid" src/ | grep -v "\.test\."
grep -rn "useEffect" src/ | wc -l   # not a smell on its own — manual review the body
grep -rn "setTimeout\|requestAnimationFrame" src/
grep -rn "useSearchParams\|useState" src/   # cross-reference for duplication
```

## Open questions

1. **One mega-PR or one-per-pattern?** Recommendation: one-per-pattern, per the project's "small reviewable PRs" rule. Mega-PRs are explicitly discouraged in `CLAUDE.md`.
2. **Do we adopt a lint rule to prevent regressions?** `eslint-plugin-react-hooks` covers some of these (exhaustive deps); `react/no-direct-mutation-state` is gone in modern React. There isn't a great lint rule for "this useEffect should be an event handler" — that one stays a code-review responsibility.

## Links

- `specs/changes/0014-venmo-payment-links-and-player-edits.md` — the spec where the original DOM-query smell surfaced.
- React docs: ["You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect)
- React docs: ["Manipulating the DOM with Refs"](https://react.dev/learn/manipulating-the-dom-with-refs)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-04 | Proposed | Spawned out of 0014 implementation review |

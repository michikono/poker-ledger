# Change 0037: Stop the auth gate from redirecting the Firebase OAuth handler

## Status
Implemented

## Owner
michikono

## Goal

Fix the sign-in loop by exempting Firebase's reserved `/__/` OAuth paths from
the auth middleware so the same-origin handler can actually load.

## Context

ADR 0011 / spec 0035 moved `authDomain` to the app's own host and added
`next.config.ts` rewrites proxying `/__/auth/*` and `/__/firebase/*` to
`<project>.firebaseapp.com`. Spec 0036 then completed the redirect flow
(`getRedirectResult`, `SameSite=Lax`).

Both missed the actual regression: the auth middleware (`src/proxy.ts`) gates
**every** path except `/sign-in` via its matcher
`/((?!_next/static|_next/image|favicon.ico|.*\.png$).*)`. That matcher matches
`/__/auth/handler`. During sign-in there is no `session` cookie yet, so the
middleware redirects the OAuth handler to `/sign-in` **before** the rewrite can
proxy it. The handler never runs, the sign-in page reloads, and it loops — on
desktop and mobile alike. It only appeared after spec 0035 because previously
the handler lived on `firebaseapp.com`, which our middleware never saw.

Symptom reported: repeated Google-login popups/pages, "nothing works".

## User-visible behavior

- Google Sign-In completes instead of looping — the OAuth handler loads,
  returns to the app, the session cookie is set, and the user lands on their
  destination. Applies to the popup and the redirect fallback (spec 0036).

## Non-goals

- No change to what the rewrites do (spec 0035) or to the redirect-completion
  logic / cookie attributes (spec 0036).
- No change to auth enforcement for any real app route — only Firebase's
  reserved `/__/` prefix is exempted.
- Preview-deploy authorization limitations (ADR 0011) are unchanged.

## Data model impact

None.

## Diagram impact

None. `docs/03` component diagram already shows the proxy gate; the auth-flow
prose gains a note that `/__/` is exempt.

## API impact

None. Behavioral change is limited to which paths the middleware matcher runs
on.

## Security/privacy impact

Exempting `/__/` from the gate does not expose app data: those paths are not app
routes — they are Firebase's OAuth handler surface, already proxied to
`firebaseapp.com`. Read authorization for real routes is unchanged (layout RSC
still verifies the session cookie); mutation authorization is unchanged (Server
Actions still verify a fresh ID token). See ADR 0003.

## Local development impact

None. On demo/emulator projects `authDomain` stays at the env value and the
`/__/` paths are never used, so the exemption is inert.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Production sign-in smoke | Manual (post-deploy) | No (cannot run pre-merge) | No | |
| Aggregate | `npm run check` | Yes | Yes | |

The end-to-end OAuth flow cannot be exercised in CI/local (emulator never uses
the `firebaseapp.com` handler); it is a manual post-deploy smoke test.

## Test plan

Unit tests in `src/proxy.test.ts`:
- `isPublicPath("/__/auth/handler")` and `isPublicPath("/__/firebase/init.json")`
  return `true`.
- `proxy(<request for /__/auth/handler, no session cookie>)` does **not** return
  a 307 redirect (regression lock for the loop).
- The `config.matcher` regex does **not** match `/__/auth/handler`,
  `/__/auth/iframe`, `/__/firebase/init.json`, but still matches `/sessions`
  and `/sign-in`.

## Acceptance criteria

- [ ] `src/proxy.ts` exempts `/__/` reserved paths from the auth gate (matcher
      exclusion + `isPublicPath`).
- [ ] The OAuth handler is no longer redirected to `/sign-in` during sign-in.
- [ ] Unit tests cover the matcher exclusion and the non-redirect behavior.
- [ ] Existing proxy behavior for real routes and `/sign-in` is unchanged.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.
- [ ] Relevant docs updated.

## Rollout/deployment notes

Deploy from `main`, then run the manual sign-in smoke test on desktop and phone.
No console/env changes required (the ADR 0011 Authorized-domain / redirect-URI
setup already applies).

## Implementation notes

- Firebase reserves the entire `/__/` prefix; matching `__/` in the matcher's
  negative lookahead is safe (no app route uses it).
- Keep the `isPublicPath` exemption too as defense-in-depth in case the matcher
  is edited later.

## Open questions

None.

## Links

- `specs/decisions/0011-self-hosted-auth-handler.md` — same-origin handler
- `specs/changes/0035-mobile-auth-same-origin-handler.md` — authDomain + rewrites
- `specs/changes/0036-mobile-login-redirect-completion.md` — redirect completion
- `docs/03-architecture.md` — Auth flow (canonical)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft |
| 2026-07-08 | Accepted | Hotfix for production sign-in loop; owner requested fix |
| 2026-07-08 | Implemented | Merged via PR for claude/mobile-auth-sessionstorage-r64ill |

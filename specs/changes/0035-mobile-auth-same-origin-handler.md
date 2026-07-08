# Change 0035: Mobile Google Sign-In — same-origin auth handler

## Status
Implemented

## Owner
michikono

## Goal

Fix the "missing initial state" error that blocks Google Sign-In on mobile by
serving the Firebase auth handler same-origin with the app.

## Context

On mobile, sign-in fails at
`https://poker-ledger-8d3bc.firebaseapp.com/__/auth/handler` with:

> Unable to process request due to missing initial state. This may happen if
> browser sessionStorage is inaccessible or accidentally cleared.

Root cause and remedy are recorded in ADR 0011. In short: the SDK's OAuth
helper is served from `authDomain` (`*.firebaseapp.com`), a different origin
from the `*.vercel.app` app, so the `sessionStorage` nonce it writes before the
redirect is third-party and gets partitioned away on mobile browsers. Desktop
is permissive, so it only breaks on phones — the app's primary device class.

## User-visible behavior

- On a phone, tapping "Continue with Google" completes sign-in and lands the
  user on their destination (`/sessions` or the `from` path) — no
  "missing initial state" error.
- Desktop sign-in continues to work unchanged.
- Local development (Firebase emulator) sign-in continues to work unchanged.

## Non-goals

- Adopting a custom domain (deferred — see ADR 0011 alternatives).
- Making **preview** deployments' sign-in work automatically. Preview
  subdomains still require per-host authorization; this change targets the
  production origin. (Documented limitation, not a regression — previews have
  the same cross-origin issue today.)
- Any change to the session-cookie, Server Action verification, or sign-out
  flows (ADR 0003 auth model is untouched).
- Changing the auth provider or adding new sign-in methods.

## Data model impact

None.

## Diagram impact

`docs/03-architecture.md` — Auth flow prose (step 1, "Sign-in") gains a note
that the OAuth handler is served same-origin via rewrites. The component
diagram's `FirebaseAuth` boundary is unchanged (still the same service), so no
mermaid edit is required; prose note only.

## API impact

No application API changes. Adds two infrastructure **rewrites** (not routes)
in `next.config.ts`:

- `/__/auth/:path*` → `https://<project>.firebaseapp.com/__/auth/:path*`
- `/__/firebase/:path*` → `https://<project>.firebaseapp.com/__/firebase/:path*`

Destination host is derived from `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` so the
Firebase project id lives in exactly one place.

## Security/privacy impact

- Auth-relevant but does not weaken any control. The OAuth exchange still
  terminates at Firebase's real handler code (proxied), ID-token verification
  (ADR 0003 layers 2–4) is unchanged. No new secrets; `authDomain` and the
  Firebase project id are already public (`NEXT_PUBLIC_*`).
- New requirement: each origin used as `authDomain` must be an Authorized
  Domain in Firebase and an authorized redirect URI on the Google OAuth client.
  This is a console/config step (see Rollout), not a code change.

## Local development impact

None for the developer flow. On `demo-*` projects the client keeps using the
env `authDomain` and the Auth emulator, so the rewrites are never exercised
locally. `docs/15-local-development.md` and `.env.local.example` get a short
note that `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is the SSR/emulator fallback and
that the browser uses its own host for real projects.

## Quality gates

Required gates for this change:

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run typecheck` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (emulator sign-in) | Yes | Yes | |
| Production mobile smoke | Manual (post-console-config) | No (can't run pre-merge) | No | |
| Aggregate | `npm run check` | Yes | Yes | |

The production mobile smoke test cannot run in CI/local (emulator never hits
the handler). It is a post-deploy manual verification once the Authorized
Domains / redirect-URI console changes are applied.

## Test plan

TDD for the one piece of pure logic:

- `resolveAuthDomain(envAuthDomain, host, isDemoProject)` in
  `src/lib/firebase/auth-domain.ts` (new). Unit tests (`auth-domain.test.ts`):
  - real project + browser host `"poker-ledger.vercel.app"` → returns that host
  - real project + preview host `"poker-ledger-git-x.vercel.app"` → that host
  - demo project → returns `envAuthDomain` (emulator path untouched)
  - `host` undefined (SSR, no `window`) → returns `envAuthDomain`
  - empty/missing env with real project + host → returns host

- `authHandlerRewrites(envAuthDomain)` helper (co-located, e.g.
  `src/lib/firebase/auth-domain.ts`) used by `next.config.ts`. Unit tests:
  - given `"poker-ledger-8d3bc.firebaseapp.com"` → two rewrites with correct
    `source`/`destination` pointing at that host
  - trailing normalization / exactly two entries

`sign-in-form.tsx` is unchanged (still `signInWithPopup`), so its existing
tests remain valid. Wiring `getClientApp` to `resolveAuthDomain` is covered by
the pure-function tests plus typecheck/build; the browser-host branch is
exercised manually in the smoke tests.

## Acceptance criteria

- [ ] `resolveAuthDomain` returns the current browser host for real projects
      and the env fallback for demo/SSR, with unit tests covering each branch.
- [ ] `src/lib/firebase/client.ts` initializes the SDK with the resolved
      `authDomain`.
- [ ] `next.config.ts` proxies `/__/auth/:path*` and `/__/firebase/:path*` to
      the project's `firebaseapp.com` host, derived from the env var.
- [ ] Demo/emulator sign-in still works locally (smoke test).
- [ ] Desktop production sign-in path unaffected (no change to popup flow).
- [ ] Docs updated: ADR 0011 linked from `docs/03-architecture.md` auth flow;
      `.env.local.example` + `docs/15` note the fallback semantics.
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.
- [ ] Relevant docs updated.

## Rollout/deployment notes

Code merge alone does **not** fix production. Required console/config steps
(one-time, outside the repo):

1. Firebase Console → Authentication → Settings → **Authorized domains**: add
   `poker-ledger.vercel.app`.
2. Google Cloud Console → the OAuth 2.0 Web client → **Authorized redirect
   URIs**: add `https://poker-ledger.vercel.app/__/auth/handler`.
3. Deploy, then run the production mobile smoke test.
4. For any preview deploy that needs sign-in, repeat 1–2 for that specific
   preview subdomain (accepted limitation).

## Implementation notes

- Keep `authDomain` resolution a pure function so it is trivially testable; read
  `window.location.host` only in `getClientApp` (guard `typeof window`).
- Derive the rewrite destination from `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` so the
  project id is not duplicated. If the env var is empty (shouldn't happen in a
  real deploy), emit no rewrites rather than a malformed destination.
- Do not touch `sign-in-form.tsx`, Server Actions, or `src/proxy.ts`.

## Open questions

None blocking. (Custom-domain adoption is deferred to a future ADR.)

## Links

- `specs/decisions/0011-self-hosted-auth-handler.md` — ADR for this change
- `specs/decisions/0003-auth-model.md` — auth model
- `docs/03-architecture.md` — Auth flow (canonical)
- Firebase: Best practices for `signInWithRedirect` (redirect-best-practices)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft |
| 2026-07-08 | Accepted | Accepted by owner; implementing on claude/mobile-auth-sessionstorage-r64ill |
| 2026-07-08 | Implemented | Merged via PR #115 |

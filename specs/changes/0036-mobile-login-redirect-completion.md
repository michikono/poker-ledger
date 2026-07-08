# Change 0036: Mobile login — complete the redirect flow and stop the sign-in bounce

## Status
Accepted

## Owner
michikono

## Goal

Stop mobile Google Sign-In from bouncing the user back to `/sign-in`: complete
the OAuth **redirect** flow (not just the popup flow) and keep the session
cookie on the return navigation.

## Context

Spec 0035 / ADR 0011 fixed the "missing initial state" nonce error by serving
the Firebase auth handler same-origin. But the sign-in form still only handles
`signInWithPopup`, and ADR 0011 itself notes that "mobile browsers frequently
degrade `signInWithPopup` into a full redirect." Two gaps remain that produce a
redirect-back-to-`/sign-in` loop on phones — the app's primary device class:

1. **No redirect-result handling.** When the popup degrades to a full-page
   redirect, the page navigates away to Google and back; the `signInWithPopup`
   promise never resolves and there is no `getRedirectResult()` call anywhere
   (`src/app/sign-in/sign-in-form.tsx`). `createSession()` never runs, no
   `session` cookie is set, and `src/proxy.ts` immediately redirects the user
   back to `/sign-in`.

2. **`SameSite=Strict` session cookie** (`src/app/sign-in/actions.ts`). A
   `Strict` cookie is not sent on the cross-site top-level navigation returning
   from `accounts.google.com`, so even a correctly-set cookie is withheld on the
   proxy's first check, causing the same bounce. Firebase's session-cookie
   guidance uses `Lax` for exactly this reason.

(Note: the console messages "Device trust access denied … missing admin
permission" and "session does not exist for … skipping event" that accompanied
the report are emitted by a browser device-trust extension, not this app — they
appear nowhere in the codebase and are out of scope.)

## User-visible behavior

- On a phone, tapping "Continue with Google" completes sign-in and lands the
  user on their destination (`/sessions` or the `from` path) — whether the SDK
  uses a popup or degrades to a full-page redirect. No bounce back to sign-in.
- If the popup is blocked or unsupported (common in mobile in-app browsers), the
  app automatically falls back to a full-page redirect rather than failing.
- Desktop popup sign-in continues to work unchanged.
- Local development (Firebase emulator) sign-in continues to work unchanged.
- User-dismissed popups remain silent (no error banner), as today.

## Non-goals

- Changing the auth provider or adding new sign-in methods.
- Changing ID-token verification, Server Action authorization, or sign-out
  (ADR 0003 layers are untouched; the cookie remains `HttpOnly`, `Secure`).
- Preview-deploy per-host authorization (unchanged limitation from ADR 0011).
- Adopting a custom domain.

## Data model impact

None.

## Diagram impact

`docs/03-architecture.md` — Auth flow prose (step 1 "Sign-in" and the cookie
attributes line) updated to describe popup-or-redirect completion and the
`SameSite=Lax` attribute. The component/sequence mermaid diagrams are unchanged
(same components, same steps); prose only.

## API impact

None. No routes, Server Action signatures, or rewrites change. The only
behavioral change to a Server Action is the `sameSite` attribute value in the
`Set-Cookie` written by `createSession`.

## Security/privacy impact

- `SameSite=Strict` → `SameSite=Lax` on the `session` cookie. This is the
  minimum relaxation needed so the cookie survives the OAuth return navigation.
  It does **not** open a CSRF hole: `Lax` cookies are still withheld from
  cross-site unsafe requests (POST), and per `docs/03` mutations require a fresh
  ID token in addition to the cookie — the session cookie alone is never
  sufficient for a mutation. The cookie stays `HttpOnly` and `Secure`.
- Redirect-flow completion runs the same `verifyIdToken` → `createSessionCookie`
  path as the popup flow; no verification step is skipped.

## Local development impact

None. On `demo-*` projects the client talks to the Auth emulator; both popup and
redirect complete against the emulator. No new env vars.

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
| Production mobile smoke | Manual (post-deploy) | No (can't run pre-merge) | No | |
| Aggregate | `npm run check` | Yes | Yes | |

The production mobile redirect path cannot be exercised in CI/local (the
emulator never hits the real handler). It is a post-deploy manual verification.

## Test plan

TDD for the extracted pure logic:

- `classifyPopupError(err): "silent" | "redirect" | "error"` in
  `sign-in-form.tsx` (exported, like `isSafeInternalPath`). Unit tests:
  - `auth/popup-closed-by-user`, `auth/cancelled-popup-request`,
    `auth/user-cancelled` → `"silent"`
  - `auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`,
    `auth/web-storage-unsupported` → `"redirect"`
  - any other `FirebaseError` code (e.g. `auth/network-request-failed`) →
    `"error"`
  - a non-`FirebaseError` value → `"error"`

Component tests (`sign-in-form.test.tsx`, existing mock setup extended):
  - On mount, `getRedirectResult` resolving with a `{ user }` runs
    `createSession(idToken)` then `router.push(from)`.
  - On mount, `getRedirectResult` resolving `null` does nothing (no
    `createSession`, no navigation).
  - Popup path unchanged: successful `signInWithPopup` → `createSession` →
    push.
  - A `redirect`-class popup error triggers `signInWithRedirect`.

Excluded: the real browser redirect round-trip (manual smoke test only).

## Acceptance criteria

- [ ] `classifyPopupError` exists with unit tests covering silent/redirect/error
      branches.
- [ ] Sign-in form calls `getRedirectResult` on mount and completes sign-in
      (createSession + redirect) when it returns a user; shows the loading state
      while resolving and clears it on `null`.
- [ ] Popup failures classified `redirect` fall back to `signInWithRedirect`.
- [ ] `createSession` sets the `session` cookie with `sameSite: "lax"`; its test
      asserts `"lax"`.
- [ ] Emulator sign-in still works locally (smoke test).
- [ ] Desktop popup sign-in path unaffected.
- [ ] `docs/03-architecture.md` auth-flow prose updated (popup-or-redirect,
      `SameSite=Lax`).
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.
- [ ] Relevant docs updated.

## Rollout/deployment notes

No console/config changes beyond those already required by ADR 0011 (the
authorized-domain / redirect-URI setup covers both popup and redirect, since
both use the same `/__/auth/handler`). Deploy, then run a mobile smoke test.

## Implementation notes

- Extract `classifyPopupError` as a pure exported function so error routing is
  unit-tested without a browser.
- Run `getRedirectResult` inside the existing mount `useEffect` (it already
  pre-warms auth). Keep `loading` true while it resolves so the button doesn't
  flash between the redirect return and navigation.
- `signInWithRedirect` navigates away — no code after it runs; do not clear
  `loading` in that branch.
- Reuse the `from` / `isSafeInternalPath` logic for both popup and redirect
  completion so deep links survive.
- Do not touch `src/proxy.ts`, `verify-token.ts`, or the sign-out flow.

## Open questions

None blocking.

## Links

- `specs/decisions/0011-self-hosted-auth-handler.md` — same-origin handler
- `specs/decisions/0003-auth-model.md` — auth model
- `specs/changes/0035-mobile-auth-same-origin-handler.md` — prior mobile-auth fix
- `docs/03-architecture.md` — Auth flow (canonical)
- Firebase: Best practices for `signInWithRedirect`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-08 | Proposed | Initial draft |
| 2026-07-08 | Accepted | Accepted by owner; implementing on claude/login-device-trust-bug-5gapps |

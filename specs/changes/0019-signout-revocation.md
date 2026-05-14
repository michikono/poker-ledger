# Change 0019: Sign-out credential revocation

## Status
Implemented

## Owner
Michi Kono

## Goal

Make sign-out actually revoke a user's ability to act on the system, by revoking refresh tokens server-side, clearing client-side Firebase auth state, and rejecting revoked ID tokens at every mutation boundary.

## Context

A prior security audit of the auth flow (Change 0002, current implementation) found that "sign out" today only deletes the `session` cookie. The user's Firebase credentials remain fully usable:

- `src/app/sign-in/actions.ts:28-32` — `signOut()` only calls `cookieStore.delete("session")` and redirects. No client `auth.signOut()`, no Admin SDK `revokeRefreshTokens(uid)`.
- `src/components/layout/user-menu.tsx:17-21` — the sign-out button invokes only the Server Action; the client `auth.currentUser` and the refresh token in IndexedDB are untouched.
- `src/lib/auth/verify-token.ts:6` — every Server Action mutation entry point verifies ID tokens via `adminAuth.verifyIdToken(token)` **without** `checkRevoked: true`. Session-cookie reads do check revocation (`session-user.ts:14`, `sign-in/page.tsx:19`), but the mutation path does not.
- `docs/03-architecture.md:92-99` already promises that sign-out "also calls Firebase Client SDK `auth.signOut()` to clear local auth state" — the code does not match the doc.
- `docs/04-security-threat-model.md:75` promises that after cross-tab sign-out, "in-memory `auth.currentUser` is stale; next Server Action returns `UNAUTHENTICATED`". Neither half is currently true.

Concrete impact:

1. **Refresh token survives sign-out.** An attacker who exfiltrates the refresh token from IndexedDB (XSS, shared device, malicious browser extension) can mint fresh ID tokens for the duration of the refresh token's natural lifetime (up to ~5 days of session-cookie validity post sign-in, but the refresh token itself is long-lived until revoked).
2. **Stolen / revoked ID tokens are accepted for up to 1 hour** at every mutation: `src/app/(app)/sessions/actions.ts:24`, `src/app/(app)/sessions/[name]/actions.ts:58`, `src/app/api/sessions/search/route.ts:26`, `src/lib/auth/verify-token.ts:6`. If an admin disables a user in Firebase console, the user can still mutate session data for up to an hour.
3. **Cross-tab sign-out is broken.** Tab B's `auth.currentUser` stays populated and `getIdToken()` still succeeds, contradicting the documented behavior in `docs/04-security-threat-model.md:75`.

## User-visible behavior

- After tapping **Log out**: the user is redirected to `/sign-in` and is fully signed out everywhere — no tab, device, or background tab they own can read or mutate session data without signing in again.
- If the user is signed out from another tab or device (or disabled by an admin) while editing a session, the next mutation fails fast with the standard `UNAUTHENTICATED` flow already used elsewhere (redirect to `/sign-in?from=…` with the "Session expired" toast). No half-applied writes.
- No visible change to the sign-in or normal authenticated experience.

## Non-goals

- No new auth providers, MFA, or per-session ownership.
- No change to the 5-day session cookie TTL or the 1-hour ID-token TTL.
- No "sign out everywhere" admin tool / UI — `revokeRefreshTokens` is invoked only as part of the user's own sign-out flow in this change.
- No change to Firestore Security Rules or proxy presence-check behavior.
- Not refactoring how Server Actions receive ID tokens — they continue to receive `idToken` as the first argument.

## Data model impact

None. No Firestore schema changes. `revokeRefreshTokens` stores a `tokensValidAfterTime` server-side on the Firebase Auth user record; this is Firebase-managed state, not application data.

## Diagram impact

- `docs/03-architecture.md` — auth-flow sequence/graph: update sign-out node to show "client `auth.signOut()` + server `revokeRefreshTokens` + cookie delete", and add `checkRevoked: true` annotation on the Server Action verify step.
- No other diagrams affected.

## API impact

- `signOut()` Server Action (`src/app/sign-in/actions.ts`) signature unchanged (`(): Promise<void>`), but its preconditions widen: it now requires a valid session cookie to identify the `uid` to revoke. If the cookie is missing or invalid, it still clears state and redirects (sign-out must be idempotent and never error).
- `verifyIdToken` helper (`src/lib/auth/verify-token.ts`) and the three direct `adminAuth.verifyIdToken(...)` call sites switch to `checkRevoked: true`. Failure surfaces as the existing `UNAUTHENTICATED` error code — no new error code, no new client handling needed.
- No REST/RPC endpoint additions or removals.

## Security/privacy impact

This **is** the security change. Summary of the new posture:

| Layer | Before | After |
|---|---|---|
| Sign-out — server cookie | Deleted | Deleted (unchanged) |
| Sign-out — refresh token | Lives until natural expiry | **Revoked via `adminAuth.revokeRefreshTokens(uid)`** |
| Sign-out — client state | `auth.currentUser` still set; IndexedDB token persists | **Client calls `firebaseAuth.signOut()` before navigating** |
| Mutation verify | `verifyIdToken(token)` | **`verifyIdToken(token, true)`** (revocation-aware) |
| Session-cookie verify (read paths) | `verifySessionCookie(cookie, true)` | Unchanged (already correct) |

The `revokeRefreshTokens` call introduces one extra Admin SDK round trip on sign-out (acceptable — sign-out is rare and not latency-sensitive). The `checkRevoked: true` flag on `verifyIdToken` causes one Admin SDK lookup per mutation when the token has been revoked since issuance; for valid tokens the cost is a local check against cached `tokensValidAfterTime`. This is the documented Firebase pattern and is appropriate for our mutation volume.

Update `docs/04-security-threat-model.md` to reflect the closed gap.

## Local development impact

None for setup. The Firebase Auth emulator supports `revokeRefreshTokens` and `verifyIdToken(..., true)` — no new env vars, no new processes, no new commands. The existing `npm run dev` flow continues to work.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Integration tests (emulator) | covered by Vitest against emulator | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual: sign in, log out, attempt a mutation with the captured pre-logout ID token | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

E2E (Playwright) coverage of the sign-out → blocked-mutation flow is desirable but not required for merge in this change; if not added here, leave a `TODO(0019)` in `e2e/` and follow up.

## Test plan

Unit / integration (Vitest, against the Auth emulator where needed):

- `verifyIdToken` helper:
  - Accepts a valid, unrevoked token.
  - **Rejects** a token whose `uid` has had `revokeRefreshTokens` called after the token's `iat`. (Emulator-backed.)
  - Continues to reject expired and malformed tokens with the existing error shape.
- `signOut` Server Action:
  - With a valid session cookie: decodes the cookie, calls `adminAuth.revokeRefreshTokens(uid)`, deletes the cookie, redirects. (`revokeRefreshTokens` spied/asserted.)
  - With a missing or malformed cookie: deletes the cookie, redirects, does **not** throw. (Idempotent.)
  - Errors from `revokeRefreshTokens` (e.g., user-not-found) are logged but do not prevent cookie deletion + redirect — sign-out must always complete.
- Mutation entry points (one representative per file: `sessions/actions.ts`, `sessions/[name]/actions.ts`, `api/sessions/search/route.ts`): given a revoked ID token, return `UNAUTHENTICATED`.

Manual smoke (documented in PR body):

1. Sign in in Tab A. In DevTools, capture the current ID token from `firebase.auth().currentUser.getIdToken()`.
2. Sign in in Tab B. From Tab B, click **Log out**.
3. In Tab A (still appears signed in), attempt a mutation (e.g., add a buy-in). Expect: redirect to `/sign-in` with "Session expired" toast.
4. Replay the captured ID token against a mutation Server Action via the browser console / curl. Expect: `UNAUTHENTICATED`.
5. In a fresh tab, attempt to navigate to `/sessions`. Expect: redirect to `/sign-in`.

TDD ordering: write the `verifyIdToken` and `signOut` unit tests first; they should fail against current code, then pass after the implementation lands.

## Acceptance criteria

- [ ] `signOut()` Server Action calls `adminAuth.revokeRefreshTokens(uid)` for the current session's `uid` before deleting the cookie, and is idempotent (missing/invalid cookie → still redirects, no throw).
- [ ] `UserMenu` sign-out handler awaits `firebaseAuth.signOut()` from the client SDK before invoking the Server Action (or in parallel, then awaits both before the redirect resolves) so `auth.currentUser` is cleared and IndexedDB state is removed.
- [ ] `src/lib/auth/verify-token.ts` calls `adminAuth.verifyIdToken(token, true)`.
- [ ] The three direct `adminAuth.verifyIdToken` call sites either route through the shared helper or pass `true` explicitly: `src/app/(app)/sessions/actions.ts`, `src/app/(app)/sessions/[name]/actions.ts`, `src/app/api/sessions/search/route.ts`.
- [ ] Cross-tab smoke test (steps above) passes.
- [ ] Captured-token replay attack (step 4 above) returns `UNAUTHENTICATED` within ≤ 1 second of `revokeRefreshTokens` completing.
- [ ] `docs/03-architecture.md` auth-flow section and diagram reflect the implemented sign-out and the `checkRevoked: true` mutation verification.
- [ ] `docs/04-security-threat-model.md` "Token lifecycle" and "Authentication and authorization model" sections updated; the discrepancy between the doc and the code is closed.
- [ ] All quality gates pass (or failures documented with remediation plan).
- [ ] Spec conformance review completed.

## Rollout/deployment notes

- No env-var changes. No migration.
- No feature flag required: behavior change is strictly additive (more rejections of previously-accepted tokens; sign-out does strictly more work). Risk of breaking valid users is bounded to bugs in the implementation itself, not configuration drift.
- After deploy to production: verify in Vercel logs that no spike in `UNAUTHENTICATED` errors occurs for non-revoked users (which would indicate a misconfigured `verifyIdToken` call).
- Existing in-flight sessions: users with a valid session cookie remain signed in until they next sign out or the cookie expires; their refresh tokens are not pre-emptively revoked. This is intentional — we are not invalidating all live sessions, only fixing forward.

## Implementation notes

Suggested order:

1. Tighten the verifier first (low blast radius, easy to roll back): update `src/lib/auth/verify-token.ts:6` to pass `true`. Update the three direct call sites to either use the helper or pass `true` explicitly. Add unit tests using the Auth emulator to assert revoked-token rejection.
2. Update `signOut()` in `src/app/sign-in/actions.ts`:
   - Read the session cookie, attempt `adminAuth.verifySessionCookie(session, true)` to recover `uid`.
   - On success, `await adminAuth.revokeRefreshTokens(decoded.uid)`. Wrap in try/catch — log and continue on any error; we must not strand a user in a half-signed-out state.
   - Delete the cookie and redirect (existing behavior).
3. Update `UserMenu` (`src/components/layout/user-menu.tsx`) to call `firebaseAuth.signOut()` from the client SDK before invoking the `signOut` Server Action. Since the Server Action redirects, structure as: `await firebaseAuth.signOut()` first (so refresh-token-bearing client state is gone before the server even runs), then invoke the Server Action via `startTransition`. Handle errors from `firebaseAuth.signOut()` by logging and proceeding with the Server Action regardless — the server-side revocation is the source of truth.
4. Update docs.

Pitfalls:

- `revokeRefreshTokens` revokes only refresh tokens; **existing ID tokens stay cryptographically valid until expiry**. The `checkRevoked: true` flag is what makes the verifier consult `tokensValidAfterTime`. Both halves are required — landing only one leaves a 1-hour window of acceptance.
- Do not `await revokeRefreshTokens` *before* attempting to verify the cookie — verify first so we have a `uid`. The Admin SDK has no "revoke by session cookie" call.
- Do not throw from `signOut()` on any failure. The user pressed "Log out"; they must end up signed out from their perspective, even if the server-side revoke errors (which we then surface via logs/alerts, not UX).

## Open questions

- None blocking. Possible follow-up (not in this scope): an explicit "Sign out from all devices" affordance distinct from "Log out from this device". Today the change makes "Log out" globally effective, which is reasonable for an MVP poker-ledger app but worth revisiting if multi-device usage becomes common.

## Links

- `docs/03-architecture.md` — auth flow (to be updated)
- `docs/04-security-threat-model.md` — sections "Authentication and authorization model", "Token lifecycle" (to be updated)
- `specs/changes/0002-firebase-auth.md` — original auth implementation (Implemented)
- Firebase docs: [Manage Sessions](https://firebase.google.com/docs/auth/admin/manage-sessions) — `revokeRefreshTokens`, `verifyIdToken(..., true)`, `verifySessionCookie(..., true)`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-13 | Proposed | Initial draft following audit of sign-out flow on branch `feature/0019-signout-revocation` |
| 2026-05-13 | Accepted | Accepted for implementation |
| 2026-05-13 | Implemented | All three fixes landed: refresh-token revocation, client-side `firebaseSignOut`, `checkRevoked: true` on every mutation `verifyIdToken`. Tests added. `npm run check` passes (format, lint, typecheck, 626 unit tests, build). |

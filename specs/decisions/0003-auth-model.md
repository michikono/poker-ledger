# ADR 0003 — Authentication Model: Google Sign-In Required for All Access

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app is used by small friend groups sharing a session URL. Key tensions:

- **Attribution**: it's useful to know who added a buy-in or marked a payment paid, especially for the changelog ("Michi added $50 for Billy").
- **Friction**: requiring sign-in to join a friend's game adds friction for participants who just want to record a buy-in.
- **Spam prevention**: without any auth gate, anyone can create sessions or corrupt data.
- **Player identity**: players in a session are tracked by name (e.g., "Billy"), not by account. Billy may not have a Google account.
- **Privacy**: the changelog should never expose email addresses or full legal names — only enough to identify who did what in a small friend group.

Four models were considered:

**(a) Creator-gated**: sign-in required only to create a session; anyone with the URL can read or mutate.
**(b) Mutation-gated**: sign-in required for mutations; reads are public.
**(c) All-gated reads and mutations**: sign-in required for all access — viewing, reading, and mutating.
**(d) No auth**: no sign-in at all; Firebase Auth not used.

## Decision

Use model **(c)**: **Google Sign-In (Firebase Auth) required for all access — reads and mutations alike.**

The entire app is behind authentication. Unauthenticated users are redirected to a sign-in page. After signing in, they are redirected back to their original destination.

Players are tracked by name string only — they do not need a Google account. Any signed-in user can add/edit/remove any player in a session. The signed-in user is recorded as the actor in the changelog.

### Changelog privacy

The changelog stores the actor's **first name only** (the first word of the Google account's display name). Full email addresses and full display names are never stored or logged anywhere in the system.

**Fallback chain when `displayName` is missing or empty:**
- Google display name `"John Smith"` → stored as `"John"`
- Google display name `"Michi"` → stored as `"Michi"`
- Google display name `"Mary-Jane Smith"` → stored as `"Mary-Jane"` (split on space, not hyphen)
- Google display name `""` (empty) or missing → stored as the literal string `"Anonymous"`
- **Never** stored: `email`, `email.split('@')[0]`, or `uid` — these would leak PII into the changelog.

Implementation: `getActorFirstName(decoded: DecodedIdToken): string` in `src/lib/auth/actor-name.ts`. Single source of truth — used by every Server Action.

This applies to all `actor_name` fields in `ChangeLogEntry` records and `created_by_name` on `Session` documents.

### Auth verification (canonical)

Defense-in-depth, four layers. See `docs/03-architecture.md → "Auth flow"` and `docs/04-security-threat-model.md` for full details.

1. **Proxy** (`src/proxy.ts`): presence-only cookie check. Does NOT cryptographically verify (would add latency to every request).
2. **App layout RSC**: `adminAuth.verifySessionCookie(cookie, true)` (revocation check enabled) on every read. Primary gate for read paths.
3. **Server Actions**: each mutation receives a fresh ID token from the client (`auth.currentUser.getIdToken()`); verified by `adminAuth.verifyIdToken(token)`. Session cookie alone is NOT sufficient for mutations.
4. **Firestore Security Rules**: `request.auth != null` for reads (defense-in-depth — clients only read via Admin SDK in MVP). Writes denied to clients.

## Consequences

- Every changelog entry has a non-empty actor — typically the user's first name; rarely the literal `"Anonymous"` (when `displayName` is missing).
- Email addresses are never stored in Firestore — only Firebase UIDs (opaque) and extracted first names.
- The entire app is behind a sign-in gate. Friends who want to view a session (even passively) must have a Google account and sign in. This is a real friction cost.
- Session URLs are still shareable — the recipient is prompted to sign in, then redirected to the session.
- No per-session ownership — any authenticated user can modify any session. Acceptable for a friends app at MVP scale; per-session access control can be added later.
- The Google Sign-In flow is one tap on most devices (pre-authorized accounts), minimizing friction in practice.
- The Next.js proxy (`src/proxy.ts`, formerly `middleware.ts` in Next.js ≤15) handles the presence-only universal auth check. The app layout RSC handles cryptographic verification — defense-in-depth.
- Firebase Admin SDK credentials are server-only (`FIREBASE_ADMIN_*` env vars). Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) is public and safe to expose.

## Alternatives Considered

- **(a) Creator-gated**: loses attribution on all non-creator actions; public reads expose financial data to scrapers.
- **(b) Mutation-gated with public reads**: session financial data (buy-ins, cash-outs) would be publicly readable to anyone who knows or guesses a session URL. Rejected — not appropriate for financial data even at friend-group scale.
- **(d) No auth**: zero friction, no attribution, no spam protection, financial data fully public. Rejected entirely.
- **Per-session passcode**: no real identity, still no email safety, no attribution. Rejected.

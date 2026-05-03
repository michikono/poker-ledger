# 04 — Security Threat Model

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Identify threats, attack surface, and mitigations before implementation. This doc should be updated whenever the architecture or data model changes significantly.

---

## Trust boundaries

- **Untrusted**: all HTTP requests from browsers, including requests from authenticated users. Input is never trusted.
- **Trusted**: Firebase Admin SDK running inside Next.js Server Actions (server-side only). Firestore Security Rules (enforced by Firebase infrastructure).
- **Semi-trusted**: Firebase Auth tokens — valid tokens prove identity but do not prove authorization for a specific action. Server-side authorization logic is still required.

---

## Assets to protect

| Asset | Sensitivity | Why |
|---|---|---|
| Session financial data (buy-ins, cash-outs, payments) | Medium | Sensitive between participants; manipulation could cause financial disputes |
| User identity (Google display name, Firebase UID) | Medium | Personal data stored in changelog entries |
| Firebase Admin SDK credentials | High | Server-only; exposure would allow full Firestore read/write |
| Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) | Low | Public by design — identifies the project, does not grant write access |

---

## Threat actors

| Actor | Motivation | Capability |
|---|---|---|
| External attacker | Corrupt session data, spam sessions, enumerate user data | Unauthenticated HTTP requests; script-based |
| Malicious authenticated user | Manipulate buy-ins or payments to their financial advantage | Valid Google account, can call all mutation endpoints |
| Compromised dependency | Supply chain attack via npm package | Code execution in the app process |

---

## Threats and mitigations

| Threat | STRIDE category | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| Unauthenticated mutation (add/remove buy-in without sign-in) | Elevation of privilege | High | High | Firebase Auth token verified server-side on every Server Action; unauthenticated calls rejected | Planned |
| Session data tampering (manipulate another user's buy-in) | Tampering | Medium | Medium | Authorization check on every mutation (session must exist, status must allow edit); Firestore Security Rules as second layer | Planned |
| Session spam / DoS (create thousands of sessions) | Denial of service | Medium | Low | Session creation requires Google Sign-In; rate limiting TBD | Partial |
| Guessing session URLs (enumerate sessions) | Information disclosure | Low | Low | Session names are `food-food-NNN` (~5.3M combinations: 73 × 73 × 1000 — see `docs/07-business-logic.md`); not secret but not enumerable by brute force in practice | Accepted risk |
| Secret leakage via client bundle | Information disclosure | Low | High | Firebase Admin credentials are server-only env vars; never referenced in client components; `NEXT_PUBLIC_` vars are intentionally public | Planned |
| CSRF on Server Actions | Spoofing | Low | High | Next.js Server Actions use `SameSite=Strict` cookies; cross-origin requests blocked | Framework default |
| Replay of expired Firebase ID tokens | Spoofing | Low | Medium | Firebase ID tokens expire after 1 hour; Admin SDK verifies expiry on every request. Replay within the 1-hour window is mitigated by `SameSite=Strict` session cookie + HTTPS-only transport | Firebase default |
| XSS via user-supplied content | Tampering | Low | Medium | React escapes all rendered content by default; no `dangerouslySetInnerHTML`; player names and descriptions are plain text | Framework default |
| Compromised npm dependency | Various | Low | High | `npm audit` in CI; pin dependency versions in `package-lock.json`; review major dep additions | Planned |

STRIDE categories: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.

---

## Authentication and authorization model

The canonical auth flow is documented in `docs/03-architecture.md` → "Auth flow". Summary:

**Authentication layers (defense-in-depth):**
1. **Proxy** (`src/proxy.ts`): presence-only cookie check. Redirects to `/sign-in` if the `session` cookie is absent. **Does NOT cryptographically verify** — that happens at layer 2.
2. **App layout RSC** (`src/app/(app)/layout.tsx`): cryptographically verifies the session cookie via `adminAuth.verifySessionCookie(cookie, true)` (revocation check enabled). Failure → redirect. This is the primary check for read paths.
3. **Server Actions**: every mutation requires a fresh Firebase ID token (passed by client via `auth.currentUser.getIdToken()`), verified by `adminAuth.verifyIdToken(token)`. The session cookie alone is NOT sufficient for mutations.
4. **Firestore Security Rules**: reads require `request.auth != null` as defense-in-depth. Writes are denied to clients — all writes flow through Server Actions using the Admin SDK (which bypasses rules).

**Authorization (what an authenticated user can do):**
- All access (view session, list sessions, search, and all mutations) requires sign-in. Anyone signed in can read or mutate any session — no per-session ownership in MVP.
- Player records have no auth identity — they are name strings. The signed-in actor is recorded in the changelog; the player being acted on is referenced by document ID.

**Token lifecycle:**
- Session cookie TTL: **5 days** (`HttpOnly`, `Secure`, `SameSite=Strict`).
- Firebase ID token TTL: **1 hour** (auto-refreshed by Firebase Client SDK using its persisted refresh token).
- After session-cookie expiry: next navigation → `/sign-in`.
- After cross-tab sign-out: in-memory `auth.currentUser` is stale; next Server Action returns `UNAUTHENTICATED`; client redirects to `/sign-in?redirect=...` with a "Session expired" toast.

**`displayName` privacy:**
- The changelog stores **only** the user's first name (`displayName.split(' ')[0]`).
- Fallback chain when `displayName` is missing/empty: `"Anonymous"` (literal). **Never** falls back to `email` or `uid` (would leak PII).
- Email and UID are stored only in `actor_uid` (UID, opaque).

---

## Data exposure risks

- **API responses**: Server Actions return only the data needed for the UI — no full document dumps
- **Error messages**: errors return codes (`INVALID_AMOUNT`, `SESSION_NOT_EDITABLE`), not stack traces or internal details
- **Logs**: server logs must not include Firebase Admin private key, user emails, or full buy-in histories
- **Client bundle**: `NEXT_PUBLIC_FIREBASE_*` vars appear in the bundle — this is expected and safe. Admin SDK credentials must never appear.

---

## Dependency risks

- **firebase**: core dependency — high trust; version-pinned
- **firebase-admin**: server-only; credentials managed via env vars only
- All other dependencies: reviewed on addition; `npm audit` run in CI

---

## Secrets management

| Secret | Local | Production |
|---|---|---|
| Firebase Admin private key | Not needed (emulator requires no credentials) | Vercel environment variable (`FIREBASE_ADMIN_PRIVATE_KEY`) |
| Firebase Admin client email | Not needed locally | Vercel environment variable (`FIREBASE_ADMIN_CLIENT_EMAIL`) |
| Firebase client config | `.env.local` (demo values) | Vercel environment variables (`NEXT_PUBLIC_FIREBASE_*`) |

Rules:
- `.env.local` never committed
- Admin credentials never in client-side code or `NEXT_PUBLIC_` vars
- Secrets scanned before every push (manual for MVP; automated scan in CI backlog)

---

## Audit and logging

- Every state-changing mutation writes a `ChangeLogEntry` to Firestore — this is the primary audit trail
- Server-side logs (Vercel function logs): request method, path, response status — no sensitive data
- `ChangeLogEntry` records are immutable and append-only — they cannot be altered after the fact
- No centralized log aggregation tool for MVP (Vercel logs sufficient at this scale)

---

## Open security questions

- Rate limiting for session creation: no rate limiting in MVP. If spam becomes an issue, add Firebase App Check or server-side rate limiting. Tracked as a known limitation.
- Per-session authorization (only participants can edit): not implemented in MVP. Any authenticated user can edit any session. Acceptable for a friends-only app at this scale.

## Related docs

- `03-architecture.md`
- `06-api-contract.md`
- `07-business-logic.md`

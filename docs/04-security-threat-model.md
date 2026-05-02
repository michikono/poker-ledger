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
| Guessing session URLs (enumerate sessions) | Information disclosure | Low | Low | Session names are `food-food-NNN` (~2.5M combinations); not secret but not enumerable by brute force in practice | Accepted risk |
| Secret leakage via client bundle | Information disclosure | Low | High | Firebase Admin credentials are server-only env vars; never referenced in client components; `NEXT_PUBLIC_` vars are intentionally public | Planned |
| CSRF on Server Actions | Spoofing | Low | High | Next.js Server Actions use `SameSite=Strict` cookies; cross-origin requests blocked | Framework default |
| Replay of expired Firebase ID tokens | Spoofing | Low | Medium | Firebase ID tokens expire after 1 hour; Admin SDK verifies expiry on every request | Firebase default |
| XSS via user-supplied content | Tampering | Low | Medium | React escapes all rendered content by default; no `dangerouslySetInnerHTML`; player names and descriptions are plain text | Framework default |
| Compromised npm dependency | Various | Low | High | `npm audit` in CI; pin dependency versions in `package-lock.json`; review major dep additions | Planned |

STRIDE categories: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.

---

## Authentication and authorization model

**Authentication:**
- Google Sign-In via Firebase Auth (`signInWithPopup`)
- Firebase ID token issued to client after sign-in
- Every Server Action that mutates data: client sends ID token in request; server verifies via Firebase Admin SDK (`auth.verifyIdToken(token)`)
- Unauthenticated mutation calls return `401 Unauthorized`

**Authorization:**
- All reads (view session, list sessions, search) are public — no auth required
- All writes require a verified Firebase ID token — no per-user ownership checks in MVP (any authenticated user can mutate any session)
- Firestore Security Rules enforce: reads are open, writes require `request.auth != null` — second line of defense

**Players vs. users:**
- Players are name strings in Firestore — they have no auth identity
- The authenticated user who performs an action is recorded in the changelog; the player being acted on is just a reference

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

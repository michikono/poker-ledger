# Change 0002: Firebase Auth — Google Sign-In Gate

## Status
Implemented

## Owner
Michi Kono

## Goal

Add Google Sign-In via Firebase Auth so that every route in the app — reads and mutations alike — requires a verified Google account. Unauthenticated users are redirected to a sign-in page, then returned to their original destination after signing in.

## Context

Spec 0001 delivered the Next.js shell with no auth. This slice wires up Firebase Auth (Google provider) end-to-end: client-side sign-in flow, session cookie written server-side, Next.js proxy enforcing the gate on every request, and a utility for Server Actions to verify the ID token.

All subsequent slices depend on this — no Firestore reads or mutations are possible without a verified identity.

> **Historical note (2026-05-02 retrospective):** This spec was authored against Next.js 15 and refers throughout to "middleware" / `src/middleware.ts`. The Next.js 16 upgrade (spec 0003) renamed this concept to **proxy** / `src/proxy.ts`. The implementation lives at `src/proxy.ts`. All current docs (`docs/03`, `docs/04`, `docs/06`, `docs/07`, ADR 0003) use "proxy" terminology. This spec is left as-is for historical accuracy.
>
> **Also:** the as-shipped proxy is **presence-only** — it checks the `session` cookie exists but does NOT cryptographically verify it. Full verification happens in the `(app)` layout RSC via `adminAuth.verifySessionCookie` and in each Server Action via `adminAuth.verifyIdToken`. This is defense-in-depth; the original spec text describing "middleware verifies token" was inaccurate to the implementation. See `docs/03-architecture.md → "Auth flow"` for the canonical flow.

Relevant docs: `docs/01-user-flows.md` (auth model summary), `docs/03-architecture.md` (canonical auth flow), `docs/04-security-threat-model.md`, `specs/decisions/0003-auth-model.md`.

## User-visible behavior

- Navigating to any route without being signed in redirects to `/sign-in`.
- The sign-in page has a "Sign in with Google" button. Clicking it opens the Google OAuth flow (popup on desktop, redirect on mobile — popup for MVP simplicity).
- After successful sign-in the user is redirected to their original destination (or `/sessions` if no destination was captured).
- A signed-in user sees the app normally. Their first name is visible in the header (e.g., "Michi").
- A "Sign out" button in the header clears the session and redirects to `/sign-in`.
- The placeholder home page (`/`) redirects to `/sessions` for authenticated users.

## Non-goals

- No `/sessions` page content yet (spec 0003)
- No per-session authorization — any authenticated user can access any route
- No email/password auth — Google only
- No profile page or account management
- No Firebase App Check or rate limiting
- No mobile redirect flow — popup only for MVP

## Data model impact

None. Firebase Auth manages identity externally. No Firestore user collection. The only user data stored in Firestore is `actor_uid` (Firebase UID) and `actor_name` (first name) denormalized into records — but that happens in later specs, not here.

## Diagram impact

None. The architecture diagram already shows Firebase Auth as a component. No entity changes.

## API impact

This spec introduces one shared utility (not a Server Action or route):

**`src/lib/auth/verify-token.ts`** — server-side helper used by every Server Action:
```ts
// verifyIdToken(token: string): Promise<{ uid: string; firstName: string }>
// Throws if token is invalid or expired.
// Uses Firebase Admin SDK. Works against emulator in local dev.
```

No new HTTP routes. The sign-in page is a Next.js page (`/sign-in`), not an API route.

## Security/privacy impact

- Firebase ID tokens expire after 1 hour. The Admin SDK validates expiry on every call to `verifyIdToken`.
- Session cookie: after Google sign-in, the client exchanges the ID token for a server-set `HttpOnly`, `SameSite=Strict` session cookie (Firebase session cookie, valid for up to 5 days). Middleware reads this cookie to determine auth state without a client round-trip.
- `actor_name` stored in later specs is first name only (`displayName.split(' ')[0]`). This spec extracts and returns the first name in `verifyIdToken`'s return value so all callers use it consistently.
- Firebase Admin credentials (`FIREBASE_ADMIN_*`) are server-only. Never referenced in client components or `NEXT_PUBLIC_*` vars.
- The sign-in page is the only unauthenticated route. All other routes are gated by middleware.

## Local development impact

**New env vars required** (already in `.env.local.example`, values documented there):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL` (empty for local — emulator needs no credentials)
- `FIREBASE_ADMIN_PRIVATE_KEY` (empty for local — emulator needs no credentials)

All of these already exist in `.env.local.example` from spec 0001. No new env vars are added.

**Firebase Auth emulator:** the Firebase emulator suite includes Auth. `firebase.json` already configures it on port 9099. When `NEXT_PUBLIC_FIREBASE_PROJECT_ID` starts with `demo-`, the Firebase client SDK and Admin SDK automatically point to the local emulator — no additional config needed.

**Sign-in in the emulator:** the Firebase Auth emulator provides a built-in sign-in flow for demo projects. Users can sign in with any Google account in the emulator UI at `localhost:4000`. For testing, a pre-seeded test user can be added via the emulator UI or a setup script.

`docs/15-local-development.md` should be updated to describe how to sign in locally using the emulator.

## Quality gates

| Gate | Command | Required for completion | Required for merge |
|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes |
| Lint | `npm run lint` | Yes | Yes |
| Typecheck | `npm run type-check` | Yes | Yes |
| Unit tests | `npm run test` | Yes | Yes |
| Build | `npm run build` | Yes | Yes |
| Local smoke test | `npm run dev` + manual sign-in | Yes | Yes |
| Aggregate | `npm run check` | Yes | Yes |

Integration tests against the Auth emulator: not in this slice — `verifyIdToken` will be tested via unit test with mocked Admin SDK. Full emulator integration deferred to spec 0003 when Firestore is also involved.

## Test plan

**Unit tests (Vitest):**
- `src/lib/auth/verify-token.test.ts` — mock `firebase-admin` auth, test: valid token returns `{ uid, firstName }`, expired token throws, malformed token throws, single-word display name returns the full name, multi-word display name returns first word only.
- `src/middleware.test.ts` — test route matching logic: `/sign-in` is public, all other paths are gated (unit test the path-matching predicate, not the full middleware).

**Manual smoke test:**
- `npm run dev` → navigate to `localhost:3000` → redirected to `/sign-in` ✓
- Sign in with Google (via emulator) → redirected to `/sessions` ✓
- Navigate directly to `localhost:3000/sessions` while signed out → redirected to `/sign-in` ✓
- Sign out → redirected to `/sign-in` ✓
- Deep link: navigate to `/sessions/foo` while signed out → after sign-in, redirected to `/sessions/foo` ✓

## Acceptance criteria

- [ ] Navigating to any route while unauthenticated redirects to `/sign-in`
- [ ] `/sign-in` renders a "Sign in with Google" button (unauthenticated users only)
- [ ] Successful Google sign-in redirects to original destination (or `/sessions` as default)
- [ ] Signed-in user's first name is visible in the app layout header
- [ ] "Sign out" clears the session and redirects to `/sign-in`
- [ ] `/sign-in` is inaccessible to already-authenticated users (redirect to `/sessions`)
- [ ] `verifyIdToken` helper: valid token returns `{ uid, firstName }`; expired/invalid throws
- [ ] Unit tests for `verifyIdToken` pass (all cases above)
- [ ] Unit tests for middleware route-matching predicate pass
- [ ] `npm run check` passes
- [ ] Local smoke test passes (all manual steps above)
- [ ] `docs/15-local-development.md` updated with emulator sign-in instructions
- [ ] Spec conformance review completed

## Rollout/deployment notes

Production Firebase project env vars must be set in Vercel before the preview deployment is functional:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Without these, the Vercel preview deployment will show a Firebase initialization error. The emulator-local demo values are not valid for production.

## Implementation notes

### Architecture: session cookie vs. ID token in middleware

Next.js middleware cannot call Firebase Admin SDK directly (it runs at the edge before the Node.js runtime is available in some deployments, and the Admin SDK is heavy). The recommended pattern:

1. After Google sign-in on the client, call a Server Action (or thin API route) that exchanges the short-lived ID token for a Firebase **session cookie** via `admin.auth().createSessionCookie(idToken, { expiresIn })`.
2. The Server Action sets this as an `HttpOnly`, `SameSite=Strict` cookie (`session`).
3. Middleware reads the `session` cookie. To avoid edge/Admin SDK issues, the middleware verifies the cookie using the Firebase Admin SDK in a Next.js **server action or route handler** — or, simpler: redirect to sign-in if cookie is absent; let the actual pages/actions verify the full token. The middleware gate is "cookie present = proceed; cookie absent = redirect to /sign-in."

**Simpler alternative (use this for MVP):** middleware checks for the presence and basic format of the session cookie. Full cryptographic verification happens in each Server Action via `verifyIdToken`. This avoids edge runtime limitations and keeps middleware simple and fast. The double-verification (middleware + Server Action) provides defense in depth without complexity.

### File structure

```
src/
  lib/
    auth/
      admin.ts            — Firebase Admin SDK singleton (server-only)
      verify-token.ts     — verifyIdToken helper
      verify-token.test.ts
  app/
    sign-in/
      page.tsx            — sign-in page (Google button, client component)
      actions.ts          — createSession Server Action (exchanges ID token for session cookie)
      sign-out.ts         — signOut Server Action (clears session cookie)
    (app)/                — route group: all authenticated routes
      layout.tsx          — checks auth, renders header with user first name
      page.tsx            — redirects to /sessions
      sessions/
        page.tsx          — stub (implemented in spec 0003)
  middleware.ts           — gates all routes; passes /sign-in through
  middleware.test.ts      — unit tests for path-matching logic
```

### Firebase Admin singleton (`src/lib/auth/admin.ts`)

Initialize once, reuse across requests:
```ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: process.env.FIREBASE_ADMIN_CLIENT_EMAIL
      ? cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        })
      : undefined, // emulator: no credentials needed
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? "demo-poker-ledger",
  });
}

export const adminAuth = getAuth();
```

When the Admin SDK detects `FIREBASE_AUTH_EMULATOR_HOST` in the environment (set automatically by `firebase emulators:start`), it uses the emulator automatically.

### Middleware (`src/middleware.ts`)

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const session = request.cookies.get("session")?.value;

  if (!isPublic && !session) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("from", pathname);
    return NextResponse.redirect(signIn);
  }

  if (isPublic && session) {
    return NextResponse.redirect(new URL("/sessions", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Session cookie flow

Client-side sign-in (`src/app/sign-in/page.tsx`):
1. Import Firebase client SDK, initialize with `NEXT_PUBLIC_FIREBASE_*` vars
2. `signInWithPopup(auth, googleProvider)`
3. `const idToken = await user.getIdToken()`
4. Call `createSession(idToken)` Server Action
5. On success, `router.push(from ?? "/sessions")`

Server Action (`src/app/sign-in/actions.ts`):
1. `verifyIdToken(idToken)` — throws if invalid
2. `adminAuth.createSessionCookie(idToken, { expiresIn: 60 * 60 * 24 * 5 * 1000 })` — 5 days
3. `cookies().set("session", sessionCookie, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 5 })`
4. Return `{ success: true }`

Sign-out Server Action (`src/app/sign-in/sign-out.ts`):
1. `cookies().delete("session")`
2. `redirect("/sign-in")`

### `verifyIdToken` helper

```ts
export async function verifyIdToken(token: string): Promise<{ uid: string; firstName: string }> {
  const decoded = await adminAuth.verifyIdToken(token);
  const firstName = (decoded.name ?? decoded.email ?? "User").split(" ")[0];
  return { uid: decoded.uid, firstName };
}
```

## Open questions

None.

## Links

- `docs/01-user-flows.md` — auth model summary and sign-in flow
- `docs/03-architecture.md` — security boundaries
- `docs/04-security-threat-model.md` — auth threats and mitigations
- `docs/15-local-development.md` — local dev setup (to be updated)
- `specs/decisions/0003-auth-model.md` — auth model ADR (model c, all-gated)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved for implementation |
| 2026-05-02 | Implemented | All gates passed; merged via PR #6 |

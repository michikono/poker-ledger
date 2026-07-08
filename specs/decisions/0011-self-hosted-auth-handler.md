# ADR 0011 — Self-Host the Firebase Auth Handler (Same-Origin OAuth)

**Status:** Accepted
**Date:** 2026-07-08

## Context

Google Sign-In uses the Firebase JS SDK (`signInWithPopup`, see ADR 0003 and
`docs/03-architecture.md → Auth flow`). The SDK routes the OAuth exchange
through a helper page served from the project's `authDomain`
(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`), currently
`poker-ledger-8d3bc.firebaseapp.com` — a **different origin** from the app,
which is served from Vercel (`*.vercel.app`, ADR 0001).

Before starting the flow the SDK writes an "initial state" nonce to
`sessionStorage`. When Google redirects back to `/__/auth/handler`, the helper
reads that nonce to resume. Because the helper lives on `firebaseapp.com` while
the app lives on `*.vercel.app`, that storage is **third-party** relative to
the app.

On desktop this works: browsers are permissive with third-party storage and the
popup opener channel. On **mobile** it fails with:

> Unable to process request due to missing initial state. This may happen if
> browser sessionStorage is inaccessible or accidentally cleared.

Mobile Safari (ITP), mobile Chrome, and Firefox partition third-party storage,
and mobile browsers frequently degrade `signInWithPopup` into a full redirect.
The nonce written on `*.vercel.app` is not visible to the handler on
`firebaseapp.com`, so sign-in breaks on the primary target device class for
this app (CLAUDE.md: "primarily managed on mobile").

Firebase's documented remedy is to make the auth handler **same-origin** with
the app so the nonce is first-party. See
[Best practices for `signInWithRedirect`](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## Decision

**Self-host the Firebase auth handler on the app's own origin** via two changes:

1. **Runtime `authDomain` = the app's current host.** In the browser, for a
   real (non-demo) Firebase project, initialize the client SDK with
   `authDomain = window.location.host` instead of the fixed
   `*.firebaseapp.com` value. Every deployment (production and each preview)
   then routes OAuth through its *own* origin. The env var
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` remains the fallback for SSR, tests, and
   the local emulator.

2. **Reverse-proxy the handler paths.** Add Next.js rewrites so
   `/__/auth/:path*` and `/__/firebase/:path*` are proxied to
   `https://poker-ledger-8d3bc.firebaseapp.com`, letting Firebase's real
   handler code run while appearing first-party to the browser.

The local emulator flow is unaffected: on `demo-*` projects the SDK talks to
the Auth emulator (`connectAuthEmulator`) and the `*.firebaseapp.com` handler
is never used, so `authDomain` is left at its env value.

## Consequences

- Mobile Google Sign-In on the production origin works: the OAuth nonce is
  first-party, immune to third-party storage partitioning.
- Vendor coupling: the app now proxies a Firebase-owned URL surface
  (`/__/auth/*`, `/__/firebase/*`) through Vercel. If the Firebase project id
  changes, the rewrite destination must change with it (derived from
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to keep this in one place).
- **Per-host authorization is required.** Each origin used as `authDomain` must
  be listed in Firebase Console → Authentication → Settings → Authorized
  domains, and its `/__/auth/handler` URL added to the Google OAuth client's
  authorized redirect URIs. `*.vercel.app` cannot be wildcarded, so:
  - Production (`poker-ledger.vercel.app`) is authorized once and fixed.
  - **Preview deployments** (per-branch subdomains) each need individual
    authorization, or they will show the same error. This is an accepted
    limitation of staying on the default Vercel domain; a stable custom domain
    would remove it (future ADR if adopted).
- Cannot be verified by local gates or CI (emulator path never exercises the
  handler). Production verification is a manual mobile smoke test after the
  authorized-domain/redirect-URI console changes are in place.

## Alternatives Considered

- **Fixed `authDomain` = production host (env only, no runtime host).** Breaks
  preview deploys entirely (popup opens a cross-origin prod handler from a
  preview origin — the same third-party bug). Rejected in favor of the runtime
  per-host approach.
- **Custom domain as `authDomain`.** The most robust option (one stable
  first-party origin covers app + previews via subdomain). Deferred: the user
  chose to stay on the default `*.vercel.app` for now. Revisit as a follow-up
  ADR if a custom domain is adopted.
- **Switch to Firebase Hosting for the app.** Auto-serves the handler
  same-origin, but abandons Vercel (ADR 0001) and its preview/Server-Action
  story. Disproportionate to the problem.
- **Do nothing / desktop-only.** Violates the mobile-first mandate; the primary
  device class cannot sign in. Rejected.

## Links

- `specs/decisions/0003-auth-model.md` — auth model
- `specs/decisions/0001-use-vercel-for-hosting.md` — hosting
- `specs/changes/0035-mobile-auth-same-origin-handler.md` — implementing change
- `docs/03-architecture.md` — Auth flow (canonical)

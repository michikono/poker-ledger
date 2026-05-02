# ADR 0003 — Authentication Model: Google Sign-In Required for All Mutations

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app is used by small friend groups sharing a session URL. Key tensions:

- **Attribution**: it's useful to know who added a buy-in or marked a payment paid, especially for the changelog ("Michi added $50 for Billy").
- **Friction**: requiring sign-in to join a friend's game adds friction for participants who just want to record a buy-in.
- **Spam prevention**: without any auth gate, anyone can create sessions or corrupt data.
- **Player identity**: players in a session are tracked by name (e.g., "Billy"), not by account. Billy may not have a Google account.

Three models were considered:

**(a) Creator-gated**: sign-in required only to create a session; anyone with the URL can mutate.
**(b) All-gated**: sign-in required for all mutations; reads are public.
**(c) No auth**: no sign-in at all; Firebase Auth not used.

## Decision

Use model **(b)**: **Google Sign-In (Firebase Auth) required for all mutations; reads are public.**

Players are tracked by name string only — they do not need a Google account. Any signed-in user can add/edit/remove any player in a session. The signed-in user is recorded as the actor in the changelog.

Firebase ID tokens are verified server-side via the Admin SDK on every Server Action. Firestore Security Rules enforce `request.auth != null` for all writes as a second layer.

## Consequences

- Every changelog entry has a real actor name — no "Anonymous" actions.
- Friends who want to record buy-ins must have a Google account and sign in. This is a real friction cost.
- No per-session ownership — any authenticated user can modify any session. Acceptable for a friends app at MVP scale; per-session access control can be added later.
- The Google Sign-In flow is one tap on most devices (pre-authorized accounts), minimizing friction in practice.
- Firebase Admin SDK credentials are server-only (`FIREBASE_ADMIN_*` env vars). Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) is public and safe to expose.

## Alternatives Considered

- **(a) Creator-gated**: reduces friction for participants but loses attribution on all non-creator actions. Changelog becomes less useful. Spam is still gated at creation.
- **(c) No auth**: zero friction, but no attribution at all, no spam protection, and Firebase Auth becomes an unused dependency. Rejected because the changelog's value depends on named actors.
- **Per-session passcode**: a shareable code instead of Google Sign-In. Simpler for participants but no real identity — anyone who knows the code can act, still no attribution.

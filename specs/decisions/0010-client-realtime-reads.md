# ADR 0010 — Client-side Firestore realtime reads for background sync

**Status:** Accepted
**Date:** 2026-07-08

## Context

The app is used by several people at once during a live poker game (multiple phones on one session). Until now every read went through Server Components (Admin SDK) and a client only re-fetched when *it* mutated (`router.refresh()` after each Server Action). A change made on another device stayed invisible until the local user acted or reloaded, producing stale views during a game.

We need near-real-time propagation of new players, buy-ins, settlements/payments, and game-state changes. Options considered:

- **Client-side Firestore `onSnapshot` listeners** — the SDK's realtime channel (WebChannel over websockets/long-poll).
- **A bespoke WebSocket server** — a new service pushing change events to clients.
- **Polling** — periodic `router.refresh()` on a timer.

Two existing facts shaped the decision: `firestore.rules` already permits authenticated client reads on every relevant collection (only writes are denied — see ADR 0003), and every mutation already writes a `change_log` entry, giving a single collection that reflects all changes.

## Decision

Use **client-side Firestore `onSnapshot`** as the realtime transport. A small listener watches the newest `change_log` entry on the session detail page (and the `sessions` collection on the index); when it fires, a debounced `router.refresh()` re-runs the Server Component so all existing server-side data shaping is reused (no client re-derivation). Mutations still flow only through Server Actions + Admin SDK; `firestore.rules` is unchanged (writes stay denied).

Syncing is gated by user activity: after **10 minutes** with no interaction (pointer/scroll/key/tap/click or tab refocus) the listener detaches; returning to the tab (`visibilitychange`, e.g. unlocking a phone), interacting, or reconnecting resumes it with a single catch-up refresh. A connection-status light (green pulse / red static, with a tap popover) and a stale banner communicate the state on both surfaces.

## Consequences

- No new dependency or server: `firebase` (client SDK) was already present; `onSnapshot` runs over WebChannel. "Web sockets" without operating a socket server.
- No security-rule change: client reads were already authorized (ADR 0003 anticipated "direct client SDK reads, if ever introduced, still require auth"). This is that introduction. Exposure is unchanged versus the Admin-SDK read path — the same authenticated user reads the same collections.
- Reusing `router.refresh()` keeps a single source of truth for data transforms (sorting, buy-in history grouping, payment derivation) on the server; the client never mutates local state from snapshot payloads.
- The client now needs a Firestore emulator endpoint in local dev: a public `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST` (injected by `scripts/dev.mjs`, documented in `.env.local.example` / `docs/15`), mirroring the existing auth-emulator var.
- Idle-stop bounds long-lived connections from abandoned tabs (a modest cost/resource safeguard, not a security boundary).
- Expected propagation latency is ~1–2s (WebChannel push + ~250ms debounce + the `router.refresh()` server round-trip). It is a soft refresh — scroll, focus, and open modals are preserved.
- A persistent listener error (e.g. permission-denied) surfaces as an offline status/banner; recovery relies on the next online/offline or idle→active transition rather than an internal retry loop (kept simple deliberately).

## Alternatives Considered

- **Bespoke WebSocket server**: new infrastructure, its own auth, and it would duplicate or replace the Admin-SDK read path. Far larger surface for no benefit over Firestore's built-in realtime.
- **Polling via `router.refresh()`**: simplest, but either wastes requests (short interval) or is sluggish (long interval), and still hits the server every tick regardless of change. `onSnapshot` pushes only on actual change.
- **Client-side re-derivation from snapshot data**: would move all sorting/grouping/derivation logic to the client, creating a second source of truth to keep in sync with the server render. Rejected.

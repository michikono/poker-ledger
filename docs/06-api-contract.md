# 06 — API Contract

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define the API surface: action signatures, request/response shapes, authentication requirements, error codes, and conventions. This doc is the contract between the UI and the server.

---

## API style

**Next.js Server Actions** for all mutations. Next.js RSC (React Server Components) for reads.

- Mutations: exported `async` functions marked `"use server"`, called directly from client components
- Reads: RSC fetches data on the server and passes it as props — no explicit API call from the client for initial page load
- Search/autocomplete: thin API route (`/api/sessions/search`) since it needs to be called on user input

ADR reference: `specs/decisions/0004-server-actions-over-api-routes.md` (to be written)

---

## Authentication

**All access requires Google Sign-In.** See `docs/03-architecture.md` → "Auth flow" for the canonical flow. Summary:

- **Proxy** (`src/proxy.ts`): presence-only cookie check. Defense-in-depth.
- **Read paths (RSC)**: cryptographic verification of the session cookie happens in `src/app/(app)/layout.tsx` via `adminAuth.verifySessionCookie(cookie, true)`. No token parameter needed in RSC page functions — the layout has already verified.
- **Mutation Server Actions**: each action takes a `token: string` parameter. The client obtains it via `auth.currentUser.getIdToken()` immediately before the call. Verified in the action via `adminAuth.verifyIdToken(token)`. The session cookie alone is NOT sufficient.
- **Search API route** (`/api/sessions/search`): requires the Firebase ID token in `Authorization: Bearer <token>` header.

```ts
// Pattern used in every mutation action
"use server";
import { adminAuth } from "@/lib/auth/admin";

async function requireUser(token: string) {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw new ActionError("UNAUTHENTICATED");
  }
}
```

**Client-side token retrieval pattern:**

```ts
"use client";
import { auth } from "@/lib/firebase/client";

async function callMutation(args) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    // Cross-tab sign-out: redirect with a session-expired toast
    window.location.href = `/sign-in?redirect=${encodeURIComponent(location.pathname)}`;
    return;
  }
  return await someServerAction(args, token);
}
```

---

## Error format

All Server Actions return a typed result union:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } }
```

Error codes — exhaustive enum:

| Code | Meaning | Default UI treatment |
|---|---|---|
| `UNAUTHENTICATED` | No valid auth token provided | Redirect to `/sign-in?redirect=<path>` + toast: "Session expired — please sign in again." |
| `INVALID_INPUT` | Validation failed at the action boundary (shape/type) | Inline error on the offending field |
| `INVALID_AMOUNT` | Amount is not a positive integer / out of range | Inline error on the amount input |
| `INVALID_PLAYER_NAME` | Player name is empty, too long, or contains forbidden characters | Inline error on the name input |
| `DUPLICATE_PLAYER_NAME` | Case-insensitive name collision in this session | Inline error on the name input |
| `SESSION_NOT_FOUND` | Session document does not exist | Toast: "Session not found." + redirect to `/sessions` |
| `SESSION_NOT_EDITABLE` | Session state does not allow this mutation | Toast: "This session can't be edited in its current state." |
| `SESSION_SETTLED` | Session is fully settled — no edits allowed | Toast (subset of `SESSION_NOT_EDITABLE` for clarity) |
| `SESSION_ARCHIVED` | Session is archived; not editable | Toast: "This session is archived. Unarchive it to edit." |
| `INVALID_STATE_TRANSITION` | Requested transition not permitted by the state machine | Toast: "Can't perform that action right now." |
| `BALANCE_OUT_OF_RANGE` | Cash-outs > buy-ins, or shortfall > 2%, or total buy-in is zero | Inline in the settling modal (Confirm stays disabled with explanatory text) |
| `SESSION_DATA_STALE` | Optimistic-concurrency conflict — server data changed during the action's transaction | Toast: "Someone else just updated this session. Refresh to see the latest." + reload |
| `PAYMENT_NOT_FOUND` | Payment document does not exist | Toast: "That payment no longer exists. Refreshing." + reload |
| `PLAYER_NOT_FOUND` | Player document does not exist | Toast: "That player no longer exists. Refreshing." + reload |
| `NAME_COLLISION` | Session name generation failed after 5 retries | Toast: "Couldn't create a session — please try again." |
| `INTERNAL_ERROR` | Unexpected server error | Toast: "Something went wrong — please try again." |

The Toast vs. inline distinction is canonicalized in `docs/08-ux-spec.md` → "Error code → UI treatment".

---

## Versioning

No versioning for MVP. Server Actions are internal — breaking changes require updating all call sites simultaneously. If an external API is introduced later, versioning strategy will be defined in an ADR.

---

## Server Actions

### `createSession(input, token)`

**Auth required:** Yes
**Purpose:** Create a new session with a generated unique name.

```ts
input: {
  defaultBuyInCents?: number; // optional, positive integer
}

returns: ActionResult<{
  sessionId: string; // equals session name, e.g. "crispy-salmon-042"
}>
```

**Side effects:** Creates `Session` document; writes `ChangeLogEntry` (`session_created`).

---

### `addPlayer(input, token)`

**Auth required:** Yes
**Purpose:** Add a named player to an in-progress session.

```ts
input: {
  sessionId: string;
  name: string; // 1–50 chars, trimmed
}

returns: ActionResult<{
  playerId: string;
}>
```

**Validation:** Session must be `in_progress`; name must be unique within session (case-insensitive).
**Side effects:** Creates `Player` document; writes `ChangeLogEntry` (`player_added`).

---

### `addBuyIn(input, token)`

**Auth required:** Yes
**Purpose:** Record a buy-in for a player.

```ts
input: {
  sessionId: string;
  playerId: string;
  amountCents: number; // positive integer
}

returns: ActionResult<{
  buyInId: string;
}>
```

**Validation:** Session must be `in_progress`; amount must be > 0.
**Side effects:** Creates `BuyIn` document; writes `ChangeLogEntry` (`buy_in_added`).

---

### `removeBuyIn(input, token)`

**Auth required:** Yes
**Purpose:** Remove a specific buy-in record for a player.

```ts
input: {
  sessionId: string;
  playerId: string;
  buyInId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must be `in_progress`; buy-in must exist.
**Side effects:** Deletes `BuyIn` document; writes `ChangeLogEntry` (`buy_in_removed`).

---

### `setCashOut(input, token)`

**Auth required:** Yes
**Purpose:** Set, update, or clear a player's cash-out amount.

```ts
input: {
  sessionId: string;
  playerId: string;
  amountCents: number | null; // null = clear; otherwise non-negative integer
}

returns: ActionResult<void>
```

**Validation:** Session must be **`in_progress` only** — see rule `cashout-edits-only-via-rollback-once-settling` in `docs/07`. Amount, if non-null, must be 0 ≤ value ≤ 2_000_000.
**Side effects:** Updates `Player.cash_out_cents`; writes `ChangeLogEntry` (`cash_out_set`, with `metadata.cleared = true` if `amountCents === null`).

---

### `transitionToSettling(input, token)`

**Auth required:** Yes
**Purpose:** Move session from `in_progress` to `settling` (or directly to `settled` if zero Payments are produced). Calculates and stores minimum settlements.

```ts
input: {
  sessionId: string;
}

returns: ActionResult<{
  payments: Array<{
    paymentId: string;
    fromPlayerId: string;
    toPlayerId: string;
    amountCents: number;
  }>;
  finalStatus: "settling" | "settled"; // settled if zero payments produced
}>
```

**Validation:** Session must be `in_progress`; ≥1 player; all players must have `cash_out_cents` set (non-null); `total_cashout <= total_buyin` and `total_buyin > 0` and `(total_buyin - total_cashout) / total_buyin <= 0.02`.
**Side effects:** Creates `Payment` documents (minimum transaction set, after applying shortfall absorption per `docs/07-business-logic.md`); updates `Session.status` to `settling` (or `settled` if zero payments). Writes one `ChangeLogEntry` (`status_changed`). All writes in a single Firestore transaction.
**Optimistic concurrency:** if another concurrent mutation modifies the session during this transaction, Firestore retries up to 5 times. After exhaustion, returns `SESSION_DATA_STALE`.

---

### `updatePlayer(input, token)`

**Auth required:** Yes
**Purpose:** Update a player's name and/or Venmo handle in a single atomic write. Allowed in all non-archived states.

```ts
input: {
  sessionId: string;
  playerId: string;
  name: string;                  // 1–50 chars, trimmed
  venmoUsername: string | null;  // null clears; otherwise validated handle
}

returns: ActionResult<void>
```

**Validation:**
- Session must not be `archived`.
- `name`: non-empty after trim; ≤ 50 chars; unique within session (case-insensitive via `name_lower`).
- `venmoUsername`: trimmed; leading `@` stripped; if non-empty after stripping, must match `/^[A-Za-z0-9_.-]{5,30}$/`. Empty string and the literal `@` are normalized to `null` (clear). Invalid handles reject with `INVALID_VENMO_USERNAME`.

**Side effects:** Conditionally updates only the fields that changed:
- If `name` changed: updates `Player.name` and `Player.name_lower`; writes a `ChangeLogEntry` (`player_renamed`, with `metadata = { player_id, from, to }`).
- If `venmo_username` changed: updates `Player.venmo_username`; writes a `ChangeLogEntry` (`player_venmo_updated`, with `metadata = { player_id, had_handle, has_handle }` — booleans only; the handle string itself is **never** written to the changelog).
- If neither changed: no-op (no writes).

Existing changelog entries are NOT rewritten — they retain prior values as a snapshot. When both fields change, two changelog entries are written in the same transaction.

---

### `markPaymentPaid(input, token)`

**Auth required:** Yes
**Purpose:** Mark a single payment as paid. If this is the last unpaid payment in a `settling` session, the session automatically transitions to `settled`.

```ts
input: {
  sessionId: string;
  paymentId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must be `settling` or `settled`; payment must exist. Idempotent if already paid.
**Side effects:** Updates `Payment.paid`, `Payment.paid_at`, `Payment.paid_by_uid`; writes `ChangeLogEntry` (`payment_marked_paid`); if last payment, updates `Session.status` to `settled` and writes a second `ChangeLogEntry` (`status_changed`) — all in one transaction.

---

### `unmarkPaymentPaid(input, token)`

**Auth required:** Yes
**Purpose:** Un-mark a payment (toggle paid → unpaid). If the session is `settled`, it automatically transitions back to `settling`.

```ts
input: {
  sessionId: string;
  paymentId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must be `settling` or `settled`; payment must exist and be currently paid.
**Side effects:** Clears `Payment.paid`, `Payment.paid_at`, `Payment.paid_by_uid`; writes `ChangeLogEntry` (`payment_unmarked_paid`); if session was `settled`, updates `Session.status` to `settling` and writes a second `ChangeLogEntry` (`status_changed`) — all in one transaction.

---

### `transitionToSettled(input, token)`

**Auth required:** Yes
**Purpose:** Explicitly close out a session after all payments are marked. (Called after user confirms the "close out?" dialog.)

```ts
input: {
  sessionId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must be `settling`; all payments must be paid.
**Side effects:** Updates `Session.status` to `settled`; writes `ChangeLogEntry` (`status_changed`).
**Note:** This action exists for edge cases (e.g., re-confirming after a manual rollback). In normal flow, `settled` is reached automatically via `markPaymentPaid`.

---

### `rollbackSessionStatus(input, token)`

**Auth required:** Yes
**Purpose:** Roll back session status one step (`settled → settling` or `settling → in_progress`).

```ts
input: {
  sessionId: string;
  targetStatus: "settling" | "in_progress";
}

returns: ActionResult<void>
```

**Validation:** Transition must be a valid rollback (settled→settling or settling→in_progress).
**Side effects:**
- For `settled → settling`: updates `Session.status`; resets every `Payment.paid` to false (and clears `paid_at`, `paid_by_uid`); writes one `ChangeLogEntry` (`status_changed`, with `metadata.reason = "manual_rollback"`). No individual `payment_unmarked_paid` entries are emitted for the cascade.
- For `settling → in_progress`: updates `Session.status`; **deletes every Payment document in the session** (so re-entry to `settling` recomputes from scratch); writes one `ChangeLogEntry` (`status_changed`, with `metadata.reason` omitted). All in one Firestore transaction.

---

### `archiveSession(input, token)`

**Auth required:** Yes
**Purpose:** Soft-delete a session (move to `archived`). Stores current status as `previous_status` for restoration.

```ts
input: {
  sessionId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must exist and not already be `archived` (returns `INVALID_STATE_TRANSITION` otherwise).
**Side effects:** Updates `Session.status` to `archived`, sets `Session.previous_status` to the prior status; writes `ChangeLogEntry` (`session_archived`, with `metadata = { previous_status }`). Payment docs are retained as-is.

---

### `unarchiveSession(input, token)`

**Auth required:** Yes
**Purpose:** Restore an archived session to its pre-archive status.

```ts
input: {
  sessionId: string;
}

returns: ActionResult<void>
```

**Validation:** Session must be `archived` and must have a valid `previous_status` (one of `in_progress`, `settling`, `settled`). Returns `INVALID_STATE_TRANSITION` if `previous_status` is null/missing/invalid.
**Side effects:** Updates `Session.status` to `previous_status`, clears `Session.previous_status`; writes `ChangeLogEntry` (`session_unarchived`, with `metadata = { restored_to }`).

---

## Read paths (RSC — no explicit action)

These are server-side data fetches performed inside React Server Components, not discrete API calls:

| Page | Data fetched |
|---|---|
| `/sessions` | All non-archived sessions, fetched as three parallel `where("status", "==", X)` queries (one per visible status), then sorted in app code. Player count is read from the denormalized `Session.player_count` field — no N+1. Hard cap: 200 per status group. |
| `/sessions/:name` | Single session document + all players (and per-player `buy_ins`) + all payments + last 200 changelog entries. |
| `/sessions/archived` (Archived menu item) | All sessions where `status == "archived"`, ordered by `previous_status` priority then `created_at DESC`. |

**Recommended fetch pattern for `/sessions/:name`:**

```ts
const [session, players, payments, log] = await Promise.all([
  db.collection("sessions").doc(name).get(),
  db.collection("sessions").doc(name).collection("players").orderBy("created_at", "asc").get(),
  db.collection("sessions").doc(name).collection("payments").orderBy("created_at", "asc").get(),
  db.collection("sessions").doc(name).collection("change_log").orderBy("created_at", "desc").limit(200).get(),
]);
// Then for each player, fetch buy-ins (additional Promise.all over players[])
```

Buy-ins per player are fetched in a second `Promise.all` round (one query per player). Acceptable at MVP scale (typically ≤ 10 players per session). If this becomes a hot path, denormalize `total_buy_in_cents` onto the player document.

**Date serialization:** all Firestore Timestamps are converted to ISO 8601 strings (UTC) before being passed from RSC to Client Components, since `Timestamp` is not serializable across the RSC boundary.

---

## Search API route

### `GET /api/sessions/search?q={query}`

**Auth required:** Yes — Firebase ID token required in `Authorization: Bearer <token>` header.
**Purpose:** Autocomplete session name search.

**Query semantics:**
- `q` is lowercased (`q.toLowerCase()`) before matching.
- Two passes:
    1. **Prefix matches** on `name_lower`: Firestore range query `where("name_lower", ">=", q).where("name_lower", "<", q + "")` — sorted alphabetically (A→Z).
    2. **Contains matches** (only if prefix yields fewer than 10): fetch a wider window (latest 100 sessions) and filter client-side for `name_lower.includes(q)` excluding the prefix matches. Sorted by `created_at DESC`.
- Results are merged in that order; max 10 returned.
- Empty/whitespace `q` → 400 `INVALID_INPUT`.
- Includes archived sessions. Archived results carry the `archived` status badge in the UI.

**Response:**
```json
[
  {
    "name": "crispy-salmon-042",
    "status": "in_progress",
    "created_at": "2026-05-02T18:30:00.000Z",
    "match_kind": "prefix"
  },
  {
    "name": "happy-tuna-007",
    "status": "settled",
    "created_at": "2026-04-15T12:10:00.000Z",
    "match_kind": "contains"
  }
]
```

All timestamps are ISO 8601 strings (UTC). `match_kind` is `"prefix"` or `"contains"` (used by the UI to surface why a result matched). Maximum 10 results. Cap at 5 prefix + 5 contains.

---

## Related docs

- `01-user-flows.md`
- `02-domain-model.md`
- `04-security-threat-model.md`

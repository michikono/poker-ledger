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

**All access requires Google Sign-In.** Next.js middleware enforces the auth gate universally — unauthenticated requests to any route (page or API) are redirected to sign in.

Mutation Server Actions additionally verify a Firebase ID token passed explicitly from the client:

```ts
// Pattern used in every mutation action
const user = await verifyAuthToken(token); // throws if invalid/expired
if (!user) throw new ActionError("UNAUTHENTICATED");
```

Read paths (RSC): auth enforced by middleware before the RSC renders — no explicit token parameter needed in RSC functions.

The search API route (`/api/sessions/search`): requires the Firebase ID token in the `Authorization: Bearer <token>` header.

---

## Error format

All Server Actions return a typed result union:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } }
```

Error codes:

| Code | Meaning |
|---|---|
| `UNAUTHENTICATED` | No valid auth token provided |
| `INVALID_INPUT` | Validation failed — see `message` for detail |
| `SESSION_NOT_FOUND` | Session does not exist |
| `SESSION_NOT_EDITABLE` | Session state does not allow this mutation |
| `SESSION_SETTLED` | Session is fully settled — no edits allowed |
| `INVALID_STATE_TRANSITION` | The requested state change is not permitted |
| `BALANCE_OUT_OF_RANGE` | Cash-outs exceed buy-ins, or shortfall exceeds 2% of total buy-ins |
| `DUPLICATE_PLAYER_NAME` | A player with this name already exists in the session |
| `INVALID_AMOUNT` | Amount must be a positive integer (cents) |
| `INVALID_PLAYER_NAME` | Player name is empty, too long, or duplicates an existing name |
| `NAME_COLLISION` | Session name generation failed after max retries |
| `INTERNAL_ERROR` | Unexpected server error |

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
**Purpose:** Set or update a player's cash-out amount.

```ts
input: {
  sessionId: string;
  playerId: string;
  amountCents: number; // non-negative integer
}

returns: ActionResult<void>
```

**Validation:** Session must be `in_progress` or `settling`; amount must be ≥ 0.
**Side effects:** Updates `Player.cash_out_cents`; writes `ChangeLogEntry` (`cash_out_set`).

---

### `transitionToSettling(input, token)`

**Auth required:** Yes
**Purpose:** Move session from `in_progress` to `settling`. Calculates and stores minimum settlements.

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
}>
```

**Validation:** Session must be `in_progress`; all players must have `cash_out_cents` set; `total_cashout <= total_buyin` and `(total_buyin - total_cashout) / total_buyin <= 0.02`.
**Side effects:** Creates `Payment` documents (minimum transaction set); updates `Session.status` to `settling`; writes `ChangeLogEntry` (`status_changed`). All writes in a single Firestore transaction.

---

### `updatePlayerName(input, token)`

**Auth required:** Yes
**Purpose:** Rename a player. Allowed in all non-archived states.

```ts
input: {
  sessionId: string;
  playerId: string;
  name: string; // 1–50 chars, trimmed
}

returns: ActionResult<void>
```

**Validation:** Session must not be `archived`; name must be unique within session (case-insensitive); non-empty.
**Side effects:** Updates `Player.name`; writes `ChangeLogEntry` (`player_name_edited`).

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
**Side effects:** Updates `Session.status`; if rolling back `settled → settling`, resets all `Payment.paid` to false; writes `ChangeLogEntry` (`status_changed`).

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

**Validation:** Session must exist and not already be `archived`.
**Side effects:** Updates `Session.status` to `archived`, sets `Session.previous_status`; writes `ChangeLogEntry` (`status_changed`).

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

**Validation:** Session must be `archived` and must have a valid `previous_status`.
**Side effects:** Updates `Session.status` to `previous_status`, clears `Session.previous_status`; writes `ChangeLogEntry` (`status_changed`).

---

## Read paths (RSC — no explicit action)

These are server-side data fetches performed inside React Server Components, not discrete API calls:

| Page | Data fetched |
|---|---|
| `/sessions` | All non-archived sessions, ordered by `(status, created_at DESC)` |
| `/sessions/:name` | Session + all players + all buy-ins per player + all payments + change log |

---

## Search API route

### `GET /api/sessions/search?q={query}`

**Auth required:** Yes — Firebase ID token required in `Authorization: Bearer <token>` header.
**Purpose:** Autocomplete session name search.

**Response:**
```json
[
  { "name": "crispy-salmon-042", "status": "in_progress", "created_at": "..." },
  ...
]
```

Results ordered: alphabetical match first, then most recent. Maximum 10 results. Includes all sessions regardless of status (including `archived`).

---

## Related docs

- `01-user-flows.md`
- `02-domain-model.md`
- `04-security-threat-model.md`

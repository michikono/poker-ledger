# 07 — Business Logic

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Document the business rules that govern system behavior. These rules should be expressible as tests. They are the authoritative source for TDD.

---

## Rule format

> **Rule:** [name]
> **Description:** [what it enforces]
> **When violated:** [what happens — error, silent correction, audit log, etc.]
> **Tests required:** Yes

---

## Rules by domain area

### Session lifecycle

> **Rule:** valid-state-transitions
> **Description:** Sessions follow a strict state machine. Forward: `in_progress → settling → settled`. Automatic reverse: `settled → settling` (triggered by unmarking a payment). Manual rollback: `settling → in_progress`, `settled → settling`. Archive: any non-archived state → `archived` (stores current status as `previous_status`). Unarchive: `archived → previous_status`. No other transitions are permitted.
> **When violated:** Server returns a 400 error with code `INVALID_STATE_TRANSITION`
> **Tests required:** Yes

> **Rule:** settling-requires-balance
> **Description:** A session cannot transition to `settling` unless both conditions hold:
> 1. `total_cashout <= total_buyin` (cash-outs can never exceed buy-ins)
> 2. `(total_buyin - total_cashout) / total_buyin <= 0.02` (shortfall is at most 2%)
>
> In other words, total cash-outs must fall in the range `[0.98 × total_buyin, total_buyin]`. If `total_buyin` is zero, the transition is blocked unconditionally. The 2% tolerance accounts for real-world chip loss.
> **When violated:** Transition rejected with code `BALANCE_OUT_OF_RANGE`; delta is surfaced in the settling modal
> **Tests required:** Yes — test boundary conditions at exactly 0%, 2%, and >2% shortfall; test overage case

> **Rule:** settling-requires-all-cashouts
> **Description:** Every player in the session must have a cash-out amount set before the session can transition to `settling`. Cash-outs may be entered in the settling confirmation modal (prefilled with any prior table values). The server enforces this on the transition call regardless of how cash-outs were entered.
> **When violated:** Transition rejected with code `INVALID_INPUT`; the modal highlights missing fields
> **Tests required:** Yes

> **Rule:** no-buyin-changes-while-settling
> **Description:** Once a session is in `settling` or `settled` state, no new buy-ins can be added and no existing buy-ins can be removed or modified.
> **When violated:** Server returns 400 with code `SESSION_NOT_EDITABLE`
> **Tests required:** Yes

> **Rule:** no-cashout-changes-while-settled
> **Description:** Once a session is `settled`, cash-out amounts cannot be modified. (Cash-outs are editable while `settling`.)
> **When violated:** Server returns 400 with code `SESSION_SETTLED`
> **Tests required:** Yes

> **Rule:** archive-is-soft-delete
> **Description:** Archiving a session moves it to `archived` state. No data is hard-deleted. Archived sessions are hidden from the main index but visible in the Archived section and searchable. Archive is available from any non-archived state.
> **When violated:** n/a — archive is always permitted for non-archived sessions
> **Tests required:** Yes

> **Rule:** rollback-retains-records
> **Description:** Rolling back session state never deletes records. Rolling back `settling → in_progress`: payment records are retained but ignored; settlements are recalculated on next transition to `settling`. Rolling back `settled → settling` (manual): payment records are retained but all `paid` statuses are reset to false.
> **When violated:** n/a — system invariant on rollback writes
> **Tests required:** Yes

---

### Payments

> **Rule:** auto-settle-on-last-payment
> **Description:** When the last unpaid payment in a `settling` session is marked paid, the session immediately and automatically transitions to `settled`. No user confirmation is required.
> **When violated:** n/a — system invariant enforced on every payment write
> **Tests required:** Yes

> **Rule:** auto-unsettle-on-payment-unmark
> **Description:** Payments can be un-marked (toggled from paid back to unpaid) at any time while the session is `settling` or `settled`. If the session is `settled` when a payment is un-marked, the session immediately and automatically transitions back to `settling`. The un-marked payment's `paid`, `paid_at`, and `paid_by_uid` fields are cleared.
> **When violated:** n/a — system invariant enforced on every payment unmark write
> **Tests required:** Yes — test auto-transition from `settled → settling` on unmark

> **Rule:** payment-mark-idempotent
> **Description:** Marking a payment paid when it is already paid is a no-op (no error, no duplicate changelog entry).
> **When violated:** n/a — idempotent
> **Tests required:** Yes

---

### Buy-ins

> **Rule:** buyin-positive
> **Description:** A buy-in amount must be a positive integer (stored in cents). Zero and negative amounts are rejected.
> **When violated:** Server returns 400 with code `INVALID_AMOUNT`
> **Tests required:** Yes

---

### Cash-outs

> **Rule:** cashout-non-negative
> **Description:** A player's cash-out amount must be zero or a positive integer (in cents). Negative cash-outs are rejected.
> **When violated:** Server returns 400 with code `INVALID_AMOUNT`
> **Tests required:** Yes

---

### Settlement calculation

> **Rule:** minimum-transactions-algorithm
> **Description:** The settle-up transactions are calculated server-side and written to Firestore when a session transitions to `settling`. Algorithm:
> 1. Compute each player's net balance: `net[i] = cashout[i] - sum(buyins[i])`
> 2. Separate players into creditors (net > 0) and debtors (net < 0)
> 3. Greedily match: take the largest debtor D and largest creditor C; create a payment from D to C for `min(|net[D]|, net[C])`; reduce both balances; remove any that reach zero; repeat until empty
>
> This produces the minimum number of transactions for any given set of net balances.
> **When violated:** n/a — this is a calculation, not a constraint
> **Tests required:** Yes — highest-value TDD target in the system; test edge cases exhaustively

> **Rule:** settlement-sum-to-zero
> **Description:** After applying the 2% tolerance, the sum of all net balances is approximately zero. The settlement algorithm must produce transactions that resolve all debts.
> **When violated:** Programming error — the algorithm guarantees this property given valid inputs
> **Tests required:** Yes

---

### Session naming

> **Rule:** session-name-format
> **Description:** Session names are generated server-side in the format `[food-word]-[food-word]-[NNN]` where NNN is a zero-padded random three-digit number (000–999). Both words are drawn randomly (with replacement allowed) from the approved food word list below. Names are lowercase, hyphen-separated. Examples: `bacon-mango-042`, `lemon-rice-117`.
> **When violated:** n/a — names are generated, not user-supplied
> **Tests required:** Yes — format validation and uniqueness check

> **Rule:** session-name-unique
> **Description:** Session names must be globally unique (they serve as the URL key). On creation, if the generated name is already taken, a new name is generated and retried (up to 5 attempts).
> **When violated:** After 5 failed attempts, session creation fails with code `NAME_COLLISION`. Statistically negligible at any realistic scale (~6M+ combinations).
> **Tests required:** Yes

**Food word list** (easy-to-spell, easy-to-say-aloud):

```
apple, bacon, bagel, banana, bean, beef, beet, bread, butter,
cake, candy, carrot, celery, cherry, chicken, clam, cocoa, corn,
crab, cream, curry, date, duck, egg, fig, fish, fudge, grape,
guava, ham, honey, jam, kale, kiwi, lamb, leek, lemon, lime,
lobster, mango, maple, melon, mint, muffin, noodle, oat, olive,
onion, orange, pasta, peach, pear, pea, pie, pizza, plum, pork,
potato, radish, rice, roll, rye, sage, salsa, shrimp, steak,
taco, toast, tuna, turkey, turnip, waffle, walnut, yam
```

~77 words × 77 × 1000 = ~5.9M unique combinations. The list lives as a hardcoded array in the server-side name-generation utility.

---

### Players

> **Rule:** player-name-required
> **Description:** A player must have a non-empty name. Maximum 50 characters. Leading and trailing whitespace is stripped server-side.
> **When violated:** Server returns 400 with code `INVALID_PLAYER_NAME`
> **Tests required:** Yes

> **Rule:** player-name-unique-within-session
> **Description:** Player names must be unique within a session (case-insensitive comparison after trimming). Applies on both create and rename. Duplicate names are rejected.
> **When violated:** Server returns 400 with code `DUPLICATE_PLAYER_NAME`
> **Tests required:** Yes

> **Rule:** player-name-editable
> **Description:** A player's name can be updated at any time while the session is not `archived`. Renaming does not affect buy-ins, cash-out, or payment records.
> **When violated:** Server returns 400 with code `SESSION_NOT_EDITABLE` if session is `archived`
> **Tests required:** Yes

---

## Authorization rules

Auth model: **Google Sign-In required for all mutations; reads are public.** All rules are server-enforced in Server Actions. Firestore Security Rules provide a second layer (read-open, write-requires-auth).

Players are name strings — they have no auth identity. Any signed-in user may act on behalf of any player.

| Action | Allowed for | Denied for | Notes |
|---|---|---|---|
| View session / index / search | Anyone | — | Public reads; search includes all sessions |
| Create session | Any signed-in user | Unauthenticated | |
| Add player | Any signed-in user | Unauthenticated; session not `in_progress` | |
| Rename player | Any signed-in user | Unauthenticated; session `archived` | Allowed in all non-archived states |
| Add buy-in | Any signed-in user | Unauthenticated; session not `in_progress` | |
| Remove buy-in | Any signed-in user | Unauthenticated; session not `in_progress` | |
| Set cash-out | Any signed-in user | Unauthenticated; session `settled` or `archived` | Allowed in `in_progress` and `settling` |
| Move to settling | Any signed-in user | Unauthenticated; validation fails in modal | Balance and cashout constraints enforced server-side |
| Mark payment paid | Any signed-in user | Unauthenticated; session not `settling` or `settled` | Idempotent |
| Unmark payment | Any signed-in user | Unauthenticated; session not `settling` or `settled` | Auto-transitions `settled→settling` if in settled state |
| Rollback to in_progress | Any signed-in user | Unauthenticated; session not `settling` | |
| Rollback to settling | Any signed-in user | Unauthenticated; session not `settled` | Resets all payment paid marks |
| Archive session | Any signed-in user | Unauthenticated; already `archived` | Soft delete; stores `previous_status` |
| Unarchive session | Any signed-in user | Unauthenticated; session not `archived` | Restores to `previous_status` |

---

## Calculation and transformation rules

- **Currency**: all amounts stored as non-negative integers in cents (e.g., $0.25 = `25`, $10.00 = `1000`). No floating-point arithmetic on monetary values. Supports quarter-dollar games.
- **Rounding**: display layer divides cents by 100 and formats as currency (`$0.25`, `$10.00`). All server-side calculations done in integer cents.
- **2% rule**: valid range for total cash-outs is `[0.98 × total_buyin, total_buyin]`. Cash-outs can fall short by up to 2% (chip loss tolerance) but can never exceed total buy-ins.

---

## Changelog rules

Every write operation that changes session or player state must produce a `ChangeLogEntry`. This is system-enforced — no mutation is complete without its log entry.

> **Rule:** changelog-on-every-mutation
> **Description:** Every state-changing write (buy-in added/removed, cash-out set, state transition, player added/renamed, payment marked/unmarked paid, session archived/unarchived) creates a `ChangeLogEntry` with: timestamp, actor display name, action type, and a human-readable description. All mutations require sign-in, so there is always an actor name.
> **When violated:** n/a — changelog write is atomic with the primary write (same transaction)
> **Tests required:** Yes — verify log entries are created for each mutation type

> **Rule:** changelog-immutable
> **Description:** `ChangeLogEntry` records are append-only. They cannot be edited or deleted (even when the session is archived).
> **When violated:** Server rejects any attempt to modify or delete a log entry with 403
> **Tests required:** Yes

---

## Edge cases and invariants

- A session with zero players cannot transition to `settling`.
- A player with no buy-ins and no cash-out has a net balance of zero — they are excluded from settlement calculations.
- A player with no buy-ins but a cash-out set is a net creditor (unusual but valid).
- If all players have equal net balances (zero gains/losses), the settlement produces zero transactions.
- A player can owe money to multiple creditors — the algorithm may produce multiple outgoing payments for one debtor.
- Rollback from `settling → in_progress` retains payment records; they are ignored and recalculated on re-entry to `settling`.
- When session transitions `settled → settling` (via payment unmark), only the un-marked payment changes; all other payments retain their paid status.
- When session is manually rolled back `settled → settling`, ALL payment paid marks are reset to false.

## Related docs

- `02-domain-model.md`
- `04-security-threat-model.md`
- `06-api-contract.md`
- `09-test-strategy.md`

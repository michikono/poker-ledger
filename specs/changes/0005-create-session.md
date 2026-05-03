# Change 0005: Create Session

## Status
Implemented

## Owner
Michi Kono

## Goal

Allow a signed-in user to create a new poker session via a modal. The server generates a unique `food-food-NNN` name, writes the Session document, and redirects the user to `/sessions/:name`.

## Context

Spec 0004 shipped the read-only sessions index. The "New session" button on the empty state and the search row are rendered but disabled — no creation flow exists yet. This spec wires up that button and the underlying server action.

After this change, all subsequent slices (session view, add player, buy-ins, etc.) become testable end-to-end because real session data can be created locally without manual emulator pokes.

Relevant docs: `docs/01-user-flows.md` Flow 1; `docs/06-api-contract.md → createSession`; `docs/07-business-logic.md → session-name-format, session-name-unique, currency-input-parsing`; `docs/08-ux-spec.md → "Create session (modal)"`.

## User-visible behavior

1. A signed-in user clicks "New session" (on the index empty state, or on the populated index header). A modal opens.
2. The modal has one optional field: **Default buy-in** (dollar amount). Leaving it blank is allowed.
3. User clicks "Create".
    - While the request is in flight, the button shows a spinner and is disabled.
    - On success, the modal closes and the user is redirected to `/sessions/:name`.
    - On error: a toast surfaces the mapped error per `docs/08 → Error code → UI treatment`. The modal stays open.
4. `/sessions/:name` (target of the redirect) renders a minimal stub for now (header + status badge + "Coming soon" placeholder). The full session view is spec 0006.

**Validation (client-side, before sending):**
- Empty default-buy-in → omit the field from the request (`defaultBuyInCents: undefined`). Valid.
- Non-empty default-buy-in → must parse via `parseDollars` to a positive integer ≤ 2_000_000 cents. Otherwise inline error: `"Enter a valid amount, e.g., 25 or 25.00."`

**Validation (server-side):**
- Re-validate `defaultBuyInCents` (if present): integer, > 0, ≤ 2_000_000. Otherwise return `INVALID_AMOUNT`.
- Generate a unique session name. If 5 retries fail, return `NAME_COLLISION`.

## Non-goals

- **Side navigation menu.** Deferred. The "New session" button lives on the index page only for now.
- **Session view at `/sessions/:name`.** Only a stub is added (so the redirect target exists). Full view is spec 0006.
- **Add players / buy-ins / settling flow.** Those are later specs.
- **Default buy-in pre-population on add-player.** That's a spec 0007 concern; the field is stored but not yet consumed.

## Data model impact

No schema changes — the `Session` schema already accommodates everything needed (per `docs/05-data-model.md`). New documents are written with:

| Field | Value |
|---|---|
| `name` | Generated `food-food-NNN` string; equals document ID |
| `name_lower` | Same as `name` (already lowercase per the format) |
| `status` | `"in_progress"` |
| `default_buy_in_cents` | The validated input, or `null` if omitted |
| `player_count` | `0` |
| `previous_status` | `null` |
| `created_by_uid` | `decoded.uid` |
| `created_by_name` | `getActorFirstName(decoded)` per `specs/decisions/0003-auth-model.md` |
| `created_at` | `FieldValue.serverTimestamp()` |
| `updated_at` | `FieldValue.serverTimestamp()` |

Plus one `change_log` entry with `action_type = "session_created"` and `metadata = { default_buy_in_cents }` (or `{}` if omitted) per `docs/05`.

## Diagram impact

None. Flow 1 in `docs/01-user-flows.md` already describes this flow including the name-collision retry.

## API impact

Adds the `createSession` Server Action exactly as specified in `docs/06-api-contract.md → createSession`. No new endpoints.

## Security/privacy impact

- Server Action verifies a fresh Firebase ID token via `adminAuth.verifyIdToken(token)`. Session cookie alone is not sufficient.
- Writes happen via the Admin SDK only; Firestore client-write rules remain `if false` (defense-in-depth).
- `created_by_name` uses the `getActorFirstName` helper (introduced here) which never falls back to email or UID.
- No new env vars; no new secrets.

## Local development impact

- A new helper module `src/lib/auth/actor-name.ts` is added (`getActorFirstName`) — used here, will be reused by every future Server Action.
- `parseDollars` and `formatCents` modules are added (`src/lib/currency/parse.ts` and `src/lib/currency/format.ts`) — used here, will be reused.
- Session name generator (`src/lib/sessions/name.ts`) is added with the food word list and an injectable RNG.
- No new env vars or services.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | Pass |
| Lint | `npm run lint` | Yes | Yes | Pass |
| Typecheck | `npm run type-check` | Yes | Yes | Pass |
| Unit tests | `npm test` | Yes | Yes | Pass — 63 tests across 9 files |
| Build | `npm run build` | Yes | Yes | Pass — `/sessions/[name]` registered as dynamic route |
| Local smoke test | Manual | Yes | Yes | Deferred — see Implementation notes; cannot drive a browser in the implementation environment |
| Aggregate | `npm run check` | Yes | Yes | Pass |

Integration tests against the emulator: not yet configured (per `docs/16-quality-gates.md`). The collision-retry path is unit-tested with a mocked Firestore `create()`. A future spec will add emulator-based integration tests.

E2E (Playwright): not yet present. Will be added with a future spec once `/sessions/:name` is buildable end-to-end.

## Test plan

### Unit tests (TDD)

Pure functions — written test-first:

- **`generateSessionName(rng?)`** — `src/lib/sessions/name.test.ts`
    - Format matches `^[a-z]+-[a-z]+-\d{3}$`
    - Both words are drawn from the known word list
    - Same word can appear twice (e.g., `bacon-bacon-042`) — drawn with replacement
    - Deterministic when an explicit `rng` is injected
    - NNN is always zero-padded to 3 digits (e.g., `005`, not `5`)

- **`parseDollars(input)`** — `src/lib/currency/parse.test.ts`
    - Accept: `"25"` → 2500, `"$25"` → 2500, `"25.5"` → 2550, `"25.50"` → 2550, `"0.25"` → 25
    - Reject (returns null): `".25"`, `"25.555"`, `"-5"`, `""`, `"  "`, `"abc"`, `"1,000"`
    - Trims surrounding whitespace
    - Optional `$` prefix allowed

- **`formatCents(n)`** — `src/lib/currency/format.test.ts`
    - `0` → `"$0.00"`, `25` → `"$0.25"`, `1000` → `"$10.00"`, `100000` → `"$1,000.00"`
    - Negative: `-2500` → `"-$25.00"`

- **`getActorFirstName(decoded)`** — `src/lib/auth/actor-name.test.ts`
    - `name = "John Smith"` → `"John"`
    - `name = "Madonna"` → `"Madonna"`
    - `name = "Mary-Jane Smith"` → `"Mary-Jane"`
    - `name = ""` → `"Anonymous"`
    - `name` undefined → `"Anonymous"`
    - `email = "test@example.com"`, `name` missing → `"Anonymous"` (email is NEVER used)

### Server Action tests

- **`createSession`** — `src/app/(app)/sessions/actions.test.ts`
    - Returns `UNAUTHENTICATED` when token is invalid (mock `verifyIdToken` to throw)
    - Returns `INVALID_AMOUNT` when `defaultBuyInCents` is non-integer / 0 / negative / > 2_000_000
    - Returns `{ sessionId }` on success; the candidate name format is correct
    - On `create()` collision (mocked to throw `ALREADY_EXISTS` once then succeed), retries with a new name and succeeds
    - After 5 collisions, returns `NAME_COLLISION`
    - The Firestore `create()` payload includes all required fields (status, name_lower, player_count, etc.)
    - Writes the changelog entry in the same batch — assert `batch.set` was called twice (session + changelog)

### Component tests

- **`CreateSessionDialog`** — `src/app/(app)/sessions/create-session-dialog.test.tsx`
    - Opens when the trigger button is clicked
    - Submit is disabled while the action is in flight
    - Inline error shown when the parser rejects input
    - On success: `router.push` called with `/sessions/<name>`
    - On `INVALID_AMOUNT` from server: inline error shown (toast not used for input-class errors per `docs/08`)
    - On `NAME_COLLISION` from server: toast shown, modal stays open

## Acceptance criteria

- [ ] A signed-in user can click "New session" on the index empty state and create a session via the modal.
- [ ] The "New session" button on the populated index (in the search row) is also wired up to the same dialog.
- [ ] After successful creation, the user is redirected to `/sessions/:name` (which renders a stub).
- [ ] The created session appears on `/sessions` ordered first (in_progress, most recent).
- [ ] Default buy-in is optional. Empty input creates a session without a default.
- [ ] Invalid input shows an inline error and the action is not invoked.
- [ ] Server-side collision retries up to 5 times silently. After 5 failures, a toast says "Couldn't create a session — please try again."
- [ ] The session document is written with all required fields, including `name_lower = name`, `player_count = 0`, `previous_status = null`, and a `created_by_name` from `getActorFirstName`.
- [ ] A `change_log` entry with `action_type = "session_created"` is written atomically with the session.
- [ ] All quality gates pass.
- [ ] Spec conformance review completed.
- [ ] No regressions to the index page or sign-in flow.

## Rollout/deployment notes

- No new environment variables.
- Firestore rules: no change (writes are server-only via the Admin SDK; client-side read rules unchanged from spec 0004).
- No new composite indexes required.

## Implementation notes

### File layout

- `src/lib/sessions/name.ts` — `generateSessionName`, `WORDS` array
- `src/lib/sessions/name.test.ts`
- `src/lib/currency/parse.ts` — `parseDollars`
- `src/lib/currency/parse.test.ts`
- `src/lib/currency/format.ts` — `formatCents`
- `src/lib/currency/format.test.ts`
- `src/lib/auth/actor-name.ts` — `getActorFirstName`
- `src/lib/auth/actor-name.test.ts`
- `src/app/(app)/sessions/actions.ts` — `"use server"` module exporting `createSession`
- `src/app/(app)/sessions/actions.test.ts`
- `src/app/(app)/sessions/create-session-dialog.tsx` — client modal component
- `src/app/(app)/sessions/create-session-dialog.test.tsx`
- `src/app/(app)/sessions/[name]/page.tsx` — stub session view (renders header + "Coming soon")
- Update `src/app/(app)/sessions/session-list.tsx` to wire the "New session" button (replaces the disabled state with `<CreateSessionDialog />` trigger)

### Server-action shape

```ts
// src/app/(app)/sessions/actions.ts
"use server";
import { adminAuth } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { generateSessionName } from "@/lib/sessions/name";
import { getActorFirstName } from "@/lib/auth/actor-name";
import { FieldValue } from "firebase-admin/firestore";

const MAX_NAME_RETRIES = 5;
const MAX_AMOUNT_CENTS = 2_000_000;

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function createSession(
  input: { defaultBuyInCents?: number },
  token: string,
): Promise<Result<{ sessionId: string }>> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in required." } };
  }

  if (input.defaultBuyInCents !== undefined) {
    const v = input.defaultBuyInCents;
    if (!Number.isInteger(v) || v <= 0 || v > MAX_AMOUNT_CENTS) {
      return { success: false, error: { code: "INVALID_AMOUNT", message: "Invalid default buy-in." } };
    }
  }

  const actorName = getActorFirstName(decoded);
  for (let attempt = 0; attempt < MAX_NAME_RETRIES; attempt++) {
    const name = generateSessionName();
    const sessionRef = adminDb.collection("sessions").doc(name);
    const changelogRef = sessionRef.collection("change_log").doc();
    try {
      const batch = adminDb.batch();
      // .create() on Admin SDK is atomic and fails if the document exists.
      // Use batch.create where supported, else batch.set with merge:false (which still
      // overwrites). We instead do a transaction with .get() then .set() to avoid races.
      await adminDb.runTransaction(async (tx) => {
        const existing = await tx.get(sessionRef);
        if (existing.exists) throw new Error("NAME_COLLISION_RETRY");
        tx.set(sessionRef, {
          name,
          name_lower: name,
          status: "in_progress",
          default_buy_in_cents: input.defaultBuyInCents ?? null,
          player_count: 0,
          previous_status: null,
          created_by_uid: decoded.uid,
          created_by_name: actorName,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.set(changelogRef, {
          actor_uid: decoded.uid,
          actor_name: actorName,
          action_type: "session_created",
          description: `${actorName} created the session.`,
          metadata: { default_buy_in_cents: input.defaultBuyInCents ?? null },
          created_at: FieldValue.serverTimestamp(),
        });
      });
      return { success: true, data: { sessionId: name } };
    } catch (err) {
      if (err instanceof Error && err.message === "NAME_COLLISION_RETRY") continue;
      return { success: false, error: { code: "INTERNAL_ERROR", message: "Unexpected error." } };
    }
  }

  return { success: false, error: { code: "NAME_COLLISION", message: "Could not generate a unique session name." } };
}
```

### Stub session view

Just enough to make the redirect target render without 404:

```tsx
// src/app/(app)/sessions/[name]/page.tsx
import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";

export default async function SessionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const doc = await adminDb.collection("sessions").doc(name).get();
  if (!doc.exists) notFound();
  const data = doc.data()!;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <StatusBadge status={data.status} />
      </div>
      <p className="text-muted-foreground">Session view coming soon.</p>
    </div>
  );
}
```

### Client dialog (sketch)

- Use shadcn/ui `Dialog` (install via `npx shadcn@latest add dialog` if not present).
- One controlled input; on submit, call `parseDollars(input)` and either set inline error or invoke `createSession`.
- On success, `router.push(\`/sessions/\${data.sessionId}\`)`.
- Trigger lives in two places: the index empty state (replaces the disabled "New Session" button) and the populated-index search row (replaces the other disabled "New Session" button). Both reuse `<CreateSessionDialog />`.

### Currency parser regex

Per `docs/07 → currency-input-parsing`:

```ts
const RE = /^\$?\s*(\d+)(?:[.,](\d{1,2}))?\s*$/;
export function parseDollars(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = RE.exec(trimmed);
  if (!m) return null;
  const dollars = Number.parseInt(m[1], 10);
  const cents = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  return dollars * 100 + cents;
}
```

Note the regex accepts `,` as a decimal separator for forgiveness on European keyboards but does not accept thousands separators (per the spec; keeps the parser simple).

### Name generator

```ts
const WORDS = [
  "apple", "bacon", "bagel", "banana", "bean", "beef", "beet", "bread", "butter",
  // ... full list per docs/07-business-logic.md
];

export function generateSessionName(rng: () => number = Math.random): string {
  const w1 = WORDS[Math.floor(rng() * WORDS.length)]!;
  const w2 = WORDS[Math.floor(rng() * WORDS.length)]!;
  const n = Math.floor(rng() * 1000).toString().padStart(3, "0");
  return `${w1}-${w2}-${n}`;
}
```

## Open questions

None — ready for implementation upon acceptance.

## Links

- `docs/01-user-flows.md` (Flow 1)
- `docs/06-api-contract.md` (`createSession`)
- `docs/07-business-logic.md` (`session-name-format`, `session-name-unique`, `currency-input-parsing`)
- `docs/08-ux-spec.md` ("Create session (modal)" and "Error code → UI treatment")
- `specs/decisions/0003-auth-model.md` (`getActorFirstName` fallback rules)
- `specs/changes/0004-sessions-index-page.md` (deferred-button predecessor)

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved for implementation. |
| 2026-05-02 | In Progress | Implementation started. Spec 0004 (sessions index) was never implemented; the existing `sessions/page.tsx` is a stub from spec 0001, so the dialog trigger is wired into that page directly instead of into the missing `session-list.tsx`. shadcn/ui Dialog deferred — using a native `<dialog>` element to avoid pulling in Tailwind/shadcn as new deps in this slice. |
| 2026-05-02 | Implemented (premature) | Initial pass marked Implemented after `npm run check` passed (63 tests). Smoke test deferred. Implementation built on top of pre-spec-0004 main: native `<dialog>` instead of shadcn, custom `StatusBadge`, dialog wired into the stub `sessions/page.tsx`. Reverted below — the worktree was stale. |
| 2026-05-02 | In Progress (rebase) | While smoke-testing, discovered the user was hitting the main repo's dev server on port 3001 (which has spec 0004 but no `createSession`), not this worktree on 3005 — that's why every UI change appeared to do nothing. Root cause: this worktree was branched at `d80c198` *before* PR #11 (spec 0004) merged to `main`, so the spec 0005 implementation was built against the wrong base. Rebased `feature/0005-create-session` onto current `main` (now also contains specs 0006 and 0007). Conflicts resolved in `sessions/page.tsx` (kept main's RSC + `SessionList` version) and `components/status-badge.tsx` (kept main's `Badge`-backed version). Reworked the dialog to use shadcn `Dialog`/`Button`/`Input`/`Label` (installed `dialog` and `label` via `npx shadcn@latest add`). Wired `<CreateSessionDialog />` into `session-list.tsx` replacing both `<Button disabled>New Session</Button>` placeholders — finally satisfying the original spec text. |
| 2026-05-02 | Implemented | Smoke test surfaced one final bug: `auth.currentUser` was `null` immediately after page load because the Firebase JS client restores its user from IndexedDB asynchronously — my code read `currentUser` synchronously and fell into the "no token" branch, which redirected to `/sign-in`, and the proxy then bounced back to `/sessions` (looked like a "page refresh"). Fixed by `await auth.authStateReady()` before reading `currentUser`. User confirmed the create-session flow now works end-to-end (modal opens, submit redirects to `/sessions/<food-food-NNN>`). All 250 tests pass; `npm run check` is green. **Outstanding deviations:** (1) toast for `NAME_COLLISION` rendered as an inline `role="alert"` block inside the dialog (no toast library yet); (2) docs/07 word list is 74 entries despite the prose claiming 73 — implementation uses all 74; doc fix is a follow-up. |

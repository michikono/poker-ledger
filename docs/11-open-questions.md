# 11 — Open Questions

> This file tracks unresolved decisions that must be answered before the design baseline is accepted or before specific implementation slices begin.

## How to use this file

- Add questions as they arise during design doc work.
- Assign an owner and target resolution date where possible.
- When a question is resolved, mark it resolved and link to the doc or ADR where the decision is captured.
- Do not begin implementation while questions marked **blocks implementation** remain open.

---

## Open

_No open questions. Design baseline is ready for Phase 1._

---

## Resolved

> **Q:** What is the authentication model for MVP?
> **Resolution:** Model (b) — Google Sign-In (Firebase Auth) required for all mutations; reads are public. Players are tracked by name only (not by auth account), so non-app-users can still be tracked. The changelog always has a named actor. Confirmed 2026-05-02.

---

> **Q:** Are monetary amounts stored in cents (integer) or dollars (float)?
> **Resolution:** Integer cents. $0.25 = `25`. All monetary values stored as non-negative integers in cents. Display layer formats as currency. No floating-point arithmetic on monetary values. Confirmed 2026-05-02.

---

> **Q:** Who can delete a session, and from which states?
> **Resolution:** Any signed-in user can archive any session from any state. Deletion is a soft delete — sessions move to `archived` state, not hard-deleted. Confirmed 2026-05-02.

---

> **Q:** Who can mark a payment as "paid"?
> **Resolution:** Any signed-in user (auth model B — all mutations require sign-in). Confirmed 2026-05-02.

---

> **Q:** Is the change log visible in the UI, or is it internal/audit-only?
> **Resolution:** Visible in the UI. Shown at the bottom of the session view, below the player table. Confirmed 2026-05-02.

---

> **Q:** When rolling back session state, what happens to existing payment records?
> **Resolution:** Nothing is wiped. Payment records are retained. When rolling back `settled → settling`, paid marks are reset to false. When rolling back `settling → in_progress`, payment records are retained but ignored; they are recalculated on the next transition to settling. Confirmed 2026-05-02.

---

> **Q:** Are archived sessions visible in the UI, and can they be unarchived?
> **Resolution:** Yes — "Archived" is the 6th item in the side menu. Unarchive restores the session to its pre-archive status (stored as `previous_status` on the Session document). Confirmed 2026-05-02.

---

> **Q:** What is the food word list for session name generation?
> **Resolution:** Fixed hardcoded array of easy-to-spell common food words (see `07-business-logic.md`). Format: `[word]-[word]-[NNN]`. Up to 5 server-side retries on name collision. Confirmed 2026-05-02.

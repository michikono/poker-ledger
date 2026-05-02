# 12 — MVP Scope

> Status: Frozen — 2026-05-02. Changes require a scope change note with justification.

## Purpose

Define exactly what is in and out of scope for the initial release. A frozen scope doc is the primary guardrail against feature creep.

---

## MVP definition

**The MVP is done when:**
- [ ] A session can be created, a user can be added, a buy in is set, the balances can be settled.
- [ ] Balance calculations are correct as buy ins are changed, cash outs are modified, and amounts are settled.

---

## In scope

- [ ] The Index page shows a list of games ordered by status and then most recent first. The status ordering is: 1. Games in session 2. Games that are settling 3. Games that are settled. Within those, most recent to least recent.
- [ ] Ability to start a gaming session. The session's name is the URL to the session. 
- [ ] When starting a session, the creator can set a default buy-in amount, which is assumed whenever a new player is added. 
- [ ] Sessions have four states: `in_progress`, `settling`, `settled`, and `archived`. `archived` is a soft-delete — sessions are hidden from the index but not hard-deleted.
- [ ] Players can add themselves or each other inside an in progress session.
- [ ] Players must have a name assigned when created (e.g., "Billy", "Joe"). Names can be edited after creation in any non-archived session state.
- [ ] Players can add additional buyins while the session is in progress, which tracks their total buy in.
- [ ] Anybody can attempt to mark the session as settling (button always enabled when players exist). A modal opens where cash-out amounts for each player can be entered or confirmed (prefilled with any prior data).
- [ ] A session cannot move into settling state unless: total cash-outs ≤ total buy-ins, and the shortfall is ≤ 2% of total buy-ins. The 2% tolerance accounts for real-world chip loss. Cash-outs can never exceed total buy-ins.
- [ ] A session once marked Settling no longer allows players to update or add new buy-ins, but it does allow them to edit their final amounts. 
- [ ] Once in a settling state, the application will show the minimum number of transactions necessary to settle all balances so that everybody who lost money knows who to pay who made money. 
- [ ] Each player or players can mark that they have paid what they owe to their recipient. Payments can also be un-marked (toggled back to unpaid).
- [ ] Once all payments are marked as completed, the session automatically moves to settled state immediately — no confirmation dialog.
- [ ] If any payment is un-marked while the session is settled, the session automatically transitions back to settling.
- [ ] All changes are tracked in a change log shown in the UI at the bottom of the session view.
- [ ] Session status can be moved back if a player chooses (settling → in_progress, settled → settling). Rolling back never deletes records; paid marks are reset when rolling back from settled.
- [ ] Any session can be soft-deleted (archived) from any state with a confirmation. Archived sessions are hidden from the index.

## Out of scope (explicitly deferred)

- [ ] The system will not facilitate any explicit money movement, nor currency conversions, nor crypto. 
- [ ] This system will not support any other game except poker. 

## Scope change process

If a scope change is proposed during Phase 1:
1. Document the proposed change and its justification here.
2. Assess impact on accepted change specs.
3. Get explicit agreement before proceeding.
4. Update affected change specs and this doc.

## Scope change log

| Date | Change | Justification | Decision |
|---|---|---|---|
| | | | |

## Related docs

- `00-product-brief.md`
- `11-open-questions.md`
- `08-ux-spec.md`

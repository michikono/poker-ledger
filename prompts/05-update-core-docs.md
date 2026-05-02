# Prompt: Update Core Docs

Paste this after an implementation is accepted, to bring durable docs up to date.

---

The following change spec has been implemented and accepted:

**Spec:** `specs/changes/[NNNN-name].md`

Your job is to update the durable docs in `/docs/` to reflect the current state of the system. Do not add speculative content — only document what is actually true now.

For each relevant doc, check whether it needs updating:

- `docs/03-architecture.md` — Does the architecture reflect what was built?
- `docs/05-data-model.md` — Does the schema reflect what was implemented?
- `docs/06-api-contract.md` — Does the API contract reflect the implemented endpoints?
- `docs/07-business-logic.md` — Are all implemented business rules documented?
- `docs/08-ux-spec.md` — Does the UX spec reflect the implemented screens and behaviors?
- `docs/09-test-strategy.md` — Does the test strategy reflect the tests that now exist?
- `docs/10-deployment-ops.md` — Do the deployment docs reflect any new env vars or deployment steps?
- `docs/15-local-development.md` — Does the local dev doc reflect the current setup steps?
- `docs/16-quality-gates.md` — Are all implemented gates documented?

For each doc that needs updating:
1. Describe what needs to change and why.
2. Wait for confirmation before editing.
3. Edit the doc to reflect current reality.

Also check mermaid diagrams in each updated doc:

- `docs/01-user-flows.md` — do the flowcharts still match the implemented flows?
- `docs/02-domain-model.md` — does the erDiagram still match the implemented entities?
- `docs/03-architecture.md` — does the component graph still match the implemented architecture?
- `docs/05-data-model.md` — does the schema erDiagram still match the current schema?
- `docs/06-api-contract.md` — do the sequenceDiagrams still match the implemented endpoints?

For each diagram that is stale:
1. Describe the specific nodes, edges, or sequences that need to change.
2. Wait for confirmation before editing.
3. Update the diagram so it matches current reality exactly.

A diagram that contradicts its prose is a bug. Do not leave them out of sync.

Also:
- Mark the change spec as `Implemented` in its Status and Status History sections.
- If any ADRs were made during implementation, ensure they are created in `/specs/decisions/`.
- Check `docs/11-open-questions.md` — have any open questions been resolved by this implementation? Close them with resolution notes.

Do not speculate about future work. Only document current state.

# Change NNNN: <name>

## Status
Proposed

## Owner

## Goal

<!--
One sentence: what user-visible outcome does this change achieve?
-->

## Context

<!--
Why is this change needed now? What docs or decisions led here?
Reference relevant /docs files and ADRs.
-->

## User-visible behavior

<!--
What does the user experience after this change? Be specific.
Think in terms of user flows, not implementation.
-->

## Non-goals

<!--
What is explicitly NOT in scope for this change?
Be specific — vague non-goals invite scope creep.
-->

## Data model impact

<!--
Does this change require schema changes? New tables, columns, indexes, migrations?
If yes, describe them and reference docs/05-data-model.md.
-->

## Diagram impact

<!--
Which mermaid diagrams in /docs need to be created or updated as a result of this change?
Be explicit — diagrams that become stale are worse than no diagram.

Examples:
- docs/02-domain-model.md — erDiagram: add [EntityName]
- docs/03-architecture.md — graph: add [ComponentName] node
- docs/05-data-model.md — erDiagram: add [table] and FK relationship
- docs/06-api-contract.md — sequenceDiagram: add [endpoint] flow
- docs/01-user-flows.md — flowchart: add [FlowName] branch

If no diagrams are affected, write "None."
-->

## API impact

<!--
Does this change add, modify, or remove API endpoints or contracts?
If yes, describe the change and reference docs/06-api-contract.md.
-->

## Security/privacy impact

<!--
Does this change affect auth, authorization, data exposure, or secrets handling?
Reference docs/04-security-threat-model.md if relevant.
-->

## Local development impact

<!--
Does this change affect local setup, environment variables, or local-only behavior?
If yes, describe what must be updated and update docs/15-local-development.md.
-->

## Quality gates

Required gates for this change:

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run typecheck` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Integration tests | `npm run test:integration` | Where feasible | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

If any gate is unavailable, document why and when it will be introduced:

<!--
Example: Integration tests not yet configured. Will be introduced in Change 0005.
-->

## Test plan

<!--
What tests will be written for this change?
Specify: which behaviors are unit tested, which are integration tested, what is excluded and why.
TDD approach for any pure logic, validation, or authorization rules.
-->

## Acceptance criteria

<!--
Checklist of specific, verifiable outcomes that define "done."
Each item should be unambiguous — either it passes or it doesn't.
-->

- [ ] ...
- [ ] ...
- [ ] All quality gates pass (or failures documented with remediation plan)
- [ ] Spec conformance review completed
- [ ] Relevant docs updated

## Rollout/deployment notes

<!--
Any deployment considerations: migration timing, env vars to set, feature flags, etc.
-->

## Implementation notes

<!--
Guidance for the implementer: suggested approach, known pitfalls, file locations, order of operations.
Keep this honest — if you don't know, say so.
-->

## Open questions

<!--
Unresolved questions that must be answered before or during implementation.
If a question is blocking, resolve it before marking Accepted.
-->

## Links

<!--
Relevant docs, ADRs, prior specs, GitHub issues, etc.
-->

- `docs/` — (relevant docs)
- `specs/decisions/` — (relevant ADRs)

## Status history

| Date | Status | Notes |
|---|---|---|
| | Proposed | Initial draft |

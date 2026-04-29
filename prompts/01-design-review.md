# Prompt: Design Review

Paste this into Claude Code when the design docs are drafted and you want an adversarial review before Phase 1 begins.

---

Review the design docs in `/docs/` adversarially. Your job is to find problems, not validate the design. Be skeptical.

Use the review template at `/templates/design-review-template.md` as your output structure.

Work through each of the following:

1. **Ambiguity** — Find statements that could be interpreted in multiple ways. A developer reading this would make different assumptions.

2. **Contradictions** — Find places where two docs say different things, or where a doc contradicts itself.

3. **Missing edge cases** — Find scenarios not covered by the user flows or business logic. Think about: empty states, partial failures, concurrent operations, permission boundaries, invalid input, rate limits.

4. **Hidden product decisions** — Find statements that assume a product decision has been made but hasn't been explicitly stated. These are dangerous — implementation will proceed on an assumption the product owner never made.

5. **Security assumptions** — Find security requirements that are implied but not stated. Find security controls that are assumed but not designed (e.g., "only authorized users can do X" with no design for how authorization is enforced).

6. **Local development assumptions** — Find anything that would make the app difficult or impossible to run locally. Flag dependencies on deployed infrastructure.

7. **Missing deterministic gates** — Find behaviors in the docs that have no clear test strategy. Every business rule should be testable.

8. **Unnecessary scope** — Find features or complexity in the design that are not required for MVP. Flag everything that could be cut.

9. **Implementation risk** — Find design decisions that will be disproportionately hard to implement, change later, or test.

10. **Missing diagrams** — Find docs that describe relationships, flows, data structures, or architecture where a mermaid diagram would materially reduce ambiguity. Flag each one with a recommendation for diagram type (`flowchart`, `erDiagram`, `sequenceDiagram`, `graph`, `stateDiagram-v2`).

For each finding:
- Rate it: **Blocking** (must resolve before Phase 1) or **Advisory** (should resolve)
- Reference the specific doc and section
- Propose a resolution or add it to `docs/11-open-questions.md`

Do not write application code. Do not implement fixes. Output findings only.

At the end, give an overall verdict: is the design baseline ready for Phase 1, or must blocking issues be resolved first?

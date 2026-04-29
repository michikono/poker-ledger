# Prompt: Initial Design Docs

Paste this into Claude Code when you are ready to fill the upfront design docs. Replace the product description placeholder with your actual product description.

---

I am going to describe a product to you. Your job is to fill the design docs in `/docs/` based on this description. Do not write any application code. Do not scaffold any framework. Do not install any dependencies. Do not make any product decisions that I have not explicitly described — instead, note them as open questions in `docs/11-open-questions.md`.

Here is my product description:

> [REPLACE WITH YOUR PRODUCT DESCRIPTION]

Work through the following docs in order. For each doc, fill in what you can from my description. Where information is missing or ambiguous, add it to `docs/11-open-questions.md` rather than assuming.

Docs to fill:

1. `docs/00-product-brief.md` — restate the product in your own words, identify the target users, and list any missing decisions as open questions.
2. `docs/01-user-flows.md` — identify the primary user flows. Each flow must be named, have clear steps, and note auth requirements.
3. `docs/02-domain-model.md` — identify the core entities, their attributes, and relationships. List invariants for each entity.
4. `docs/03-architecture.md` — propose a high-level architecture. Note where you are assuming rather than deciding. Any durable decision should be flagged as an ADR candidate.
5. `docs/04-security-threat-model.md` — identify the trust boundaries, sensitive assets, and obvious threat vectors. Do not over-design — focus on the most likely risks.
6. `docs/05-data-model.md` — propose a data schema based on the domain model. Note schema decisions that need to be confirmed.
7. `docs/06-api-contract.md` — sketch the API surface derived from the user flows. Note where contracts are unclear.
8. `docs/07-business-logic.md` — identify the business rules that must be enforced. Format each rule so it can drive a test.
9. `docs/08-ux-spec.md` — describe the screens and user interactions at a functional level. Do not design aesthetics — focus on behavior and states.
10. `docs/09-test-strategy.md` — propose the test strategy based on the business logic and flows identified.
11. `docs/12-mvp-scope.md` — based on the description, propose what is in and out of scope for MVP. Be aggressive about cutting scope.

After filling each doc, stop and let me review it before continuing to the next, unless I tell you to proceed in batch.

Rules:
- Do not write application code.
- Do not scaffold any framework.
- Do not install dependencies.
- Do not make decisions I haven't described — add open questions instead.
- Flag every assumption you are making.
- Prefer short, decision-focused docs over long, descriptive ones.

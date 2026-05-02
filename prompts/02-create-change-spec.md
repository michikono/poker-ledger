# Prompt: Create Change Spec

Paste this into Claude Code when you are ready to create a new change spec from the accepted design docs.

---

I want to create a change spec for the following implementation slice:

> [DESCRIBE THE SPECIFIC SLICE — e.g., "Set up the Next.js project shell with TypeScript, Tailwind, and basic routing"]

Use `/templates/change-spec-template.md` as the template.

Rules:
- This spec must cover exactly one focused slice of work. If you think the scope is too broad, say so and propose a split.
- Derive the spec from the accepted design docs in `/docs/`. Reference specific docs where relevant.
- Be explicit about non-goals. Anything not in the spec is out of scope.
- Include explicit acceptance criteria that are each individually verifiable (pass/fail, not subjective).
- Include a test plan. Identify what must be TDD, what can be test-alongside, and what is excluded from tests and why.
- Include the quality gates section with expected pass/fail for every gate. If a gate is not yet configured, note it and define when it will be introduced.
- Include security/privacy impact, local development impact, and data/API impact even if the answer is "none."
- Assign a status of `Proposed`.

Do not write application code.

After you draft the spec, review it against these criteria:
- Is the scope small enough to implement and review in one focused session?
- Are all acceptance criteria unambiguous and individually verifiable?
- Is there a clear test strategy?
- Are quality gates explicit?
- Are non-goals explicit?

Output the spec as a markdown file. I will save it to `/specs/changes/NNNN-<name>.md`.

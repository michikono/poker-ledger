# Prompt: Implement Change Spec

Paste this into Claude Code when you are ready to implement an accepted change spec. Replace the spec path placeholder.

---

I want you to implement the following accepted change spec:

**Spec:** `specs/changes/[NNNN-name].md`

Before you write any code:
1. Read the spec fully.
2. Read all docs linked in the spec.
3. Summarize the files you intend to create or modify and the approach you will take. Wait for my confirmation before proceeding.

Implementation rules:
- Implement exactly what the spec says. No more, no less.
- If the spec is ambiguous, stop and ask — do not assume.
- If implementation reveals the spec is wrong, stop and describe the conflict. Do not improvise a fix.
- Do not expand scope. If you identify something useful that's not in the spec, note it as a future spec candidate.
- Follow TDD for any pure logic, validation, authorization, or calculation code: write the test first.
- Run tests after each logical unit of work, not just at the end.

During implementation:
- Commit in small, coherent units. Each commit should do one thing.
- Do not commit broken or failing code (unless a work-in-progress commit is explicitly needed).
- Run `npm run check` before declaring work complete.

After implementation:
- Run the full quality gate suite and report results.
- Compare your implementation to the spec's acceptance criteria — check each one explicitly.
- If any gate fails, document the failure and propose a remediation before stopping.
- Update the change spec status to `In Progress` (or `Implemented` if complete and all gates pass).
- List any docs in `/docs/` that need to be updated based on what was implemented.

Do not mark this change complete until:
- [ ] All quality gates pass (or failures are documented with remediation)
- [ ] All acceptance criteria are met
- [ ] Spec conformance review is done
- [ ] Docs are updated or flagged for update

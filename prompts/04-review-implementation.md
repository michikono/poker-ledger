# Prompt: Review Implementation

Paste this into Claude Code after implementation is complete, to verify the change before declaring it done. Do NOT make changes during this review — review only.

---

Review the implementation of the following change spec against the accepted spec. Do not make any changes during this review.

**Spec:** `specs/changes/[NNNN-name].md`

Work through each of the following:

1. **Spec conformance** — Compare the implementation to each acceptance criterion in the spec. Mark each criterion: Met / Not Met / Partially Met.

2. **Scope check** — Did the implementation stay within the spec? List any changes that appear to be out of scope.

3. **Test coverage** — Does the implementation include the tests described in the spec's test plan? Are TDD requirements satisfied? List any missing tests.

4. **Quality gates** — Did all required gates pass? List any gates that failed or were not run, with their current status.

5. **Security** — Does the implementation match the security/privacy requirements in the spec? Are there any new risks introduced that weren't in the spec?

6. **Local development** — Does the implementation leave local development working? Are any new environment variables documented in `.env.example`?

7. **Complexity** — Is there unnecessary complexity, over-engineering, or code that could be simpler? Note specifics.

8. **Doc drift** — Are there docs in `/docs/` that now describe an outdated state? List which docs need updating.

Output:
- A finding for each category above
- An overall verdict: **Ready to merge** / **Needs changes before merge**
- A list of required changes (if any) before the change spec can be marked `Implemented`

Do not fix anything. Output findings only.

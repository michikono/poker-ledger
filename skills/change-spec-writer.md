# Skill: Change Spec Writer

## Purpose

Turn an accepted design doc section or implementation intent into a well-formed, focused change spec that can be safely implemented.

## When to use

- When a design doc section is accepted and ready to become a first implementation slice
- When breaking a large feature into smaller, sequenced change specs
- When a spec needs to be rewritten due to scope or ambiguity issues

## Inputs expected

- The implementation intent (described in natural language or referencing specific doc sections)
- The relevant design docs (architecture, domain model, UX spec, API contract, etc.)
- Any constraints (timeline, dependencies on other specs, tech choices)

## Output format

A complete change spec using `/templates/change-spec-template.md`, including:

- Status: `Proposed`
- Goal (one sentence, user-visible outcome)
- Context (why now, what docs led here)
- User-visible behavior (specific, not implementation-level)
- Non-goals (explicit list — anything not mentioned is out of scope)
- Data model impact
- API impact
- Security/privacy impact
- Local development impact
- Quality gates (explicit table with pass/fail criteria for each gate)
- Test plan (TDD targets, test-alongside targets, exclusions with justification)
- Acceptance criteria (each must be unambiguous and individually verifiable)
- Open questions (anything that must be resolved before Accepted status)

## Hard rules

- One slice only. If the scope is too broad, split it and explain the split.
- Acceptance criteria must be verifiable — not "the UI looks good" but "clicking Submit with valid input creates a record and redirects to the list page."
- Every change spec must include a test plan. TDD must be used for pure logic, validation, authorization, and calculations.
- Every change spec must include explicit quality gates. If a gate is not yet available, document why and when it will exist.
- Non-goals must be explicit and specific.
- Do not assume a spec is ready for implementation. Flag open questions.
- Do not write implementation code.

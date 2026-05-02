# Skill: Implementation Planner

## Purpose

Break an accepted change spec into a concrete, ordered implementation plan before writing any code.

## When to use

- After a change spec reaches `Accepted` status
- Before starting implementation on a complex spec
- When a spec covers multiple files or systems and execution order matters

## Inputs expected

- The accepted change spec
- Relevant design docs referenced in the spec
- Current codebase state (what files already exist)

## Output format

A complete implementation plan using `/templates/implementation-plan-template.md`, including:

- Files to create (with purpose)
- Files to modify (with what changes and why)
- Files to delete (with justification)
- Tests to write (TDD-ordered: test first, then implementation)
- Quality gates to run at each stage
- Local verification steps
- Implementation order (small, commit-able steps)
- Risks (likelihood, impact, mitigation)
- Rollback notes

## Hard rules

- TDD steps must be listed explicitly: "Write test for [behavior], then implement [behavior]."
- The plan must be granular enough that each step can be a distinct, reviewable commit.
- If the spec is ambiguous at the planning stage, raise the ambiguity rather than resolving it silently.
- If the plan reveals scope is larger than the spec suggests, flag it and propose a spec update before proceeding.
- Do not write implementation code during planning.
- Every file touched must be justified by the spec.

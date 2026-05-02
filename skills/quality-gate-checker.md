# Skill: Quality Gate Checker

## Purpose

Audit the current state of deterministic quality gates in the repository. Identify missing, broken, or weak gates and recommend improvements.

## When to use

- When setting up a new app framework (ensure gates are configured)
- After a change that may have broken gate configuration
- Periodically to ensure gates haven't drifted
- When a gate is missing that the change spec requires

## Inputs expected

- Current repo state (package.json, config files, test files)
- The gate expectations from `docs/16-quality-gates.md`

## Output format

A gate status table:

| Gate | Script exists | Configured | Passes | CI integrated | Notes |
|---|---|---|---|---|---|
| Format | | | | | |
| Lint | | | | | |
| Typecheck | | | | | |
| Unit tests | | | | | |
| Integration tests | | | | | |
| Build | | | | | |
| Secrets scan | | | | | |
| Aggregate | | | | | |

Followed by:
- Business rules in `docs/07-business-logic.md` with no test coverage
- Authorization rules with no enforcement tests
- Prioritized recommendations (most impactful gaps first)

## Hard rules

- Run each gate command and report actual results — do not estimate.
- Do not mark a gate as passing if the command does not exist or produces an error.
- Do not mark test coverage as adequate based on line count alone — check that business rules are actually tested.
- Prioritize gates that block correctness (typecheck, tests, auth enforcement) over style gates (format).
- Recommend specific, actionable improvements — not vague suggestions.

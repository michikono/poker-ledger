# Prompt: Quality Gate Review

Paste this into Claude Code to inspect the current state of deterministic quality gates in the repository.

---

Inspect the repository and produce a complete quality gate report.

For each gate defined in `docs/16-quality-gates.md`:

1. **Existence** — Does the gate script exist in `package.json`?
2. **Configuration** — Is the tool configured (e.g., does a config file exist: `.eslintrc`, `prettier.config.js`, `tsconfig.json`, etc.)?
3. **Execution** — Can the gate be run successfully right now? Run it and report the result.
4. **Coverage** — For tests: are there tests? Are they testing meaningful behavior (business logic, auth, validations)?
5. **CI integration** — Is the gate run in CI (GitHub Actions or similar)?

Output a table:

| Gate | Script exists | Configured | Runs | Passes | CI integrated | Notes |
|---|---|---|---|---|---|---|
| Format | | | | | | |
| Lint | | | | | | |
| Typecheck | | | | | | |
| Unit tests | | | | | | |
| Integration tests | | | | | | |
| Build | | | | | | |
| Secrets scan | | | | | | |
| Aggregate (`check`) | | | | | | |

Also identify:
- Business rules in `docs/07-business-logic.md` that have no corresponding tests
- Auth/authorization rules that have no enforcement tests
- Any critical user flows with no deterministic coverage

Output prioritized recommendations for the most impactful gate gaps to close, with specific suggestions for each.

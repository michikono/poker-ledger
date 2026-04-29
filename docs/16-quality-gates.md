# 16 — Quality Gates

> This doc defines the deterministic quality gates for this project: what they are, when they run, and what blocks completion or merge.

---

## Philosophy

- Deterministic gates are non-negotiable. If a gate fails, the change is not done.
- Gates should be automated as soon as the app framework exists.
- If a gate is temporarily unavailable (tooling not yet set up), the change spec must document why and define when it will be introduced.
- Percentage-based coverage targets are secondary to meaningful test coverage of business rules.
- Claude must not claim a change is complete until all required gates pass or failures are explicitly documented with a remediation plan.

---

## Gate definitions

### Formatting check

**Command:** `npm run format:check`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** (TBD — e.g., Prettier)
**Status:** Not yet configured
**Notes:** Auto-fix with `npm run format`; check must be non-destructive

---

### Linting

**Command:** `npm run lint`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** (TBD — e.g., ESLint)
**Status:** Not yet configured

---

### Typechecking

**Command:** `npm run typecheck`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** TypeScript compiler (`tsc --noEmit`)
**Status:** Not yet configured

---

### Unit tests

**Command:** `npm test`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** (TBD — e.g., Vitest, Jest)
**Status:** Not yet configured
**Coverage:** Meaningful coverage of business logic required. See `09-test-strategy.md`.

---

### Integration tests

**Command:** `npm run test:integration` (TBD)
**Blocks local completion:** No (where impractical)
**Blocks merge:** Yes where feasible
**Tool:** (TBD)
**Status:** Not yet configured

---

### Build check

**Command:** `npm run build`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** Framework build (e.g., Next.js)
**Status:** Not yet configured

---

### Security / secrets scan

**Command:** (TBD — e.g., `npm run secrets:check`)
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** (TBD — e.g., trufflesecurity/trufflehog, gitleaks)
**Status:** Not yet configured
**Notes:** At minimum, do a manual `git log -p | grep -i secret` before push

---

### Local smoke test

**Definition:** Developer runs the app locally and manually verifies core user flows work end-to-end.
**Blocks local completion:** Yes
**Blocks merge:** Yes (implicitly — if local smoke fails, don't push)

---

### Aggregate gate

**Command:** `npm run check`
**Definition:** Runs format:check + lint + typecheck + test + build in sequence
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Status:** Not yet configured — will be added once app framework exists

---

## TDD expectations

- Use TDD (red → green → refactor) for: pure logic, validation, authorization, calculations, data transformations.
- Use test-first or test-alongside for: API behavior.
- UI: test critical flows; lighter coverage on static content initially.
- Do not TDD scaffolding or trivial boilerplate.
- Every change spec must define its test strategy before implementation begins.

---

## Handling temporarily missing gates

If a gate does not yet exist when a change spec is implemented:

1. Note the missing gate in the change spec's Quality Gates section.
2. Document why it is not yet available.
3. Create a follow-up change spec (or chore entry) to add the gate.
4. Do not treat the absence as permanent — track it to resolution.

---

## CI integration

Once GitHub Actions is set up:
- All gates run on every PR push.
- Merge to `main` is blocked if any gate fails.
- Gate configuration lives in `.github/workflows/`.

---

## Related docs

- `09-test-strategy.md`
- `13-dev-lifecycle.md`
- `14-release-process.md`

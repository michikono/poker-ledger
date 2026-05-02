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
**Tool:** Biome
**Auto-fix:** `npm run format`
**Notes:** Non-destructive check only — the fix command is separate

---

### Linting

**Command:** `npm run lint`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** Biome
**Auto-fix:** `npm run lint:fix`

---

### Typechecking

**Command:** `npm run typecheck`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** TypeScript compiler (`tsc --noEmit`)
**Notes:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` — no `any`

---

### Unit tests

**Command:** `npm test`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** Vitest
**Coverage:** Full coverage of business logic required. Settlement calculation must be 100%. See `09-test-strategy.md`.
**Notes:** Tests run against pure functions or with `vi.mock()` — no emulator required

---

### Integration tests (data layer)

**Command:** `npm run test:integration`
**Blocks local completion:** No (impractical to always run locally)
**Blocks merge:** Yes
**Tool:** Vitest + Firebase emulator
**Notes:** Requires the Firebase emulator running. CI starts the emulator automatically.

---

### E2E tests

**Command:** `npm run test:e2e`
**Blocks local completion:** No (requires full dev server)
**Blocks merge:** Yes (critical flows)
**Tool:** Playwright
**Notes:** Requires `npm run dev` running locally. CI starts the full stack.

---

### Build check

**Command:** `npm run build`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** Next.js (`next build`)

---

### Security / secrets scan

**Command:** Manual — `git log -p | grep -iE 'password|secret|token|key|credential' | grep -v '\.example'`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Notes:** Automated scan (e.g., gitleaks) to be added once CI is configured. Until then, manual review before every push.

---

### Local smoke test

**Definition:** Developer runs the app locally and manually verifies core user flows work end-to-end.
**Blocks local completion:** Yes
**Blocks merge:** Yes (implicitly — if local smoke fails, don't push)
**Flows to verify:**
1. Create a session → confirm it appears on the index
2. Add players to the session
3. Record buy-ins for each player
4. Set cash-out amounts and verify balance delta
5. Move session to settling
6. Verify settlement transactions are correct
7. Mark payments as paid → verify auto-settle

---

### Aggregate gate

**Command:** `npm run check`
**Definition:** `format:check && lint && typecheck && test && build` (sequential)
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Notes:** Integration and E2E tests are run separately in CI, not in the aggregate local gate (they require the emulator/server)

---

## TDD expectations

- Use TDD (red → green → refactor) for: pure logic, validation, authorization, calculations, data transformations.
- Use test-first or test-alongside for: Server Actions and API behavior.
- UI: test critical flows with Playwright; lighter coverage on static content initially.
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

GitHub Actions runs on every PR push:

- Unit tests (`npm test`)
- Integration tests (`npm run test:integration`) — emulator started in CI using `demo-poker-ledger`
- E2E tests (`npm run test:e2e`) — full stack started in CI
- Format check, lint, typecheck, build
- Merge to `main` is blocked if any gate fails
- Gate configuration lives in `.github/workflows/ci.yml`

---

## Related docs

- `09-test-strategy.md`
- `13-dev-lifecycle.md`
- `14-release-process.md`

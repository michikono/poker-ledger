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
**Notes:** Tests run against pure functions or with `vi.mock()` — no emulator required. The Firestore rules suite (`firestore-rules.test.ts`) is intentionally excluded from this run and runs separately under "Firestore rules tests" below.

---

### Firestore rules tests

**Command:** `npm run test:rules`
**Blocks local completion:** Yes when `firestore.rules` changes
**Blocks merge:** Yes when `firestore.rules` changes
**Tool:** Vitest + `@firebase/rules-unit-testing` against the Firestore emulator
**Notes:** Uses a dedicated Vitest config (`vitest.rules.config.ts`). Requires the Firestore emulator on the default port `8080`. CI runs this in the `Firestore Rules Tests` job, which starts an emulator-only Firestore via `firebase-tools`. The job is a required check on PRs that touch `firestore.rules`.

---

### Integration tests (data layer)

**Command:** `npm run test:integration` *(not yet configured — see "Current state of CI" below)*
**Blocks local completion:** No (impractical to always run locally)
**Blocks merge:** Yes once configured
**Tool:** Vitest + Firebase emulator
**Notes:** Requires the Firebase emulator running. The Vitest config splits unit and integration suites by file pattern (`*.test.ts(x)` for unit, `*.integration.test.ts` for integration). Until the integration script is added, integration-style tests should be authored as `*.integration.test.ts.todo` placeholders or guarded with a `describe.skip`.

---

### E2E tests

**Command:** `npm run test:e2e`
**Blocks local completion:** No (requires full dev server)
**Blocks merge:** Yes (critical flows) once CI is configured
**Tool:** Playwright
**Notes:** Requires `npm run dev` running locally. CI (when added) starts the full stack. Currently no Playwright tests exist — they will be added with the first feature spec that produces a complete user-facing flow.

---

### Build check

**Command:** `npm run build`
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** Next.js (`next build`)

---

### Security / secrets scan

**Current:** manual eyeball review of `git diff` and `git log -p` for the new commits before push. The earlier prescribed grep (`git log -p | grep -iE 'password|secret|token|key|credential'`) generates false positives on words like "tokenize" and is unreliable; it should not be relied on as a gate.
**Recommended (future):** add `gitleaks` to CI for deterministic secrets scanning. Until then, this gate is **manual-only** and depends on reviewer discipline.
**Blocks local completion:** Yes (manual)
**Blocks merge:** Yes (manual)

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
**Definition:** `format:check && lint && type-check && test && build` (sequential)
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Notes:** This is the **fast subset** — it does not include integration tests or E2E (those require the emulator/full server). Once CI is configured, a `npm run check:full` script will be added that includes those layers; PR merge will block on `check:full`. Until then, integration/E2E coverage is the human reviewer's responsibility.

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

### Current state

**GitHub Actions CI is not yet configured.** Tests run locally via the pre-commit hook (`lefthook.yml` runs lint + typecheck + unit tests) and via `npm run check`. There is no automatic gate on PRs at the GitHub level — review discipline is the only gate.

Spec 0001 explicitly deferred CI to a future change spec. This is tracked as deferred work; the gap should be closed before the team grows beyond a single committer.

### When CI is added (future spec)

GitHub Actions will run on every PR push:

- Unit tests (`npm test`)
- Integration tests (`npm run test:integration`) — emulator started in CI using `demo-poker-ledger`
- E2E tests (`npm run test:e2e`) — full stack started in CI
- Format check, lint, typecheck, build
- Secrets scan (`gitleaks`)
- Merge to `main` blocked if any gate fails
- Gate configuration lives in `.github/workflows/ci.yml`

---

## Related docs

- `09-test-strategy.md`
- `13-dev-lifecycle.md`
- `14-release-process.md`

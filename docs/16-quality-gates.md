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
**Notes:** Tests run against pure functions or with `vi.mock()` — no emulator required. Emulator-backed tests (`firestore-rules.test.ts` and `*.emulator.test.ts`) are intentionally excluded from this run and run separately under "Emulator-backed tests" below.

---

### Emulator-backed tests

**Command:** `npm run test:emulator`
**Blocks local completion:** Yes when `firestore.rules` or any data-layer module under `src/lib/` changes
**Blocks merge:** Yes when `firestore.rules` or any data-layer module under `src/lib/` changes
**Tool:** Vitest against the Firestore emulator. Includes both the rules suite (`firestore-rules.test.ts`, via `@firebase/rules-unit-testing`) and module-level data-layer tests (`src/**/*.emulator.test.ts`, via the Firebase Admin SDK).
**Notes:** Uses a dedicated Vitest config (`vitest.emulator.config.ts`). Requires the Firestore emulator on the default port `8080`. CI runs this in the `Emulator Tests` job, which starts an emulator-only Firestore via `firebase-tools`.

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

**Command:** `node scripts/secret-scan.mjs` — runs automatically in the `pre-commit` hook.
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** In-repo scanner (`scripts/secret-scan.mjs`), no external dependency.
**What it does:** scans the **added lines of staged changes** for high-signal secret patterns (`PRIVATE KEY` blocks, `AKIA…`, `AIza…`, `sk_live_…`, `gh[pousr]_…`, `xox[baprs]-…`). A match blocks the commit and names the file and pattern. Scanning only added lines (not whole files or history) keeps it fast and avoids re-flagging already-committed content. The detection logic is unit-tested (`scripts/secret-scan.test.mjs`). A legitimate fixture line that must contain a secret-shaped literal (e.g. this scanner's own tests) can carry an inline `pragma: allowlist secret` marker to be skipped.
**Not a security boundary:** local, defense-in-depth, and bypassable (`git commit --no-verify` for a confirmed false positive). It reduces accidental secret commits on this public repo; it does not guarantee anything against a determined actor. CI-side scanning (`gitleaks`) remains future work (see "When CI is added").

---

### Settings guard

**Command:** `node scripts/settings-guard.mjs` — runs in the `pre-commit` hook, only when `.claude/settings.json` is staged.
**Blocks local completion:** Yes (when `.claude/settings.json` is staged)
**Blocks merge:** Yes (when `.claude/settings.json` is staged)
**Tool:** In-repo guard (`scripts/settings-guard.mjs`), no external dependency.
**What it does:** validates the staged `.claude/settings.json` parses as JSON and rejects arbitrary-execution wildcard grants — bare interpreters/runners with only a wildcard for arguments (`Bash(node *)`, `Bash(npx *)`, `Bash(sh *)`, `Bash(* *)`). Scoped argument-wildcards (`Bash(npm test *)`) pass. Enforces the settings-hygiene rule in CLAUDE.md and ADR 0007. Unit-tested (`scripts/settings-guard.test.mjs`). Bypass (not recommended): `git commit --no-verify`.

---

### Claude edit guards (PreToolUse)

**Mechanism:** a `PreToolUse` hook on `Edit`/`Write` in `.claude/settings.json` runs `scripts/claude-edit-guard.mjs`. **Affects Claude Code sessions only** (not human `git` operations), and is not a security boundary.
**Branch guard (blocks):** denies editing tracked source (`src/**`, `scripts/**`, `firestore.rules`) while on `main`, directing work to a worktree feature branch (rule #11). Deterministic.
**Spec-presence guard (warns):** on a feature branch whose name carries a spec number with no matching `Accepted`/`In Progress`/`Implemented` spec, emits a non-blocking warning (rule #1). Heuristic — warn only, never blocks; silent when the branch carries no spec number.
**Contract:** confirmed against Claude Code as of 2026-06-18 — deny via `hookSpecificOutput.permissionDecision: "deny"`, warn via `systemMessage`, both with exit 0. The decision logic is unit-tested (`scripts/claude-edit-guard.test.mjs`); the script fails open (allows) on any parse/git error so it can never wedge editing.

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

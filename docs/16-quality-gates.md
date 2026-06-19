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
**Branch guard (blocks):** denies editing tracked source (`src/**`, `scripts/**`, `firestore.rules`) while on `main`, directing work to a worktree feature branch (rule #11). Deterministic. The branch is resolved from the **worktree that contains the edited file** (`git -C <dir of file> rev-parse --abbrev-ref HEAD`), not the Claude session cwd — so a session anchored to the `main` checkout can still edit files inside a feature-branch worktree (change 0030). Falls back to the session cwd when the file path resolves no branch.
**Spec-presence guard (warns):** on a feature branch whose name carries a spec number with no matching `Accepted`/`In Progress`/`Implemented` spec, emits a non-blocking warning (rule #1). Heuristic — warn only, never blocks; silent when the branch carries no spec number.
**Contract:** confirmed against Claude Code as of 2026-06-18 — deny via `hookSpecificOutput.permissionDecision: "deny"`, warn via `systemMessage`, both with exit 0. The decision logic is unit-tested (`scripts/claude-edit-guard.test.mjs`); the script fails open (allows) on any parse/git error so it can never wedge editing.

---

### Spec status guard

**Command:** `node scripts/spec-status-guard.mjs` — runs in the `pre-commit` hook, inside `npm run check`, and as a CI step.
**Blocks local completion:** Yes
**Blocks merge:** Yes
**Tool:** In-repo guard (`scripts/spec-status-guard.mjs`), no external dependency.
**What it does:** validates every `specs/changes/NNNN-*.md` so a spec cannot drift into the wrong state. It fails when the `## Status` value is not a valid enum (`Proposed`, `Accepted`, `In Progress`, `Implemented`, `Superseded`), when `## Status` disagrees with the latest `## Status history` row (the two-places drift), when a history transition is a **silent backslide** (a backward rank move with no annotation — `Implemented → Accepted`), or when history dates are not monotonic. The model is permissive on forward skips (real specs go `Proposed → Implemented`) and on **annotated** reverts (e.g. spec 0005's `In Progress (rebase)`), and treats `Superseded` as terminal. Unit-tested (`scripts/spec-status-guard.test.mjs`), including a meta-test that the whole `specs/changes/` tree is consistent. Bypass (not recommended): `git commit --no-verify`. See spec 0031.

---

### PR spec-reference gate

**Command:** `node scripts/pr-spec-reference.mjs` — runs as a CI step on every PR (`pull_request`).
**Blocks local completion:** No (CI-side)
**Blocks merge:** Yes (when configured as a required check)
**Tool:** In-repo guard (`scripts/pr-spec-reference.mjs`), no external dependency.
**What it does:** enforces the spec-first rule mechanically at the PR boundary. It fails when the head branch carries a spec number whose `specs/changes/NNNN-*.md` is missing or still `Proposed` (code must not land for an unaccepted spec), or when a branch with **no** spec number changes tracked source (`src/**`, `scripts/**`, `firestore.rules`). A docs-/scaffold-only change on a no-spec branch passes. The branch-slug heuristic is shared with the Claude edit guard; the status parser is shared with the spec-status guard. Unit-tested (`scripts/pr-spec-reference.test.mjs`). See spec 0031.

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
**Definition:** `lockfile-guard && spec-status-guard && format:check && lint && type-check && test && build` (sequential)
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

**GitHub Actions CI is configured** (`.github/workflows/ci.yml`), running on every `pull_request` to `main` and on push to `main`. Jobs:

- **Spec Status & Reference** (`spec-gate`) — `scripts/spec-status-guard.mjs` + `scripts/pr-spec-reference.mjs` (spec 0031).
- **Type Check & Lint** (`quality`) — `npm run type-check`, `npm run lint`.
- **Unit Tests** (`unit`) — `npm run test`.
- **Emulator Tests** (`emulator`) — Firestore emulator + `npm run test:emulator`.
- **E2E Tests** (`e2e`) — full stack + `npm run test:e2e`.

Locally, the same gates run via the `pre-commit` hook (`lefthook.yml`) and `npm run check`.

All five jobs are **required status checks** on `main` (ADR 0009): a PR cannot merge until they pass, the rule applies to administrators (no bypass), and branches must be up to date before merging. Required checks are matched by job name, so renaming a job in `ci.yml` must be paired with a branch-protection update.

### Future hardening

- Secrets scan in CI (`gitleaks`) mirroring the local `secret-scan` hook.
- A `npm run check:full` that also runs integration/E2E so local completion matches the CI surface.

---

## Related docs

- `09-test-strategy.md`
- `13-dev-lifecycle.md`
- `14-release-process.md`

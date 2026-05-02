# Change 0003: Dependency Upgrades — Next.js 16, Firebase 12, minor bumps

## Status
Accepted

## Owner
Michi Kono

## Goal

Upgrade all core dependencies to their latest stable versions while the codebase is still minimal, fixing any breaking changes introduced by major version bumps.

## Context

`npm outdated` on the scaffold reveals two major version gaps and two minor gaps:

| Package | Current range | Wanted (in range) | Latest |
|---|---|---|---|
| `next` | `^15.3.1` | 15.5.15 | **16.2.4** |
| `firebase` | `^11.7.1` | 11.10.0 | **12.12.1** |
| `firebase-admin` | `^13.3.0` | 13.8.0 | 13.8.0 |
| `react` / `react-dom` | `^19.1.0` | 19.2.5 | 19.2.5 |

Upgrading at this point (scaffold + auth gate only, ~15 source files) is far cheaper than upgrading after session management and settling logic are built. The implementer must research changelog breaking changes before upgrading major versions and document any code adaptations required.

Relevant docs: `docs/03-architecture.md` (tech stack), `docs/16-quality-gates.md`.

## User-visible behavior

None — internal dependency change only. `npm run check` must continue to pass. The app must behave identically after the upgrade.

## Non-goals

- No devDependency upgrades in this slice (Biome, Vitest, Playwright, Lefthook, etc.) — address separately if needed
- No new features
- No architectural changes

## Data model impact

None.

## Diagram impact

None.

## API impact

None — unless a major version changes a function signature used in the codebase, in which case the code must be adapted.

## Security/privacy impact

Dependency upgrades generally reduce security exposure. If `npm audit` reports new vulnerabilities after upgrading, document them.

## Local development impact

`npm install` after this change will install the new versions. `package-lock.json` will change significantly. No new env vars.

## Quality gates

| Gate | Command | Required for completion | Required for merge |
|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes |
| Lint | `npm run lint` | Yes | Yes |
| Typecheck | `npm run type-check` | Yes | Yes |
| Unit tests | `npm run test` | Yes | Yes |
| Build | `npm run build` | Yes | Yes |
| Local smoke test | `npm run dev` + sign-in flow | Yes | Yes |
| Aggregate | `npm run check` | Yes | Yes |

## Test plan

No new tests. All existing tests must continue to pass after the upgrade. The build and type-check gates catch breaking API changes at compile time.

## Acceptance criteria

- [ ] `next` updated to `^16.0.0` (or latest stable 16.x) — or documented reason for staying on 15.x
- [ ] `firebase` updated to `^12.0.0` (or latest stable 12.x) — or documented reason for staying on 11.x
- [ ] `firebase-admin` updated to `^13.8.0`
- [ ] `react` / `react-dom` updated to `^19.2.5`
- [ ] Any breaking changes in major versions identified, documented in this spec under Implementation Notes, and fixed in code
- [ ] `npm audit` run; any new high/critical findings documented
- [ ] `npm run check` passes with updated packages
- [ ] No regressions in existing behaviour

## Rollout/deployment notes

`package-lock.json` will change. No Vercel env var changes required.

## Implementation notes

Before bumping major versions, the implementer must:

1. Check the Next.js 16 upgrade guide / changelog for breaking changes. Key areas to watch: App Router API changes, middleware API changes, Server Action changes, cookie API changes (`cookies()` async behaviour), redirect API changes.
2. Check the Firebase JS SDK v12 changelog for breaking changes. Key areas: auth API (`signInWithPopup`, `GoogleAuthProvider`), `connectAuthEmulator`, app initialization.
3. Adapt any affected code and document the changes here.
4. If a major version is determined to be too risky or genuinely breaking in a way that requires significant refactoring, stay on the latest minor and document why.

## Open questions

- Are there breaking changes in Next.js 16 that affect the App Router patterns used in spec 0002? (Research required during implementation.)
- Are there breaking changes in Firebase 12 that affect `signInWithPopup`, `connectAuthEmulator`, or `GoogleAuthProvider`? (Research required during implementation.)

## Links

- `docs/03-architecture.md` — tech stack
- `specs/changes/0001-nextjs-shell.md` — original package versions
- `specs/changes/0002-firebase-auth.md` — Firebase Auth implementation that may be affected

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-02 | Proposed | Initial draft |
| 2026-05-02 | Accepted | Approved; run in parallel with spec 0002 PR review |

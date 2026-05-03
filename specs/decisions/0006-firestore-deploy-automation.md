# ADR 0006 — Automated Firestore Deploys via Workload Identity Federation

**Status:** Accepted
**Date:** 2026-05-03

## Context

`firestore.rules` and `firestore.indexes.json` are checked into the repo, but there is no automated path that gets them into production. Today, deploying them requires a developer with project credentials to remember to run `firebase deploy --only firestore:rules,firestore:indexes` after merging. That has already failed at least once: commit `2d9cf67` ("declare sessions composite index and harden Google sign-in") added a composite index that had to be deployed by hand, and the lag between merge and deploy meant prod queries were broken in between.

The repo is public on GitHub, which constrains the design:

- No long-lived credentials may be stored as repo or environment secrets.
- The deploy mechanism must be safe in the presence of fork PRs, malicious PR contributors, and untrusted workflow contributions.
- Any GCP principal granted the deploy capability must have the smallest possible blast radius.

Cleanup baseline at time of this ADR (verified 2026-05-03):

- GitHub repo-level Actions secrets: 0.
- GitHub environment Actions secrets (`Production`, `Preview`): 0 each.
- Vercel env vars: only runtime Firebase config (`FIREBASE_ADMIN_PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_*`). No deploy-related entries.
- IAM bindings on `poker-ledger-8d3bc`: only `roles/owner` = the project owner. No extra editors or owner-equivalents.
- Service accounts on `poker-ledger-8d3bc`: only `firebase-adminsdk-fbsvc@…` (used by Vercel for runtime Admin SDK auth).
- User-managed keys on `firebase-adminsdk-fbsvc`: 2. The live one (`aa1c3af2…`, never-expires) corresponds to `FIREBASE_ADMIN_PRIVATE_KEY` in Vercel. The other (`22ae82a7…`, expires 2028) is stale and unused.
- Legacy `firebase login:ci` token registered against the project owner's Google account at https://myaccount.google.com/permissions: 1 entry, unused.
- GitHub Actions repo permissions: `enabled: true, allowed_actions: all, sha_pinning_required: false`.
- Existing GitHub environment `Production` was auto-created by Vercel for application deploys; it has zero protection rules and zero deployment branch policy.

`firebase-tools` is a devDependency as of commit `e6a67aa`, so the CLI version used to deploy can be pinned by the repo and aligned with local development.

## Decision

We will deploy `firestore.rules` and `firestore.indexes.json` to `poker-ledger-8d3bc` automatically via a GitHub Actions workflow that authenticates to GCP using Workload Identity Federation (OIDC), with the following structure:

1. **Dedicated deploy service account** `firestore-deployer@poker-ledger-8d3bc.iam.gserviceaccount.com`, granted exactly two IAM roles: `roles/firebaserules.admin` and `roles/datastore.indexAdmin`. No data access. No project-wide roles.
2. **Workload Identity Pool + Provider** scoped to the GitHub OIDC issuer, with an attribute condition that requires `assertion.repository == 'michikono/poker-ledger'` AND `assertion.ref == 'refs/heads/main'`. Tokens cannot be minted from forks, PRs, or feature branches.
3. **Workflow trigger** is `push` to `main` filtered to `firestore.rules` and `firestore.indexes.json`. The workflow never runs on PRs, never on other branches, and never on path-unrelated changes.
4. **Dedicated GitHub Environment** `firestore-production`, *separate from* the Vercel-managed `Production` environment, with required-reviewer protection on the project owner and a deployment-branch policy that allows only `main`. Both rules and index deploys flow through this single approval gate uniformly.
5. **Concurrency group** `deploy-firestore` so multiple pushes serialize rather than race.
6. **PR-time rules unit tests** using `@firebase/rules-unit-testing` against the local emulator, run as a job in the existing `ci.yml`. Rule regressions are caught before merge, before the deploy workflow ever fires.
7. **The deploy workflow runs `npx firebase deploy`** against the project-pinned `firebase-tools` from `npm ci`, so the deploy CLI version matches what local dev uses.

## Consequences

Positive:

- No long-lived deploy credential anywhere — in the repo, in GitHub secrets, on a developer laptop. The OIDC token minted by GitHub is short-lived and scoped to the workflow run.
- The deploy SA cannot read or write any Firestore data. A compromised workflow can change rules/indexes (visible to the approver) but cannot exfiltrate user data.
- The attribute condition on the WIF provider is the strongest defense: even an attacker who lands code on `main` cannot mint a token from a different repo or branch. Combined with the `push: branches: [main]` filter and the protected environment, three independent controls must all fail for an unauthorized deploy to occur.
- Manual approval surfaces every infra deploy to the project owner — visibility, even though the workflow itself is auditable.
- Rules unit tests give us a deterministic gate against rule regressions. The cost of a bad rules deploy (locking users out, or — worse — opening up writes) is high enough to justify automated coverage.

Accepted trade-offs:

- One-time GCP setup is non-trivial. Documented step-by-step in the change spec.
- Every rules/indexes change now requires one approval click. Acceptable given the low frequency of these changes (rare).
- The runtime SA `firebase-adminsdk-fbsvc` retains its user-managed key for `FIREBASE_ADMIN_PRIVATE_KEY` in Vercel. This ADR does not address that — it is a separate hardening item.
- Rules tests run against the emulator at PR time, not against production rules at deploy time. A discrepancy between emulator behavior and prod is theoretically possible but historically rare for Firestore rules; not worth the deploy-time complexity in MVP.

Future hardening (deliberately out of scope here):

- Migrate Vercel runtime auth to Vercel→GCP OIDC federation, eliminating the remaining user-managed key on `firebase-adminsdk-fbsvc`. Would require its own ADR.
- Pin third-party GitHub Actions to commit SHAs (currently `actions/checkout@v4`, `google-github-actions/auth@v2`, etc.). A repo-wide policy decision; tracked separately.
- Run rules unit tests as a pre-deploy gate inside the deploy workflow itself, not just at PR time.
- Add `actionlint` (or equivalent) to the local quality gates to lint workflow YAML.

## Alternatives considered

- **`firebase login:ci` token in a GitHub secret.** Simplest to set up, but the token is long-lived, full-scope across the Firebase project, and cannot be attribute-restricted by branch or repo. Compromise of the secret = full project takeover. Rejected.
- **User-managed service-account JSON in a GitHub secret.** Same long-lived-credential problem. Rotating it requires rotation of the GitHub secret, easy to forget. Rejected.
- **Coupling Firestore deploys to Vercel build steps.** Awkward — Vercel deploys depend on app code changes, not infra files; the trigger surface is wrong. Also expands the runtime SA's blast radius. Rejected.
- **Manual deploy only (status quo).** Exactly the failure mode that motivated this ADR.
- **Reuse the Vercel-managed `Production` GitHub environment.** Adding required-reviewer to it would gate every Vercel app deploy, which is the wrong blast radius. Rejected; we use a separate `firestore-production` environment.
- **Split rules and indexes into separate workflows so indexes auto-deploy without approval.** Lower friction on index changes, but doubles the workflow surface and the WIF attribute condition has to be kept consistent across both. Rejected for simplicity given low deploy frequency.

## Impact on local development

None for the standard development loop. Local development continues to use the Firebase emulator with the demo project. Developers with direct GCP access can still run `firebase deploy` from a laptop in an emergency, but the expected path is to land changes on `main` and let the workflow deploy.

The new rules unit tests run against the local emulator. They are part of `npm test` and therefore part of `npm run check`, so any developer running the standard local gates with the emulator running will exercise them.

## Impact on quality gates

Adds:

- A new PR-time CI job (`firestore-rules`) running `@firebase/rules-unit-testing` against an emulator-only Firestore.
- A new test file picked up by Vitest's default glob, included in `npm test` and therefore in `npm run check`.

Does not change:

- `format`, `lint`, `type-check`, `build` gates.
- The deploy workflow is post-merge and is not a required check on PRs.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-03 | Proposed | Initial draft |
| 2026-05-03 | Accepted | Approved for implementation |

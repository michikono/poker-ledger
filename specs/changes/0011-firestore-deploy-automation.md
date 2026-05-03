# Change 0011: Firestore Deploy Automation

## Status
In Progress

## Owner
Michi Kono

## Goal

Automate the deployment of `firestore.rules` and `firestore.indexes.json` to the production Firebase project (`poker-ledger-8d3bc`) when changes to those files land on `main`, gated by a single human-approval step, authenticated via Workload Identity Federation with no long-lived credentials.

## Context

Firestore rules and indexes are checked into the repo, but reaching production requires a developer to remember to run `firebase deploy` manually. Commit `2d9cf67` shipped a composite index that was forgotten in the first deploy attempt and broke prod queries until it was caught and re-deployed. We want the deploy to be a consequence of merging, not a separate step.

The repo is public, so the deploy must use short-lived OIDC-federated credentials rather than any committed or stored secret. Architectural shape and rationale are recorded in [ADR 0006](../decisions/0006-firestore-deploy-automation.md).

## User-visible behavior

For application end users: nothing changes.

For maintainers:

- Merging a PR that modifies `firestore.rules` or `firestore.indexes.json` triggers the `Deploy Firestore Config` workflow.
- The workflow pauses with a "waiting for review" status; the project owner clicks Approve.
- After approval, `npx firebase deploy --only firestore --project poker-ledger-8d3bc --non-interactive` runs.
- A green check on the deployment indicates rules and indexes are live in `poker-ledger-8d3bc`.
- Pushes that don't touch those two files do not trigger the workflow.
- PRs that modify `firestore.rules` see a new required check, `Firestore Rules Tests`, that must pass before merge.

## Non-goals

- Migrating Vercel's runtime Firebase Admin SDK auth to OIDC. Future hardening; ADR will track separately.
- Adding rules unit tests as a pre-deploy gate inside the deploy workflow itself. Tests run at PR time only.
- Deploying any Firebase artifact other than rules and indexes (functions, hosting, storage rules — none currently exist).
- Automatic post-deploy smoke testing of production queries.
- Pinning third-party GitHub Actions to commit SHAs.
- Cleaning up the remaining user-managed runtime key on `firebase-adminsdk-fbsvc`. Out of scope; documented as future work in ADR 0006.
- Adding `actionlint` to local gates.

## Data model impact

None.

## Diagram impact

None. This is operational tooling; it does not affect domain model, architecture, API contract, or user flows.

## API impact

None.

## Security/privacy impact

**New principals:**

- IAM service account `firestore-deployer@poker-ledger-8d3bc.iam.gserviceaccount.com` with exactly `roles/firebaserules.admin` and `roles/datastore.indexAdmin`. Cannot read or write Firestore data.
- Workload Identity Pool `github` and provider `poker-ledger`, with attribute condition `assertion.repository == 'michikono/poker-ledger' && assertion.ref == 'refs/heads/main'`. Only the `main` branch of this exact repo can mint tokens for this provider.
- The deploy SA is bound via `roles/iam.workloadIdentityUser` to the principal set `principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/attribute.repository/michikono/poker-ledger`.

**Reduces risk vs. status quo:**

- No long-lived deploy credential anywhere.
- The legacy `firebase login:ci` token currently registered on the owner's Google account is revoked at cutover.
- The stale user-managed SA key (`22ae82a7…`) on `firebase-adminsdk-fbsvc` is deleted at cutover.
- A separate GitHub environment `firestore-production` isolates the human-approval gate so it doesn't gate Vercel app deploys.

**Open risks (documented, not fixed in this spec):**

- Runtime user-managed key (`aa1c3af2…`) on `firebase-adminsdk-fbsvc` remains, used by Vercel `FIREBASE_ADMIN_PRIVATE_KEY`. Future ADR.
- GitHub Actions are pinned to major-version tags, not SHAs. Repo-wide hardening; out of scope.

## Local development impact

- `firebase-tools` is already a devDependency (commit `e6a67aa`), so `npx firebase deploy` from a developer laptop continues to work for those with direct GCP credentials.
- New devDependency: `@firebase/rules-unit-testing` for rules tests.
- The rules unit tests require the Firestore emulator to be running. Locally, this means running `npm run dev` (which starts the emulator) before `npm test` if you want the rules tests to pass, or running the Firestore emulator standalone.
- No new env vars.
- `docs/15-local-development.md` and `docs/16-quality-gates.md` get one-paragraph updates referencing the new test job and the deploy workflow.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests (incl. new rules tests) | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Local smoke test | Manual (see below) | Yes | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |
| Post-merge deploy smoke | First trivial index change after merge (see Rollout phase E) | After merge | n/a | |

Workflow YAML is reviewed manually; this repo does not yet run `actionlint`. Adding it is a separate concern.

## Test plan

**TDD targets (rules unit tests, written first):**

For each `match` block in `firestore.rules` (`/sessions/{id}`, `/sessions/{id}/players/{id}`, `/sessions/{id}/players/{id}/buy_ins/{id}`, `/sessions/{id}/payments/{id}`, `/sessions/{id}/change_log/{id}`, and the catch-all `/{document=**}`):

- Authenticated read → assertSucceeds (or assertFails for catch-all).
- Unauthenticated read → assertFails.
- Authenticated write → assertFails (all client writes denied today).
- Unauthenticated write → assertFails.

Tests use `@firebase/rules-unit-testing`'s `initializeTestEnvironment` against the local emulator at `localhost:8080`. Each test runs in an isolated context. `clearFirestore` between tests.

The test file lives at `firestore-rules.test.ts` at the repo root, alongside `firestore.rules`. It is excluded from the default Vitest run (which `npm test`, the pre-commit hook, and the CI `Unit Tests` job all invoke) so that those continue to require no emulator. The rules suite runs via a dedicated config (`vitest.rules.config.ts`) under `npm run test:rules` and in the CI `Firestore Rules Tests` job — both of which expect a Firestore emulator on the default port `8080`.

**Workflow itself:** not unit-testable. Validated by the post-merge smoke step in Rollout phase E.

**Not tested:**

- The deploy SA's IAM permissions. (Validated by the smoke deploy succeeding.)
- The WIF attribute condition's rejection of fork PRs. (Defense-in-depth — the workflow's `push: branches: [main]` filter already blocks PR triggering.)

## Acceptance criteria

- [ ] `.github/workflows/deploy-firestore.yml` exists, triggers on `push` to `main` with paths `firestore.rules` or `firestore.indexes.json`, attaches to the `firestore-production` environment, authenticates via WIF (no SA-key secret), and runs `npx firebase deploy --only firestore --project poker-ledger-8d3bc --non-interactive`.
- [ ] `firestore-production` GitHub environment exists with required-reviewer protection on the project owner and deployment-branch policy locked to `main`.
- [ ] Workload Identity Pool `github` and provider `poker-ledger` exist on `poker-ledger-8d3bc` with the attribute condition `assertion.repository == 'michikono/poker-ledger' && assertion.ref == 'refs/heads/main'`.
- [ ] Service account `firestore-deployer@poker-ledger-8d3bc.iam.gserviceaccount.com` exists with exactly `roles/firebaserules.admin` and `roles/datastore.indexAdmin`. No other roles.
- [ ] The deploy SA has `roles/iam.workloadIdentityUser` granted to the principal set scoped to the `michikono/poker-ledger` repo.
- [ ] `@firebase/rules-unit-testing` is a devDependency.
- [ ] `firestore-rules.test.ts` exists at the repo root, covers every `match` block in `firestore.rules`, and passes against the local emulator.
- [ ] `ci.yml` has a new `firestore-rules` job that runs the rules tests against an emulator-only Firestore. The job is a required check on PRs.
- [ ] Cutover cleanup completed:
  - [ ] Stale SA key `22ae82a7d9122a297b85922d475e854eaa372a1f` deleted from `firebase-adminsdk-fbsvc`.
  - [ ] Legacy Firebase entry revoked at https://myaccount.google.com/permissions.
- [ ] Post-merge: a trivial follow-up index change deploys cleanly via the workflow with one approval click.
- [ ] `docs/15-local-development.md` and `docs/16-quality-gates.md` updated to reference the rules tests and deploy workflow.
- [ ] `npm run check` passes locally with the emulator running.
- [ ] Spec conformance review completed.

## Rollout/deployment notes

The cutover is sequenced in five phases. Phases B and C are user-run (require GCP and GitHub admin access); the rest is in-repo work plus one post-merge action.

### Phase A — Baseline (already done)

Cleanup state was verified before this spec was drafted; results are recorded in ADR 0006.

### Phase B — GCP setup (user runs before merging this PR)

```sh
PROJECT=poker-ledger-8d3bc
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')

# 1. Create the deploy SA.
gcloud iam service-accounts create firestore-deployer \
  --project=$PROJECT \
  --display-name="Firestore deploy automation"

# 2. Grant minimal roles.
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:firestore-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/firebaserules.admin"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:firestore-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/datastore.indexAdmin"

# 3. Create the WIF pool.
gcloud iam workload-identity-pools create github \
  --project=$PROJECT \
  --location=global \
  --display-name="GitHub Actions"

# 4. Create the OIDC provider with the attribute condition pinned to repo + main.
gcloud iam workload-identity-pools providers create-oidc poker-ledger \
  --project=$PROJECT \
  --location=global \
  --workload-identity-pool=github \
  --display-name="poker-ledger repo" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'michikono/poker-ledger' && assertion.ref == 'refs/heads/main'"

# 5. Bind the deploy SA to the WIF principal.
gcloud iam service-accounts add-iam-policy-binding \
  firestore-deployer@$PROJECT.iam.gserviceaccount.com \
  --project=$PROJECT \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/michikono/poker-ledger"

# 6. Capture the provider resource name for the workflow YAML:
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/poker-ledger"
```

The output of step 6 goes into the workflow YAML's `workload_identity_provider` field before the PR is merged.

### Phase C — GitHub setup (user runs before merging this PR)

```sh
# 1. Create the environment.
gh api -X PUT repos/michikono/poker-ledger/environments/firestore-production
```

```text
# 2. In the GitHub UI:
#    Settings → Environments → firestore-production
#    - Required reviewers: add `michikono`
#    - Deployment branches: "Selected branches" → add `main`
#    (No CLI for these settings.)
```

### Phase D — Merge this PR

This PR adds:
- `.github/workflows/deploy-firestore.yml`
- A new `firestore-rules` job in `.github/workflows/ci.yml`
- `firestore-rules.test.ts` at the repo root
- `@firebase/rules-unit-testing` in devDependencies
- Updates to `docs/15-local-development.md` and `docs/16-quality-gates.md`

The merge itself does not deploy anything (no `firestore.rules` / `firestore.indexes.json` change in this PR).

### Phase E — Cutover verification (after merge)

1. Open a trivial follow-up PR that touches `firestore.indexes.json` (e.g., add a no-op whitespace change to force the path filter to match).
2. Merge it.
3. Approve the workflow run when GitHub prompts.
4. Verify the deploy succeeds and the index is reflected in the Firebase Console.
5. **Delete the stale SA key:**
   ```sh
   gcloud iam service-accounts keys delete 22ae82a7d9122a297b85922d475e854eaa372a1f \
     --iam-account=firebase-adminsdk-fbsvc@poker-ledger-8d3bc.iam.gserviceaccount.com \
     --project=poker-ledger-8d3bc
   ```
6. **Revoke the legacy `firebase login:ci` token:**
   - Visit https://myaccount.google.com/permissions
   - Find the Firebase entry, click it, click "Remove access".

### Rollback plan

- If the deploy workflow misbehaves: GitHub UI → Actions → "Deploy Firestore Config" → Disable workflow. Manual `firebase deploy` is the fallback.
- The deploy SA can be deleted with no impact on application runtime; runtime uses `firebase-adminsdk-fbsvc`, which is untouched by this change.
- The stale-key deletion (Phase E step 5) is reversible only by issuing a new key; before deleting, double-check the live `private_key_id` matches `aa1c3af2…`.

## Implementation notes

### Workflow YAML

`.github/workflows/deploy-firestore.yml`:

```yaml
name: Deploy Firestore Config

on:
  push:
    branches: [main]
    paths:
      - firestore.rules
      - firestore.indexes.json

permissions:
  id-token: write
  contents: read

concurrency: deploy-firestore

jobs:
  deploy:
    name: Deploy Firestore
    runs-on: ubuntu-latest
    environment: firestore-production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/poker-ledger
          service_account: firestore-deployer@poker-ledger-8d3bc.iam.gserviceaccount.com
      - run: npx firebase deploy --only firestore --project poker-ledger-8d3bc --non-interactive
```

`<PROJECT_NUMBER>` is the value captured in Phase B step 6. Substitute before opening the PR.

`npm ci` installs the project-pinned `firebase-tools`. `npx firebase` uses that version. This keeps deploy CLI version aligned with local development.

### Rules unit tests

`firestore-rules.test.ts` (at repo root):

```ts
// @vitest-environment node
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

describe("/sessions/{id}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc("sessions/abc").get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc("sessions/abc").get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env.authenticatedContext("alice").firestore().doc("sessions/abc").set({ name: "x" }),
    );
  });
});

// ...repeat the same shape for /sessions/{id}/players/{id},
//    /sessions/{id}/players/{id}/buy_ins/{id},
//    /sessions/{id}/payments/{id},
//    /sessions/{id}/change_log/{id},
//    and the catch-all /{document=**} (read & write both fail even when authenticated).
```

The `// @vitest-environment node` directive overrides the global `jsdom` environment for this file; `@firebase/rules-unit-testing` works under jsdom but node is the documented default.

### CI job

In `.github/workflows/ci.yml`, add a new job alongside `quality`, `unit`, `e2e`:

```yaml
firestore-rules:
  name: Firestore Rules Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - name: Start Firestore emulator
      run: |
        npx firebase emulators:start --only firestore --project=demo-poker-ledger \
          > /tmp/emulator.log 2>&1 &
    - name: Wait for Firestore emulator
      run: until curl -sf http://localhost:8080; do sleep 1; done
    - run: npm test -- firestore-rules.test.ts
```

After merge, configure the `firestore-rules` check as required for PRs targeting `main` (Settings → Branch protection rules).

### Local smoke test

- [ ] Run `npm run dev` in one terminal (starts emulator).
- [ ] Run `npm test -- firestore-rules.test.ts` in another. All tests pass.
- [ ] Edit `firestore.rules`: change `allow read: if request.auth != null` to `allow read: if false` for `/sessions/{id}`. Re-run rules tests. The "authenticated read succeeds" case fails as expected.
- [ ] Revert the edit. Re-run. Tests pass again.
- [ ] Run `npm run check` (with emulator still running). Aggregate passes.
- [ ] Verify the workflow file lints by viewing it on the PR's "Files changed" tab — GitHub flags YAML errors.

## Open questions

None. Resolved during design discussion:

1. ~~Cleanup findings~~ → Documented in ADR 0006. Cutover deletes the stale SA key (`22ae82a7…`) and revokes the legacy `firebase login:ci` token. The runtime key (`aa1c3af2…`) is intentionally retained.
2. ~~Index-only auto-deploy~~ → Uniform gate. Both rules and indexes go through approval.
3. ~~Bundle rules unit tests~~ → Bundled in this spec.

## Links

- [ADR 0006 — Automated Firestore Deploys via Workload Identity Federation](../decisions/0006-firestore-deploy-automation.md)
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`
- Commit `2d9cf67` — the missed-deploy incident that motivated this spec
- Commit `e6a67aa` — `firebase-tools` as devDependency, which the deploy workflow leverages
- `docs/15-local-development.md` — to be updated
- `docs/16-quality-gates.md` — to be updated

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-05-03 | Proposed | Initial draft |
| 2026-05-03 | Accepted | Approved for implementation |
| 2026-05-03 | In Progress | Implementation begun on `feature/0011-firestore-deploy-automation`; rules tests excluded from default Vitest run via `vitest.rules.config.ts` so `npm test` and the existing CI `Unit Tests` job remain emulator-free (small clarification to the original "default glob picks it up" wording). |
| 2026-05-03 | In Progress | Phase E cutover smoke (PR #25) revealed `firebase deploy` does not pick up Application Default Credentials minted by `google-github-actions/auth` — the deploy step failed with `Failed to authenticate, have you run firebase login?`. Fix on `chore/0011-deploy-auth-fix`: ask the auth action for an `access_token` (`token_format: access_token`) and pass it to `firebase deploy` via `FIREBASE_TOKEN`. Token is short-lived and minted per run; no long-lived credential is added. |

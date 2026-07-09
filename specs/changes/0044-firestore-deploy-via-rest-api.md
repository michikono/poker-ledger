# Change 0044: Deploy Firestore rules + indexes via the REST API (keyless)

## Status
Accepted

## Owner
Michi Kono

## Goal

Make the automated Firestore config deploy actually succeed — deploying both security rules and composite indexes on merge — by replacing `firebase-tools` (which cannot authenticate from a keyless WIF credential) with direct Firebase REST API calls using the Workload Identity Federation access token.

## Context

Spec 0042 fixed the deploy workflow's trigger and switched auth to ADC, but the run still failed:

```
Run npx firebase deploy --only firestore …
Error: Failed to authenticate, have you run firebase login?
```

The `google-github-actions/auth` step succeeds (it mints the credentials file and an access token), but **`firebase-tools` ignores the keyless WIF credentials file** — it only accepts a `firebase login:ci` refresh token or interactive login. `FIREBASE_TOKEN` must be a refresh token, not the WIF access token, so the earlier token approach failed too. `firebase-tools` and keyless WIF simply don't cooperate, and we won't add a long-lived service-account key (that's the thing WIF exists to avoid).

The `auth` step already mints a working OAuth2 access token (`token_format: access_token`). Deploying via the Firebase REST APIs with that token is deterministic and stays keyless:
- **Rules:** Firebase Rules API — create a ruleset from `firestore.rules`, then point the `cloud.firestore` release at it.
- **Indexes:** Firestore Admin API — create each composite index from `firestore.indexes.json`, treating `ALREADY_EXISTS` as success (idempotent, safe to re-run).

The deployer service account already holds `roles/firebaserules.admin` + `roles/datastore.indexAdmin`, which cover exactly these calls.

Relevant files:
- `.github/workflows/deploy-firestore.yml` — the workflow.
- `scripts/deploy-firestore-config.mjs` — the new deploy script.
- `firestore.rules`, `firestore.indexes.json` — the deployed config.
- `docs/10-deployment-ops.md` — deploy documentation.

## User-visible behavior

After merge, the `Deploy Firestore Config` workflow runs and **succeeds**, deploying the current rules (including the `change_log` read rule) and indexes. The session-detail connection badge then shows green. No app code change.

## Non-goals

- No rules/index content change; this only changes *how* they deploy.
- Does **not** delete indexes removed from `firestore.indexes.json` (creation only — matches `firebase deploy` in `--non-interactive`). Deliberate deletions stay manual.
- Does **not** manage single-field `fieldOverrides` (the file has none; the script fails loudly if any appear).
- Does not change the WIF trust config or add any long-lived credential.

## Data model impact

None.

## Diagram impact

None.

## API impact

None (app). Uses the Firebase Rules API and Firestore Admin API for deployment only.

## Security/privacy impact

Positive/neutral: stays keyless (short-lived WIF access token, `cloud-platform` scope, least-privilege deployer SA). The `environment: firestore-production` line is kept so the OIDC subject — and thus the WIF trust — is unchanged. Removing the *Required reviewers* rule on that environment (to make it a single flow) is a repo-settings change and does not affect auth.

## Local development impact

None. The emulator loads the files directly. The manual laptop fallback (`firebase deploy --only firestore` with a `firebase login` session) is unchanged.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Rules+indexes deploy | `Deploy Firestore Config` run succeeds on merge | Yes (post-merge) | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- The script has no app-logic to unit test (network I/O against Google APIs); it uses only Node built-ins + global `fetch`. Verification is the workflow run succeeding on merge and the detail badge turning green. Errors print the full API response so a first real run is self-diagnosing. Manual fallback remains if needed.

## Acceptance criteria

- [ ] The workflow deploys via `scripts/deploy-firestore-config.mjs` using the WIF access token (no `firebase-tools`, no `FIREBASE_TOKEN`, no SA key).
- [ ] The run succeeds and deploys rules + indexes; re-runs are idempotent (existing indexes → skipped).
- [ ] The session-detail connection badge is green in production.
- [ ] The path filter includes the script and workflow so their changes trigger a deploy.

## Rollout/deployment notes

On merge, the `firestore.rules` change trips the path filter and the workflow runs (with the corrected script). To remove the approval prompt entirely, delete the *Required reviewers* rule on the `firestore-production` environment in repo Settings → Environments. Manual fallback: `npx firebase deploy --only firestore --project poker-ledger-8d3bc` from a machine with `firebase login`.

## Implementation notes

- `token_format: access_token` on the auth step; pass `steps.auth.outputs.access_token` to the script as `FIREBASE_ACCESS_TOKEN`.
- Rules: `POST /v1/projects/{p}/rulesets` then `PATCH /v1/projects/{p}/releases/cloud.firestore` (fall back to `POST /releases` on 404).
- Indexes: `POST /v1/projects/{p}/databases/(default)/collectionGroups/{group}/indexes`; treat 409 / `ALREADY_EXISTS` as success.

## Open questions

The WIF handshake and REST calls can only be exercised in Actions; if the release `PATCH` shape needs adjustment, the run's error output shows the exact API response to correct against.

## Links

- `specs/changes/0042-fix-firestore-rules-deploy-pipeline.md` (prior attempt; superseded mechanism)
- `docs/10-deployment-ops.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-09 | Proposed | Replace firebase-tools with keyless REST-API deploy for rules + indexes |
| 2026-07-09 | Accepted | Accepted by owner; implementation begins |

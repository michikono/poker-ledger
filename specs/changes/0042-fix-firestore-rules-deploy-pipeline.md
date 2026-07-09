# Change 0042: Fix the Firestore rules deploy pipeline

## Status
Accepted

## Owner
Michi Kono

## Goal

Make `firestore.rules` actually deploy to production so the `change_log` (and other subcollection) read rules take effect — and so future rule changes deploy automatically instead of silently rotting.

## Context

The connection badge on the **session detail** page reported `permission-denied`, while the **index** page worked. The two pages differ only in what the client listens to: the index listens to the top-level `sessions` collection (allowed by production's rules), the detail page listens to `sessions/{id}/change_log` (denied). The repo's `firestore.rules` **does** grant `change_log` reads — but it was never deployed.

Evidence: the `Deploy Firestore Config` workflow (`.github/workflows/deploy-firestore.yml`) has run exactly twice (2026‑05‑03) and **failed both times**, with zero successful runs since. It triggers only on pushes to `main` that change `firestore.rules`/`firestore.indexes.json`, and no realtime work (specs 0033–0041) touched those files — so nothing re-triggered it. Production is running older rules deployed manually before `change_log` existed.

The workflow fails because it passes a **Google OAuth access token** (from Workload Identity Federation) via the `FIREBASE_TOKEN` env. `firebase-tools` (v15) treats `FIREBASE_TOKEN` as a legacy CLI **refresh** token, not a Google access token, so authentication fails. The correct pattern is to let `firebase deploy` use Application Default Credentials — the credentials file that `google-github-actions/auth` already writes — via `GOOGLE_APPLICATION_CREDENTIALS`.

Relevant files:
- `.github/workflows/deploy-firestore.yml` — the broken auth step.
- `firestore.rules` — correct in the repo; needs a (trigger) touch so the fixed workflow runs on merge.
- `docs/10-deployment-ops.md` — documents the workflow and the manual fallback.

## User-visible behavior

After this merges and the workflow deploys, the **session detail page connection badge shows green (live)** for signed-in users, and cross-client updates flow — because the `change_log` listen is now permitted. No app code changes.

## Non-goals

- No change to the rules' content/policy — `firestore.rules` already grants the correct authenticated reads and denies all client writes. This only makes it deploy.
- No change to app behavior, the badge component, or the realtime client.
- No new long-lived credentials — WIF stays keyless.

## Data model impact

None.

## Diagram impact

None.

## API impact

None.

## Security/privacy impact

Positive: the intended least-privilege rules (authenticated reads, all client writes denied) finally take effect in production. The deployer service account keeps only `roles/firebaserules.admin` + `roles/datastore.indexAdmin`. No credential is added.

## Local development impact

None. The emulator loads `firestore.rules` directly; this only affects the production deploy path.

## Quality gates

| Gate | Command | Required for completion | Required for merge | Status |
|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | |
| Lint | `npm run lint` | Yes | Yes | |
| Typecheck | `npm run type-check` | Yes | Yes | |
| Unit tests | `npm test` | Yes | Yes | |
| Build | `npm run build` | Yes | Yes | |
| Rules deploy | `Deploy Firestore Config` workflow run succeeds on merge | Yes (post-merge) | Yes | |
| Aggregate | `npm run check` | Yes | Yes | |

## Test plan

- No unit tests (CI/infra change). Verification is the workflow run succeeding on merge to `main` and the detail-page badge turning green in production. If the workflow still fails, the documented manual fallback (`npx firebase deploy --only firestore:rules --project poker-ledger-8d3bc`) remains available.

## Acceptance criteria

- [ ] `deploy-firestore.yml` authenticates via ADC (`GOOGLE_APPLICATION_CREDENTIALS` from the auth action), not `FIREBASE_TOKEN`.
- [ ] A trigger touch to `firestore.rules` causes the workflow to run on merge.
- [ ] The workflow completes successfully and deploys the current rules (including `change_log`).
- [ ] The session detail connection badge is green in production.

## Rollout/deployment notes

On merge to `main`, the `firestore.rules` change trips the path filter and runs the workflow (which requires `firestore-production` environment approval). The deploy pushes the current ruleset, which differs from the stale production ruleset, so `change_log` reads become permitted. If the WIF handshake still fails, use the manual fallback command above; the rules content is identical either way.

## Implementation notes

- Drop `token_format: access_token` and the `FIREBASE_TOKEN` env. Set `GOOGLE_APPLICATION_CREDENTIALS: ${{ steps.auth.outputs.credentials_file_path }}` on the deploy step so `firebase-tools` uses the WIF credentials file directly.
- Add a comment line to `firestore.rules` (no ruleset change) so the merge trips the path filter.

## Open questions

The WIF handshake can only be exercised in Actions (not locally). If ADC still isn't honored by `firebase-tools`, fall back to the manual deploy and iterate the workflow.

## Links

- `.github/workflows/deploy-firestore.yml`
- `docs/10-deployment-ops.md`
- `specs/changes/0040-surface-realtime-listener-error.md`

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-07-09 | Proposed | Fix the never-successful rules deploy so change_log reads reach production |
| 2026-07-09 | Accepted | Accepted by owner; implementation begins |

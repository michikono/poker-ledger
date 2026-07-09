# 10 — Deployment & Operations

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define how the application is deployed, monitored, and operated. Covers environments, secrets management, rollback strategy, and observability.

---

## Environments

| Environment | Branch/trigger | URL | Purpose |
|---|---|---|---|
| Local | n/a | `localhost:3000` | Development |
| Preview | feature branch push | `<branch>-<project>.vercel.app` | Review and QA |
| Production | `main` merge | Custom domain (TBD) or `<project>.vercel.app` | Live users |

## Deployment process

### Application

- Push to feature branch → Vercel preview deployment (automatic).
- Merge to `main` → Vercel production deployment (automatic).
- Do not use manual `vercel deploy` for normal workflow. The Vercel CLI is reserved for: linking projects, pulling env vars locally (`vercel env pull`), and manual inspection (`vercel logs`).

### Firestore configuration (rules + indexes)

`firestore.rules` and `firestore.indexes.json` deploy via the GitHub Actions workflow `.github/workflows/deploy-firestore.yml`.

- Trigger: a push to `main` that changes `firestore.rules`, `firestore.indexes.json`, the deploy script, or the workflow (path filter).
- Auth: Workload Identity Federation — no long-lived deploy credentials. The `firestore-deployer` service account on `poker-ledger-8d3bc` holds only `roles/firebaserules.admin` and `roles/datastore.indexAdmin`.
- Command: `node scripts/deploy-firestore-config.mjs`, which calls the Firebase Rules API (create ruleset → point the `cloud.firestore` release at it) and the Firestore Admin API (create each composite index, `ALREADY_EXISTS` = success) using the WIF access token. `firebase-tools` is **not** used in CI: it cannot authenticate from a keyless WIF credentials file (spec 0044).
- Gate: the workflow attaches to the GitHub `firestore-production` environment so the OIDC subject (and thus the WIF trust) is stable. To make the deploy a single flow with no approval prompt, remove the environment's *Required reviewers* rule in repo Settings → Environments; that does not affect auth.
- Concurrency: serialized via the `deploy-firestore` concurrency group; only one deploy runs at a time.
- Limitations: the script creates indexes but does not delete indexes removed from the file (matches `firebase deploy --non-interactive`), and does not manage single-field `fieldOverrides` — apply those manually.

Manual `firebase deploy --only firestore` from a developer laptop (with a `firebase login` session) is the documented fallback and still works.

## Environment variables

| Variable | Required in | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Local + Vercel (Production + Preview) | Public; identifies the Firebase project |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Local + Vercel (Production + Preview) | Public by design — Firebase config, not a secret |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Local + Vercel (Production + Preview) | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Local + Vercel (Production + Preview) | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Local + Vercel (Production + Preview) | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Local + Vercel (Production + Preview) | |
| `FIREBASE_ADMIN_PROJECT_ID` | Vercel (Production + Preview) only | Server-only; same value as `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Vercel (Production + Preview) only | Server-only; **sensitive** |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Vercel (Production + Preview) only | Server-only; **sensitive**; multiline; the dashboard handles literal newlines or escaped `\n` |
| `FIRESTORE_EMULATOR_HOST` | Local only | `localhost:8080`; tells Admin SDK to use the emulator |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local only | `localhost:9099`; tells Admin SDK to use the emulator |

See `15-local-development.md` for local setup and `.env.local.example` for the canonical list.

**Adding sensitive vars in Vercel:** the `vercel env add` CLI errors when adding sensitive vars to multiple environments at once. Add them via the Vercel dashboard (web UI handles multiline cleanly), or run separate CLI commands per environment.

**Never commit secrets** — `.env.local` is gitignored; pre-push secrets scan is described in `14-release-process.md`.

## Rollback strategy

- **Instant rollback:** in the Vercel dashboard, navigate to the project → Deployments → select the last known-good deployment → "Promote to production". This is fast (seconds), atomic, and does not redeploy.
- **Code rollback:** for issues that need to ship as a forward fix, revert the offending commit on `main` (`git revert <sha>`) and merge a new PR. The forward deploy supersedes the prior promotion.
- **Database rollback:** none. Firestore has no automatic rollback. If a bad migration corrupts data, fix it via a manual backfill script — see `docs/05-data-model.md → "Migration strategy"`.

## Monitoring and alerting

**MVP (current state):**
- **Vercel built-in observability**: function logs, request analytics, error rates accessible via Vercel dashboard. No alerts configured.
- **No centralized error tracking** (e.g., Sentry) for MVP. Errors that bubble up are caught by error boundaries (`docs/08-ux-spec.md → Error boundaries`) and logged via `console.error` in Server Actions; visible in Vercel function logs.
- **No uptime monitoring** for MVP. The app is small-scale and self-hosted on Vercel, which has its own status page.

**Post-MVP backlog (deferred):**
- Sentry or equivalent for client + server error aggregation.
- Pingdom or Vercel Monitoring for uptime alerts.
- Vercel Agent for production investigations.

## Logging

- **Server logs:** every Server Action's entry/exit logs the action name and result code (success vs. error code) — never the full payload (which would include monetary amounts and player names). Vercel function logs retain these for 7 days on the free tier.
- **Client logs:** browser console only. No client telemetry sent anywhere in MVP.
- **Audit trail:** the canonical record of every state-changing action is the per-session `change_log` subcollection (see `docs/05-data-model.md`). This is the durable audit log — Vercel function logs are ephemeral and supplementary.

## Database migrations in production

Firestore is schemaless — no DDL migrations. Schema evolution rules are documented in `docs/05-data-model.md → "Migration strategy"`. Summary:
- **Additive changes** (new field with default): deploy code first; old documents read with a fallback default.
- **Renaming/removing fields**: requires a backfill script. Document the script in the change spec; run it before deploying the consuming code.
- **Index changes**: composite indexes are declared in `firestore.indexes.json`. Merging a change to that file triggers the `Deploy Firestore Config` workflow (see "Firestore configuration" above) — approve the deploy before merging the consuming code, since index builds can take minutes on large collections.

No automated migration runner. All backfills are manual scripts under `/scripts/migrations/`, named by date (`scripts/migrations/2026-05-02-add-name-lower.ts`). Each migration script is idempotent and re-runnable.

## Related docs

- `03-architecture.md`
- `14-release-process.md`
- `15-local-development.md`
- `05-data-model.md`

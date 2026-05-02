# 10 — Deployment & Operations

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define how the application is deployed, monitored, and operated. Covers environments, secrets management, rollback strategy, and observability.

---

## Environments

| Environment | Branch/trigger | URL | Purpose |
|---|---|---|---|
| Local | n/a | `localhost:3000` | Development |
| Preview | feature branch push | Vercel preview URL | Review and QA |
| Production | `main` merge | Production URL | Live users |

## Deployment process

- Push to feature branch → Vercel preview deployment (automatic)
- Merge to `main` → Vercel production deployment (automatic)
- Do not use manual `vercel deploy` for normal workflow

## Environment variables

| Variable | Required in | Notes |
|---|---|---|
| | Local + Vercel | |

See `15-local-development.md` for local setup. Never commit secrets.

## Rollback strategy

<!-- How is a bad production deploy rolled back? Vercel supports instant rollback via the dashboard. -->

## Monitoring and alerting

<!-- Error tracking, uptime monitoring, performance monitoring. What tools? What alerts? -->

## Logging

<!-- What is logged? Where? Who has access? -->

## Database migrations in production

<!-- How are migrations run? Automated or manual? Zero-downtime strategy? -->

## Related docs

- `03-architecture.md`
- `14-release-process.md`
- `15-local-development.md`

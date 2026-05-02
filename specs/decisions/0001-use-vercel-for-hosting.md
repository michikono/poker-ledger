# ADR 0001 — Use Vercel for Hosting

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app is a Next.js application that needs hosting with:
- Automatic preview deployments per feature branch (essential for the worktree-first PR review workflow)
- Zero-config CI/CD for the main branch
- Environment variable management across environments
- A straightforward local-to-production parity story

## Decision

Use **Vercel** as the hosting platform.

## Consequences

- Feature branch pushes automatically create Vercel preview deployments — no CI configuration required for this.
- Merging to `main` automatically deploys to production.
- Environment variables are managed via `vercel env` and the Vercel dashboard, separate from the codebase.
- The Vercel CLI (`vercel link`, `vercel env pull`) is used for local setup, not for production deploys.
- Vendor coupling: the app uses Next.js Server Actions and RSC, which are optimized for Vercel's Fluid Compute runtime. Migrating off Vercel would require re-evaluating the rendering and mutation strategy.
- Cost: Vercel's free tier is sufficient for MVP scale. Costs scale with usage if the app grows.

## Alternatives Considered

- **Railway / Render**: simpler pricing, less Next.js-native. Preview deployments require more configuration. No native Next.js optimizations.
- **AWS Amplify**: more operational overhead. Preview deployments supported but less seamless.
- **Self-hosted (VPS + Docker)**: full control, lowest cost at scale. Significant ops overhead, no automatic preview deployments without additional tooling. Not appropriate for a small app at MVP stage.

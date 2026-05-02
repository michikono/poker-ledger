# ADR 0002 — Use Firestore as the Database

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app needs a database that:
- Fits a document-shaped data model (session → players → buy-ins; session → payments; session → changelog)
- Has a fully local emulator for offline development and CI without real credentials
- Integrates natively with Firebase Auth (the chosen auth provider)
- Has a generous free tier appropriate for MVP scale (small friend groups, infrequent writes)

## Decision

Use **Firestore** (Firebase) as the primary data store, with the **Firebase Emulator Suite** for local development and CI.

## Consequences

- The Firebase emulator (`demo-poker-ledger` demo project) enables fully offline local development with no Firebase account or credentials required.
- Each Git worktree gets isolated emulator data (`/.emulator-data/`), so switching branches switches data sets.
- Firestore Security Rules provide a second layer of access control beneath the Server Action authorization checks.
- NoSQL document model: no joins, no transactions across collections without explicit Firestore transactions. The hierarchical subcollection structure (sessions/{id}/players/{id}/buy_ins/{id}) maps cleanly to the domain model.
- Schema changes are managed additively (new fields) or via manual backfill scripts — no migration runner.
- Firestore free tier: 50K reads/day, 20K writes/day, 1GB storage. More than sufficient for MVP.
- Vendor coupling to Firebase ecosystem (Auth + Firestore). Migrating would require replacing both simultaneously.

## Alternatives Considered

- **PostgreSQL (Neon, Supabase)**: relational model is a better fit for complex queries; strong migration tooling. No official local emulator — requires a running Postgres instance or Docker for local dev. More operational setup.
- **SQLite (Turso)**: extremely simple, fully local. Limited ecosystem. Edge deployment story is different from Vercel Fluid Compute.
- **MongoDB Atlas**: similar document model. No free-tier local emulator equivalent. Less native Firebase Auth integration.

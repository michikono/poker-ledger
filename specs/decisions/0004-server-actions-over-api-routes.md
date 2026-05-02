# ADR 0004 — Use Next.js Server Actions for Mutations

**Status:** Accepted
**Date:** 2026-05-02

## Context

The app needs a mutation layer. In a Next.js 15 App Router application, the main options are:

- **Server Actions**: `"use server"` async functions called directly from client components
- **API Routes**: traditional `route.ts` handlers at `/api/*`
- **tRPC**: type-safe RPC layer over HTTP, works with Next.js
- **GraphQL**: query language + schema, typically over a single endpoint

## Decision

Use **Next.js Server Actions** for all mutations. Use **RSC (React Server Components)** for initial data reads. Use a single thin **API route** (`/api/sessions/search`) for the search autocomplete, which must be callable on user input without a form submission.

## Consequences

- Server Actions are co-located with the UI code that triggers them. No separate route file to maintain.
- Type safety end-to-end: the action's TypeScript signature is directly callable from the client — no serialization layer to keep in sync.
- Auth token is passed explicitly as a parameter to each action, verified server-side via Firebase Admin SDK. This is necessary because Server Actions do not have access to request headers in all invocation contexts.
- All mutations return a typed `ActionResult<T>` union (`{ success: true; data: T } | { success: false; error: ... }`), making error handling uniform.
- Server Actions are not independently HTTP-testable without the Next.js runtime. Integration tests for actions will call them directly as functions (with the Firebase emulator running) rather than via HTTP.
- The search API route is a deliberate exception: it needs to be an HTTP endpoint so the browser can call it on every keystroke without a Server Action's form-submission model.

## Alternatives Considered

- **API Routes for all mutations**: more familiar REST pattern; independently testable via HTTP. More boilerplate (route files, request parsing, response serialization). No inherent type safety between client and server without additional tooling.
- **tRPC**: excellent type safety, similar DX to Server Actions, HTTP-testable. Adds a dependency and an abstraction layer. For a small app, the overhead isn't justified over native Server Actions.
- **GraphQL**: significant schema and resolver overhead for a small, well-defined mutation surface. Not appropriate for MVP.

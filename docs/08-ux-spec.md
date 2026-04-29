# 08 — UX Spec

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Define the user interface at a functional level: screens, components, interactions, and states. This doc is not a pixel-perfect design — it is a functional contract that drives implementation.

---

## Design system

<!-- Component library (e.g., shadcn/ui, Radix, custom)? Tailwind? Typography scale? ADR reference: -->

## Screens

### Screen: [Name]

**Route:** `/path`
**Purpose:**
**Who sees it:** [all users / authenticated / role-gated]

**Components:**
- [Component name] — [what it does]

**States:**
- Loading
- Empty
- Populated
- Error

**Interactions:**
- [User action] → [result]

**Validation:**
- [Field] — [rules]

---

## Shared components

<!-- Components used across multiple screens. -->

## Navigation model

<!-- How does the user move between screens? Top nav, sidebar, tabs? -->

## Responsive behavior

<!-- Mobile-first? Which breakpoints matter? -->

## Accessibility requirements

<!-- WCAG level? Known keyboard navigation requirements? -->

## Error states and messaging

<!-- How are errors shown to the user? Toast, inline, full-page? -->

## Empty states

<!-- What does the user see when there is no data? -->

## Related docs

- `01-user-flows.md`
- `02-domain-model.md`
- `12-mvp-scope.md`

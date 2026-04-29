# 04 — Security Threat Model

> Status: Draft — fill this before Phase 1 begins.

## Purpose

Identify threats, attack surface, and mitigations before implementation. This doc should be updated whenever the architecture or data model changes significantly.

---

## Trust boundaries

<!-- Where does untrusted data enter the system? -->

## Assets to protect

| Asset | Sensitivity | Why |
|---|---|---|
| | | |

## Threat actors

| Actor | Motivation | Capability |
|---|---|---|
| External attacker | | |
| Malicious user | | |
| Compromised dependency | | |

## Threats and mitigations

| Threat | STRIDE category | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| | | | | | |

STRIDE categories: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.

## Authentication and authorization model

<!-- How are users authenticated? How are permissions enforced? Server-side or client-side? -->

## Data exposure risks

<!-- What data could be leaked? Via APIs, logs, error messages, client bundles? -->

## Dependency risks

<!-- Third-party packages with elevated risk. Review strategy. -->

## Secrets management

<!-- How are secrets managed locally and in production? -->

## Audit and logging

<!-- What events are logged? Where? Who has access? -->

## Open security questions

<!-- Move resolved ones to ADRs. -->

## Related docs

- `03-architecture.md`
- `06-api-contract.md`
- `07-business-logic.md`

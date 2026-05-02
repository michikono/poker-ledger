# Quality Gates Status

**Change spec / context:** `specs/changes/NNNN-<name>.md`
**Date:**

---

## Gate status table

| Gate | Command | Required: local completion | Required: merge | Current status | Failure notes | Remediation |
|---|---|---|---|---|---|---|
| Format | `npm run format:check` | Yes | Yes | | | |
| Lint | `npm run lint` | Yes | Yes | | | |
| Typecheck | `npm run typecheck` | Yes | Yes | | | |
| Unit tests | `npm test` | Yes | Yes | | | |
| Integration tests | `npm run test:integration` | Where feasible | Yes | | | |
| Build | `npm run build` | Yes | Yes | | | |
| Secrets scan | `npm run secrets:check` | Yes | Yes | | | |
| Local smoke test | Manual | Yes | Yes | | | |
| Aggregate | `npm run check` | Yes | Yes | | | |

Status values: `Pass` / `Fail` / `Not configured` / `Skipped (documented)` / `N/A`

---

## Missing gate documentation

If any gate is `Not configured` or `Skipped`:

| Gate | Why missing | When will it be introduced? | Follow-up spec/issue |
|---|---|---|---|
| | | | |

---

## Overall gate assessment

- [ ] All required gates pass
- [ ] All gate failures are documented with remediation plans
- [ ] No undocumented gate gaps

**Implementation is ready to declare complete:** Yes / No

If No, list what must be resolved:
- ...

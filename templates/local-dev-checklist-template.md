# Local Development Checklist

**Purpose:** Verify that a developer can set up and run the project locally from scratch.
**Date:**
**Tested on:** (OS, Node version)

---

## Fresh clone setup

- [ ] `git clone <repo-url>` succeeds
- [ ] `cd poker-ledger` enters the correct directory
- [ ] `.env.example` exists and is current

---

## Environment setup

- [ ] Node.js version matches `.nvmrc` or `engines.node` in `package.json`
- [ ] `cp .env.example .env.local` succeeds
- [ ] All variables in `.env.example` are filled in `.env.local`
- [ ] No variable in `.env.local` is left blank (unless blank is a valid local value)

Environment variables configured:

| Variable | Source | Status |
|---|---|---|
| | | |

---

## Install

- [ ] `npm install` completes without errors
- [ ] No deprecation warnings that indicate version mismatch

---

## Run

- [ ] `npm run dev` starts without errors
- [ ] App loads in browser at `localhost:3000`
- [ ] No console errors on page load
- [ ] Core user flows work end-to-end

---

## Test

- [ ] `npm test` passes
- [ ] Test output is clean (no unexpected skips or failures)

---

## Build

- [ ] `npm run build` completes without errors
- [ ] Build output is in expected location

---

## Aggregate gate

- [ ] `npm run check` passes (format + lint + typecheck + test + build)

---

## Known external dependencies

| Service | Required locally | How to configure |
|---|---|---|
| | | |

---

## Troubleshooting notes

| Symptom | Fix |
|---|---|
| | |

---

## Local dev verification result

- [ ] Local development works as documented
- [ ] `docs/15-local-development.md` is accurate and current
- [ ] Any gaps or issues documented above

**Result:** Pass / Fail / Pass with notes

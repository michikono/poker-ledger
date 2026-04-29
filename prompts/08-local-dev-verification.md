# Prompt: Local Dev Verification

Paste this into Claude Code to verify the local development setup works as documented.

---

Verify that the application can be set up and run locally by following the documented steps in `docs/15-local-development.md`.

Work through the checklist at `/templates/local-dev-checklist-template.md`:

1. **Environment setup** — Are all required environment variables documented in `.env.example`? Is `.env.local` correctly populated?
2. **Install** — Run `npm install`. Does it complete without errors?
3. **Dev server** — Run `npm run dev`. Does it start without errors? Does the app load at `localhost:3000`?
4. **Tests** — Run `npm test`. Do tests pass?
5. **Build** — Run `npm run build`. Does it succeed?
6. **Aggregate gate** — Run `npm run check`. Does it pass?
7. **Core flows** — Can you walk through the core user flows from `docs/01-user-flows.md` locally? List each flow and whether it works.

For each step:
- Report the result (Pass / Fail / Not applicable yet)
- If Fail, describe the error and propose a fix

Also:
- Is `docs/15-local-development.md` accurate? List any inaccuracies or missing steps.
- Are there any external service dependencies that aren't documented?
- Is the local development experience meaningfully different from what the docs describe?

Output a final verdict: **Local development is working** / **Issues found** (with a list of issues).

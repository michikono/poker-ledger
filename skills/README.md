# Project-Local Skills

This directory contains skill definitions for Claude Code in this project. Each skill describes a specific, reusable Claude behavior.

## What is a skill?

A skill is a markdown file that tells Claude Code how to behave for a specific class of task. Skills are not code — they are instructions.

Skills in this directory are **project-local**. They define behaviors tailored to this project's workflow, conventions, and quality standards.

## Two homes for skills

- **Reference skills (`/skills/*.md`, this directory)** — behavior-definition docs referenced by name. They are not slash-commands; invoke by asking Claude to "use the `<name>` skill."
- **Invokable skills (`.claude/skills/<name>/SKILL.md`)** — runnable as a `/<name>` slash command. Tracked and shared per ADR 0008 (the `.gitignore` exempts `.claude/skills/` just as it exempts `.claude/settings.json`). An invokable `SKILL.md` should **reference** the relevant reference skills, `/prompts`, and `/docs` rather than duplicate them.

| Invokable skill | When to use |
|---|---|
| `/spec` | Any non-trivial change (including UI-only tweaks). Drafts an `Accepted` change spec from the template, then implements it on a worktree with TDD, quality gates, and an auto-merged PR. |

## How to invoke a reference skill

Reference it explicitly in your prompt:

> "Use the `spec-reviewer` skill to review `specs/changes/0003-auth-model.md`."

Or paste the skill's contents into Claude Code before your request.

## When to use skills

| Skill | When to use |
|---|---|
| `spec-reviewer` | Reviewing design docs or change specs before accepting them |
| `change-spec-writer` | Turning an accepted doc section into a focused change spec |
| `implementation-planner` | Breaking an accepted change spec into a concrete implementation plan |
| `implementation-reviewer` | Reviewing completed implementation before marking it done |
| `release-checker` | Checking release readiness before merging to main |
| `quality-gate-checker` | Auditing the current state of deterministic quality gates |
| `local-dev-checker` | Verifying that local development works as documented |
| `worktree-guide` | Getting help with the Git worktree lifecycle |

## Skills vs. prompts

`/prompts/` contains copy-paste prompts for specific workflow steps.
`/skills/` contains behavior definitions that inform how Claude approaches a task.

They complement each other: a prompt describes what to do, a skill describes how to do it.

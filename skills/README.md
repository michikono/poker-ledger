# Project-Local Skills

This directory contains skill definitions for Claude Code in this project. Each skill describes a specific, reusable Claude behavior.

## What is a skill?

A skill is a markdown file that tells Claude Code how to behave for a specific class of task. Skills are not code — they are instructions.

Skills in this directory are **project-local**. They define behaviors tailored to this project's workflow, conventions, and quality standards.

## How to invoke a skill

Reference a skill explicitly in your prompt:

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

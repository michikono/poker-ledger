# 0008 — Track a shared, secret-free `.claude/skills/` directory

- Status: Accepted
- Date: 2026-06-18
- Deciders: Michi Kono

## Context

ADR 0007 established the tier-2 settings model for this public repo: commit exactly one shared, secret-free file — `.claude/settings.json` — and ignore everything else under `.claude/` (`.gitignore`: `.claude/*` then `!.claude/settings.json`). The reasoning was that a curated, project-wide configuration is shareable team state, not per-user state or secrets, and that the worktree workflow needs shared config to *travel* into new worktrees (gitignored files do not).

A 2026-06-11 usage report recommended adding an invokable Claude Code skill (`/spec`) to make the repo's spec-first workflow a one-command path. Claude Code discovers invokable skills at `.claude/skills/<name>/SKILL.md`. This creates a tension with ADR 0007:

- An invokable skill **must** live under `.claude/skills/` to be runnable as a slash command.
- Under the current `.gitignore`, anything under `.claude/` except `settings.json` is ignored — so such a skill would be **per-user and untracked**.

A per-user, untracked skill reproduces exactly the failure modes ADR 0007 fixed for settings:

- **Not shared.** Contributors (and the same person on a fresh clone) do not get the skill.
- **Does not travel to worktrees.** Since all work happens in worktrees (`docs/17-worktree-workflow.md`), an untracked skill in the main checkout is absent from the one place work happens.
- **Drifts from the documented process.** The skill encodes the operating model; an untracked copy silently diverges from CLAUDE.md and `/specs`.

This repo already keeps process *guidance* in the tracked top-level `skills/*.md` directory, but those files are reference documents (referenced by name or pasted into a prompt) — they are **not** Claude-Code-invokable slash commands. Getting a real, runnable `/spec` that is also shared and version-controlled requires the skill file to be both under `.claude/skills/` **and** tracked.

A skill is process instructions — markdown, no secrets, no per-user or machine-specific paths. It is precisely the shareable, world-readable configuration the tier-2 exception is designed for.

## Decision

Extend the `.claude/` exception established in ADR 0007 to also track the `.claude/skills/` directory:

```gitignore
.claude/*
!.claude/settings.json
!.claude/skills/
!.claude/skills/**
```

Rules for tracked files under `.claude/skills/` (same constraints as the committed `settings.json`):

- Markdown process instructions only — no secrets, tokens, or credentials.
- No per-user or machine-specific paths.
- World-readable: every change is public and must be reviewed as such.
- No outward-facing or destructive commands embedded as literal auto-run steps; a skill may *describe* a `gh pr create`/auto-merge procedure (as CLAUDE.md does in prose), but the permission to run those stays in a contributor's tier-1 or tier-3 settings, never granted by the skill.

Everything else under `.claude/` (transcripts, agent configs, MCP credentials, `settings.local.json`) remains ignored.

**Relationship to the existing top-level `skills/` directory.** The two coexist with distinct roles:

- `skills/*.md` — the broader reference library of behavior-definition docs, referenced by name (e.g. `change-spec-writer`, `worktree-guide`).
- `.claude/skills/<name>/SKILL.md` — invokable slash commands. A SKILL.md should **reference** the relevant `skills/*.md` and `/prompts` and `/docs` rather than duplicate them, so there is a single source of truth.

Migrating the entire `skills/` library into invokable skills is explicitly **out of scope** here; this ADR only authorizes tracking `.claude/skills/`, and the first occupant is `/spec` (change 0027).

## Consequences

- Invokable skills (starting with `/spec`) are shared across clones and travel into every worktree, consistent with how the repo treats settings and the rest of its process.
- Reviewers gain a new high-signal review item: `.claude/skills/**` is world-readable and must be secret-free, like `.claude/settings.json`.
- The `.claude/` ignore remains deny-by-default; only two surfaces (`settings.json`, `skills/`) are exceptions. Per-user state stays ignored.
- A small risk of confusion between `skills/` (reference) and `.claude/skills/` (invokable). Mitigated by documenting the distinction in `skills/README.md` (change 0027).

## Alternatives considered

- **Per-user untracked skill (status quo `.gitignore`).** Rejected: not shared, does not travel to worktrees, drifts from the documented process — the same flaws ADR 0007 fixed for settings.
- **Tracked guidance doc only, in `skills/`.** Rejected: not invokable as a slash command, which was the explicit goal of the recommendation.
- **Symlink a tracked `skills/spec.md` into `.claude/skills/`.** Rejected: symlinks under a gitignored prefix are brittle across clones/worktrees and obscure what is actually tracked.

## Impact on local development

None negative. Tracked skills travel into worktrees automatically, improving local consistency. No new dependency, env var, or service.

## Impact on quality gates

None. Skills are markdown; they add no code path to the deterministic gates. The secret-free constraint is enforced by review and (after change 0028) by the staged-content secret scan.

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-06-18 | Proposed | Initial draft. Extends ADR 0007 to track `.claude/skills/` so the `/spec` skill (change 0027) is shared and invokable. |
| 2026-06-18 | Accepted | Owner accepted alongside change 0027. |

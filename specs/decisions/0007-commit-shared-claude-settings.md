# 0007 — Commit a shared, secret-free `.claude/settings.json`

- Status: Accepted
- Date: 2026-06-08
- Deciders: Michi Kono

## Context

The repository previously gitignored the entire `.claude/` directory (`.gitignore`: `.claude/`), and CLAUDE.md mandated that it "must stay that way." The intent was sound — never commit per-user state, secrets, transcripts, agent configs, or MCP credentials on a public repo.

But the blanket ignore was over-broad. Claude Code's settings model has three tiers:

1. `~/.claude/settings.json` — per-user, all projects (never lives in a repo).
2. `<repo>/.claude/settings.json` — shared, committed, team baseline.
3. `<repo>/.claude/settings.local.json` — per-user, this repo only, gitignored.

Ignoring all of `.claude/` removed tier 2 entirely. Consequences:

- **No shared permission baseline.** Every contributor — and the same person on a fresh clone — re-accumulated permission grants from scratch, producing constant approval prompts.
- **Broken under the worktree workflow.** Gitignored files are not copied into new worktrees, so a per-user `settings.local.json` does not travel. Since all work in this project happens in worktrees (see `docs/17-worktree-workflow.md`), the only place a local settings file existed (the main checkout) was the one place work did not happen.
- **Tooling wrote to a dead file.** The `/fewer-permission-prompts` flow writes to `.claude/settings.json` by convention, silently producing an ignored, non-shared file.

A curated permission allowlist for the project's deterministic quality gates is neither a secret nor per-user state. It is exactly the shareable configuration tier 2 is designed for.

## Decision

Commit a single shared file, `.claude/settings.json`, containing only project-wide, secret-free configuration (permission rules for the standard dev/test/lint/typecheck gates and tooling). Ignore everything else under `.claude/`:

```gitignore
.claude/*
!.claude/settings.json
```

Rules for the committed file:

- No secrets, tokens, or credentials.
- No per-user or machine-specific paths.
- No outward-facing or destructive actions in the shared allowlist (e.g. `git push`, `gh pr create`, `curl`, `kill`/`pkill`). Those belong in a contributor's tier 1 (`~/.claude/settings.json`) or tier 3 (`.claude/settings.local.json`).
- Personal per-repo overrides go in `.claude/settings.local.json` (ignored).

CLAUDE.md's "Public repository" section is updated to match: permit committing this one curated file, forbid committing anything else under `.claude/`.

## Consequences

- A fresh clone and every worktree inherit the shared gate permissions — fewer prompts, consistent behavior across contributors and worktrees.
- Per-user state, transcripts, agent configs, MCP credentials, and personal overrides remain ignored.
- Reviewers must treat `.claude/settings.json` like any other public tracked file: every change is world-readable and must be secret-free. A new high-signal review item.
- The previous absolute "never edit `.gitignore` to remove the `.claude/` entry" guardrail is relaxed to a precise allow-one-file rule; this is a deliberate, documented deviation rather than ad hoc.

## Alternatives considered

- **Keep the blanket ignore (status quo).** Rejected: no shared baseline, broken under worktrees, contradicts the tool's three-tier design.
- **Put everything in tier 1 (`~/.claude/settings.json`).** Rejected: applies project-specific wildcards across all of the user's unrelated repos, and cannot be shared with contributors.
- **Commit `settings.local.json` instead.** Rejected: that file is per-user by convention and Claude Code auto-ignores it; tier 2 (`settings.json`) is the correct shared tier.

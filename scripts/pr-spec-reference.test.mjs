import { describe, expect, it } from "vitest";
import { evaluatePr } from "./pr-spec-reference.mjs";

const specs = [
  { name: "0031-spec-status-integrity.md", status: "Accepted" },
  { name: "0030-edit-guard.md", status: "Implemented" },
  { name: "0099-draft.md", status: "Proposed" },
];

describe("evaluatePr", () => {
  it("passes when the branch spec is Accepted", () => {
    const r = evaluatePr({
      branch: "spec/0031-spec-status-integrity",
      changedFiles: ["scripts/spec-status-guard.mjs"],
      specs,
    });
    expect(r.ok).toBe(true);
  });

  it("passes when the branch spec is Implemented", () => {
    const r = evaluatePr({
      branch: "fix/0030-edit-guard",
      changedFiles: ["scripts/claude-edit-guard.mjs"],
      specs,
    });
    expect(r.ok).toBe(true);
  });

  it("fails when the branch spec is still Proposed", () => {
    const r = evaluatePr({
      branch: "feature/0099-draft",
      changedFiles: ["src/app/page.tsx"],
      specs,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/is 'Proposed'/);
  });

  it("fails when the branch references a missing spec", () => {
    const r = evaluatePr({
      branch: "feature/0500-ghost",
      changedFiles: ["src/app/page.tsx"],
      specs,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/no specs\/changes\/0500-\*\.md exists/);
  });

  it("fails when a no-spec branch changes tracked source", () => {
    const r = evaluatePr({
      branch: "claude/some-fix",
      changedFiles: ["src/app/page.tsx", "README.md"],
      specs,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/carries no spec number/);
  });

  it("passes a no-spec-number branch that also changes an Accepted spec file", () => {
    const r = evaluatePr({
      branch: "claude/incomplete-skill-spec-emai3d",
      changedFiles: [
        "scripts/spec-status-guard.mjs",
        "specs/changes/0031-spec-status-integrity.md",
      ],
      specs,
    });
    expect(r.ok).toBe(true);
  });

  it("still fails when the changed spec file is only Proposed", () => {
    const r = evaluatePr({
      branch: "claude/some-fix",
      changedFiles: ["src/app/page.tsx", "specs/changes/0099-draft.md"],
      specs,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/no Accepted spec/);
  });

  it("passes a docs-only change on a no-spec branch", () => {
    const r = evaluatePr({
      branch: "claude/docs-tweak",
      changedFiles: ["docs/16-quality-gates.md", "README.md"],
      specs,
    });
    expect(r.ok).toBe(true);
  });

  it("treats firestore.rules and scripts/ as tracked source", () => {
    expect(
      evaluatePr({
        branch: "claude/x",
        changedFiles: ["firestore.rules"],
        specs,
      }).ok,
    ).toBe(false);
    expect(
      evaluatePr({
        branch: "claude/x",
        changedFiles: ["scripts/foo.mjs"],
        specs,
      }).ok,
    ).toBe(false);
  });
});

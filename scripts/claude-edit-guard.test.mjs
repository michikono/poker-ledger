import { describe, expect, it } from "vitest";
import {
  branchSpecNumber,
  decide,
  hasAcceptedSpecForBranch,
  isSourcePath,
} from "./claude-edit-guard.mjs";

describe("isSourcePath", () => {
  it("matches src/, scripts/, and firestore.rules", () => {
    expect(isSourcePath("/repo/src/app/page.tsx")).toBe(true);
    expect(isSourcePath("/repo/scripts/dev.mjs")).toBe(true);
    expect(isSourcePath("/repo/firestore.rules")).toBe(true);
    expect(isSourcePath("src/lib/x.ts")).toBe(true);
  });

  it("does not match docs, specs, or empty/undefined paths", () => {
    expect(isSourcePath("/repo/docs/16-quality-gates.md")).toBe(false);
    expect(isSourcePath("/repo/specs/changes/0028-x.md")).toBe(false);
    expect(isSourcePath("")).toBe(false);
    expect(isSourcePath(undefined)).toBe(false);
  });
});

describe("branchSpecNumber", () => {
  it("extracts a 4-digit spec number", () => {
    expect(branchSpecNumber("feature/0029-foo")).toBe("0029");
    expect(branchSpecNumber("chore/0028-lifecycle-hooks")).toBe("0028");
  });

  it("returns null when the branch has no spec number", () => {
    expect(branchSpecNumber("main")).toBe(null);
    expect(branchSpecNumber("docs/cleanup")).toBe(null);
  });
});

describe("hasAcceptedSpecForBranch", () => {
  const specs = [
    { name: "0028-lifecycle-hooks.md", status: "Accepted" },
    { name: "0030-draft.md", status: "Proposed" },
  ];

  it("is true when a matching ready spec exists", () => {
    expect(hasAcceptedSpecForBranch("chore/0028-lifecycle-hooks", specs)).toBe(
      true,
    );
  });

  it("is false when the matching spec is only Proposed", () => {
    expect(hasAcceptedSpecForBranch("feature/0030-draft", specs)).toBe(false);
  });

  it("is false when no spec matches", () => {
    expect(hasAcceptedSpecForBranch("feature/0099-x", specs)).toBe(false);
  });

  it("is true (no judgment) when the branch has no spec number", () => {
    expect(hasAcceptedSpecForBranch("docs/cleanup", specs)).toBe(true);
  });
});

describe("decide", () => {
  it("allows non-source edits anywhere", () => {
    expect(
      decide({ branch: "main", isSource: false, specReady: false }).action,
    ).toBe("allow");
  });

  it("denies source edits on main", () => {
    expect(
      decide({ branch: "main", isSource: true, specReady: true }).action,
    ).toBe("deny");
  });

  it("warns on a feature branch with no ready spec", () => {
    expect(
      decide({ branch: "feature/0099-x", isSource: true, specReady: false })
        .action,
    ).toBe("warn");
  });

  it("allows source edits on a feature branch with a ready spec", () => {
    expect(
      decide({ branch: "chore/0028-x", isSource: true, specReady: true })
        .action,
    ).toBe("allow");
  });
});

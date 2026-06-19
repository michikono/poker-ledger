import { describe, expect, it } from "vitest";
import {
  branchSpecNumber,
  decide,
  hasAcceptedSpecForBranch,
  isSourcePath,
  resolveBranch,
  resolveSpecsRoot,
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

describe("resolveBranch", () => {
  // gitBranch fake: session cwd (the main checkout) is on `main`, but the
  // file lives in a feature-branch worktree.
  const fakeGit = (byDir) => (dir) => byDir[dir] ?? "";

  it("uses the file worktree's branch even when cwd is main (regression)", () => {
    const gitBranch = fakeGit({
      "/repo": "main",
      "/wt/0030/scripts": "fix/0030-edit-guard-worktree-branch-resolution",
    });
    expect(
      resolveBranch({
        filePath: "/wt/0030/scripts/foo.mjs",
        cwd: "/repo",
        gitBranch,
      }),
    ).toBe("fix/0030-edit-guard-worktree-branch-resolution");
  });

  it("falls back to cwd when the file dir resolves no branch", () => {
    const gitBranch = fakeGit({ "/repo": "feature/0030-x" });
    expect(
      resolveBranch({
        filePath: "/somewhere/else/foo.mjs",
        cwd: "/repo",
        gitBranch,
      }),
    ).toBe("feature/0030-x");
  });

  it("uses cwd when file_path is absent", () => {
    const gitBranch = fakeGit({ "/repo": "feature/0030-x" });
    expect(
      resolveBranch({ filePath: undefined, cwd: "/repo", gitBranch }),
    ).toBe("feature/0030-x");
  });

  it("returns '' when neither file dir nor cwd resolves a branch", () => {
    const gitBranch = fakeGit({});
    expect(
      resolveBranch({ filePath: "/x/foo.mjs", cwd: "/y", gitBranch }),
    ).toBe("");
  });

  it("end-to-end: cwd main + file in feature worktree never denies", () => {
    const gitBranch = (dir) =>
      dir === "/wt/0030/scripts"
        ? "fix/0030-edit-guard-worktree-branch-resolution"
        : "main";
    const branch = resolveBranch({
      filePath: "/wt/0030/scripts/claude-edit-guard.mjs",
      cwd: "/repo",
      gitBranch,
    });
    const action = decide({ branch, isSource: true, specReady: true }).action;
    expect(action).not.toBe("deny");
    expect(action).toBe("allow");
  });
});

describe("resolveSpecsRoot", () => {
  const fakeTop = (byDir) => (dir) => byDir[dir] ?? "";

  it("returns the file worktree toplevel when resolvable", () => {
    const gitToplevel = fakeTop({
      "/repo": "/repo",
      "/wt/0030/scripts": "/wt/0030",
    });
    expect(
      resolveSpecsRoot({
        filePath: "/wt/0030/scripts/foo.mjs",
        cwd: "/repo",
        gitToplevel,
      }),
    ).toBe("/wt/0030");
  });

  it("falls back to cwd toplevel when the file dir has none", () => {
    const gitToplevel = fakeTop({ "/repo": "/repo" });
    expect(
      resolveSpecsRoot({
        filePath: "/x/foo.mjs",
        cwd: "/repo",
        gitToplevel,
      }),
    ).toBe("/repo");
  });

  it("falls back to cwd itself when nothing resolves", () => {
    const gitToplevel = fakeTop({});
    expect(
      resolveSpecsRoot({ filePath: "/x/foo.mjs", cwd: "/cwd", gitToplevel }),
    ).toBe("/cwd");
  });
});

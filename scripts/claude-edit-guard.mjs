import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_RE = /(^|\/)(src|scripts)\/|(^|\/)firestore\.rules$/;
const READY_STATUSES = new Set(["Accepted", "In Progress", "Implemented"]);

export function isSourcePath(filePath) {
  if (typeof filePath !== "string" || filePath === "") return false;
  return SOURCE_RE.test(filePath);
}

// "feature/0029-foo" -> "0029"; returns null when the branch carries no spec number.
export function branchSpecNumber(branch) {
  const match = /(?:^|\/)(\d{4})-/.exec(branch ?? "");
  return match ? match[1] : null;
}

// specs: [{ name: "0028-lifecycle-hooks.md", status: "Accepted" }]
export function hasAcceptedSpecForBranch(branch, specs) {
  const num = branchSpecNumber(branch);
  if (!num) return true;
  return specs.some(
    (s) => s.name.startsWith(`${num}-`) && READY_STATUSES.has(s.status),
  );
}

export function decide({ branch, isSource, specReady }) {
  if (!isSource) return { action: "allow" };
  if (branch === "main") {
    return {
      action: "deny",
      message:
        "Editing tracked source while on `main`. Per CLAUDE.md rule #11, implement on a worktree feature branch — create/enter a worktree and confirm `git branch --show-current` (≠ main) before editing.",
    };
  }
  if (!specReady) {
    return {
      action: "warn",
      message: `No Accepted change spec matches branch '${branch}'. Per rule #1 a spec should be Accepted before implementing (UI-only / "trivial" changes included). Warning only — proceeding is allowed.`,
    };
  }
  return { action: "allow" };
}

// Resolve the branch of the worktree that actually contains the edited file,
// not the Claude session cwd. A session anchored to the `main` checkout may
// legitimately edit files inside a feature-branch worktree; keying off the
// file's own directory avoids a false `main` deny. Falls back to cwd when the
// file path resolves no branch (missing/new path outside a repo).
// gitBranch(dir) -> branch string ("" on failure).
export function resolveBranch({ filePath, cwd, gitBranch }) {
  if (typeof filePath === "string" && filePath !== "") {
    const fromFile = gitBranch(dirname(filePath));
    if (fromFile) return fromFile;
  }
  return gitBranch(cwd);
}

// Resolve the worktree root that contains the edited file so the Accepted-spec
// check reads the right repo's `specs/changes`. Falls back to cwd.
// gitToplevel(dir) -> toplevel path string ("" on failure).
export function resolveSpecsRoot({ filePath, cwd, gitToplevel }) {
  if (typeof filePath === "string" && filePath !== "") {
    const fromFile = gitToplevel(dirname(filePath));
    if (fromFile) return fromFile;
  }
  return gitToplevel(cwd) || cwd;
}

function specStatus(body) {
  const match = /##\s*Status\s*\n+\s*([A-Za-z ]+)/.exec(body);
  return match ? match[1].trim() : "Unknown";
}

function readSpecs(root) {
  try {
    const dir = join(root, "specs/changes");
    return readdirSync(dir)
      .filter((f) => /^\d{4}-.*\.md$/.test(f))
      .map((f) => ({
        name: f,
        status: specStatus(readFileSync(join(dir, f), "utf8")),
      }));
  } catch {
    return [];
  }
}

function gitBranchOf(dir) {
  try {
    return execFileSync(
      "git",
      ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

function gitToplevelOf(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const filePath = payload?.tool_input?.file_path;
  const cwd = payload?.cwd ?? process.cwd();
  if (!isSourcePath(filePath)) process.exit(0);

  const branch = resolveBranch({ filePath, cwd, gitBranch: gitBranchOf });
  if (!branch) process.exit(0);

  const root = resolveSpecsRoot({ filePath, cwd, gitToplevel: gitToplevelOf });
  const result = decide({
    branch,
    isSource: true,
    specReady: hasAcceptedSpecForBranch(branch, readSpecs(root)),
  });

  if (result.action === "deny") {
    emit({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: result.message,
      },
    });
  }
  if (result.action === "warn") emit({ systemMessage: result.message });
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

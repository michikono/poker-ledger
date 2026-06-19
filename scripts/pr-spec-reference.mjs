import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { branchSpecNumber, isSourcePath } from "./claude-edit-guard.mjs";
import { extractStatusValue, normalizeStatus } from "./spec-status-guard.mjs";

// CI-side gate (runs on pull_request). A PR must not land code for an
// unaccepted (or missing) spec, and a code change must reference a spec at all.
// Deterministic, pure core; reuses the branch-slug heuristic from the edit
// guard and the status parser from the spec-status guard. See spec 0031.

const READY = new Set(["Accepted", "In Progress", "Implemented"]);
const CHANGED_SPEC_RE = /(?:^|\/)specs\/changes\/(\d{4})-[^/]*\.md$/;

function isReady(spec) {
  return spec ? READY.has(normalizeStatus(spec.status)) : false;
}

// specs: [{ name, status }] where status is the raw `## Status` value.
// A PR references its spec via the branch slug (authoritative when present) or
// via an Accepted+ specs/changes/NNNN-*.md file in its own diff.
export function evaluatePr({ branch, changedFiles, specs }) {
  const errors = [];
  const files = changedFiles ?? [];
  const allSpecs = specs ?? [];
  const branchNum = branchSpecNumber(branch);
  const touchesSource = files.some(isSourcePath);

  if (branchNum) {
    const match = allSpecs.find((s) => s.name.startsWith(`${branchNum}-`));
    if (!match) {
      errors.push(
        `branch '${branch}' references spec ${branchNum}, but no specs/changes/${branchNum}-*.md exists`,
      );
    } else if (!isReady(match)) {
      const shown = normalizeStatus(match.status) ?? match.status;
      errors.push(
        `spec ${branchNum} (${match.name}) is '${shown}'; code must not land until it is Accepted (or later)`,
      );
    }
    return { ok: errors.length === 0, errors };
  }

  if (touchesSource) {
    const changedReadySpec = files.some((f) => {
      const m = CHANGED_SPEC_RE.exec(f);
      return m && isReady(allSpecs.find((s) => s.name.startsWith(`${m[1]}-`)));
    });
    if (!changedReadySpec) {
      errors.push(
        `PR changes tracked source but branch '${branch}' carries no spec number and the diff contains no Accepted spec. Name the branch <type>/NNNN-slug, change the Accepted spec in this PR, or keep the change docs-only.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function gitChangedFiles() {
  try {
    return execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
      encoding: "utf8",
    })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function gitCurrentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function readSpecs(root) {
  try {
    const dir = join(root, "specs/changes");
    return readdirSync(dir)
      .filter((f) => /^\d{4}-.*\.md$/.test(f))
      .map((f) => ({
        name: f,
        status: extractStatusValue(readFileSync(join(dir, f), "utf8")) ?? "",
      }));
  } catch {
    return [];
  }
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const branch = process.env.GITHUB_HEAD_REF || gitCurrentBranch();
  const { ok, errors } = evaluatePr({
    branch,
    changedFiles: gitChangedFiles(),
    specs: readSpecs(root),
  });
  if (ok) process.exit(0);
  process.stderr.write("\n✖ PR spec-reference gate:\n");
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.stderr.write(
    "\nEvery code change needs an Accepted spec (CLAUDE.md rule #1). See specs/changes/README.md.\n\n",
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

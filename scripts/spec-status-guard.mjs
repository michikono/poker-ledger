import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Deterministic spec-status linter. For every specs/changes/NNNN-*.md it fails
// fast when the lifecycle status is malformed or self-inconsistent: an invalid
// `## Status` value, a `## Status` that disagrees with the latest Status-history
// row, an illegal transition between consecutive history rows, or out-of-order
// (non-monotonic) history dates. Pure node, no dependency; wired into
// `npm run check` and the lefthook pre-commit. See spec 0031.

export const STATUSES = [
  "Proposed",
  "Accepted",
  "In Progress",
  "Implemented",
  "Superseded",
];

// Ranked lifecycle. A transition is legal when it moves forward or stays at the
// same rank (forward skips allowed — real specs go Proposed -> Implemented),
// when the target is Superseded (reachable from any active state), or when it
// is an explicitly annotated backward move (a documented revert, e.g. spec
// 0005's "In Progress (rebase)"). A silent backslide or any move out of the
// terminal Superseded is illegal. See spec 0031.
const RANK = { Proposed: 0, Accepted: 1, "In Progress": 2, Implemented: 3 };

// from/to are { status, raw } where status is the normalized enum (or null).
export function transitionLegal(from, to) {
  if (from.status === null || to.status === null) return true; // reported elsewhere
  if (from.status === to.status) return true;
  if (from.status === "Superseded") return false; // terminal
  if (to.status === "Superseded") return true;
  if (RANK[to.status] > RANK[from.status]) return true; // forward / skip
  return /\(/.test(to.raw ?? ""); // backward only if annotated
}

// Map a raw status cell to its canonical enum word, tolerating trailing
// annotations (e.g. "Implemented (revised 2026-05-09 ...)" -> "Implemented").
// Returns null when the value is not a recognized status.
export function normalizeStatus(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  for (const s of [...STATUSES].sort((a, b) => b.length - a.length)) {
    if (t === s || t.startsWith(`${s} `) || t.startsWith(`${s}(`)) return s;
  }
  return null;
}

// Extract the `## Status` value (the first non-blank line after the heading).
// The `\r?\n` right after "Status" prevents matching "## Status history".
export function extractStatusValue(body) {
  const m = /(?:^|\n)##\s+Status[ \t]*\r?\n+([^\n]+)/.exec(body ?? "");
  return m ? m[1].trim() : null;
}

// Parse the `## Status history` markdown table into [{ date, status }] rows
// (header + separator skipped). Returns null when the table is absent.
export function extractHistoryRows(body) {
  const idx = (body ?? "").search(/(?:^|\n)##\s+Status history[ \t]*\r?\n/);
  if (idx === -1) return null;
  const rows = [];
  for (const line of body.slice(idx).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (rows.length > 0) break;
      continue;
    }
    const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    const cells = inner.split("|").map((c) => c.trim());
    const date = cells[0] ?? "";
    if (date.toLowerCase() === "date") continue;
    if (/^:?-+:?$/.test(date)) continue;
    rows.push({ date, status: cells[1] ?? "" });
  }
  return rows;
}

// Pure validation core: given the parsed status value + history rows, return
// ok + human-readable errors. ISO dates compare correctly as strings.
export function validateSpec({ statusValue, historyRows }) {
  const errors = [];
  const status = normalizeStatus(statusValue);

  if (statusValue === null) {
    errors.push("missing '## Status' section");
  } else if (status === null) {
    errors.push(
      `invalid '## Status' value: '${statusValue}' (expected one of: ${STATUSES.join(", ")})`,
    );
  }

  if (historyRows === null) {
    errors.push("missing or unparseable '## Status history' table");
    return { ok: false, errors };
  }
  if (historyRows.length === 0) {
    errors.push("'## Status history' table has no rows");
  }

  const norm = historyRows.map((r) => ({
    date: r.date,
    status: normalizeStatus(r.status),
    raw: r.status,
  }));
  for (const r of norm) {
    if (r.status === null) {
      errors.push(`invalid status in history row: '${r.raw}'`);
    }
  }

  if (norm.length > 0 && status !== null) {
    const last = norm[norm.length - 1];
    if (last.status !== null && last.status !== status) {
      errors.push(
        `'## Status' (${status}) does not match the latest history row (${last.status})`,
      );
    }
  }

  for (let i = 1; i < norm.length; i++) {
    const from = norm[i - 1];
    const to = norm[i];
    if (!transitionLegal(from, to)) {
      errors.push(`illegal transition: ${from.status} -> ${to.status}`);
    }
  }

  let prevDate = null;
  for (const r of norm) {
    if (!r.date) continue;
    if (prevDate !== null && r.date < prevDate) {
      errors.push(
        `status history dates not monotonic: ${r.date} after ${prevDate}`,
      );
    }
    prevDate = r.date;
  }

  return { ok: errors.length === 0, errors };
}

export function checkSpecBody(body) {
  return validateSpec({
    statusValue: extractStatusValue(body),
    historyRows: extractHistoryRows(body),
  });
}

function specFiles(dir) {
  return readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f));
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = join(root, "specs/changes");
  const failures = [];
  for (const file of specFiles(dir)) {
    const { ok, errors } = checkSpecBody(readFileSync(join(dir, file), "utf8"));
    if (!ok) failures.push({ file, errors });
  }
  if (failures.length === 0) process.exit(0);
  process.stderr.write("\n✖ spec-status guard:\n");
  for (const { file, errors } of failures) {
    process.stderr.write(`  ${file}:\n`);
    for (const e of errors) process.stderr.write(`    - ${e}\n`);
  }
  process.stderr.write(
    "\nFix the spec's '## Status' line and '## Status history' table so they agree and follow legal transitions. See specs/changes/README.md. Bypass (not recommended): git commit --no-verify\n\n",
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

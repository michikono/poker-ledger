import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkSpecBody,
  extractHistoryRows,
  extractStatusValue,
  normalizeStatus,
  validateSpec,
} from "./spec-status-guard.mjs";

describe("normalizeStatus", () => {
  it("returns the canonical word for exact matches", () => {
    expect(normalizeStatus("Accepted")).toBe("Accepted");
    expect(normalizeStatus("In Progress")).toBe("In Progress");
  });

  it("tolerates trailing annotations", () => {
    expect(normalizeStatus("Implemented (revised 2026-05-09 ...)")).toBe(
      "Implemented",
    );
  });

  it("returns null for unknown values", () => {
    expect(normalizeStatus("Done")).toBeNull();
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
  });
});

describe("extractStatusValue", () => {
  it("reads the value under '## Status', not '## Status history'", () => {
    const body =
      "# Change\n\n## Status\nAccepted\n\n## Status history\n\n| Date | Status | Notes |\n|---|---|---|\n| 2026-06-19 | Accepted | ok |\n";
    expect(extractStatusValue(body)).toBe("Accepted");
  });

  it("returns null when there is no Status section", () => {
    expect(extractStatusValue("# Change\n\n## Goal\nx\n")).toBeNull();
  });
});

describe("extractHistoryRows", () => {
  it("parses data rows and skips header/separator", () => {
    const body =
      "## Status history\n\n| Date | Status | Notes |\n|---|---|---|\n| 2026-06-18 | Proposed | a |\n| 2026-06-19 | Accepted | b |\n";
    expect(extractHistoryRows(body)).toEqual([
      { date: "2026-06-18", status: "Proposed" },
      { date: "2026-06-19", status: "Accepted" },
    ]);
  });

  it("returns null when the table is absent", () => {
    expect(extractHistoryRows("## Status\nAccepted\n")).toBeNull();
  });
});

describe("validateSpec", () => {
  const rows = [
    { date: "2026-06-18", status: "Proposed" },
    { date: "2026-06-19", status: "Accepted" },
  ];

  it("passes a well-formed, self-consistent spec", () => {
    const r = validateSpec({ statusValue: "Accepted", historyRows: rows });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("allows skipping In Progress (Accepted -> Implemented)", () => {
    const r = validateSpec({
      statusValue: "Implemented",
      historyRows: [...rows, { date: "2026-06-20", status: "Implemented" }],
    });
    expect(r.ok).toBe(true);
  });

  it("allows a forward skip (Proposed -> Implemented)", () => {
    const r = validateSpec({
      statusValue: "Implemented",
      historyRows: [
        { date: "2026-05-02", status: "Proposed" },
        { date: "2026-05-02", status: "Implemented" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("allows an annotated backward move (premature revert)", () => {
    const r = validateSpec({
      statusValue: "Implemented",
      historyRows: [
        { date: "2026-05-02", status: "Accepted" },
        { date: "2026-05-02", status: "Implemented (premature)" },
        { date: "2026-05-02", status: "In Progress (rebase)" },
        { date: "2026-05-02", status: "Implemented" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a silent (unannotated) backward move", () => {
    const r = validateSpec({
      statusValue: "In Progress",
      historyRows: [
        { date: "2026-05-02", status: "Implemented" },
        { date: "2026-05-03", status: "In Progress" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(
      /illegal transition: Implemented -> In Progress/,
    );
  });

  it("allows Implemented -> Superseded", () => {
    const r = validateSpec({
      statusValue: "Superseded",
      historyRows: [
        { date: "2026-01-01", status: "Accepted" },
        { date: "2026-01-02", status: "Implemented" },
        { date: "2026-02-01", status: "Superseded" },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("fails when ## Status is not a valid enum", () => {
    const r = validateSpec({ statusValue: "Done", historyRows: rows });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/invalid '## Status' value/);
  });

  it("fails when ## Status disagrees with the latest history row", () => {
    const r = validateSpec({ statusValue: "Proposed", historyRows: rows });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/does not match the latest history row/);
  });

  it("fails on an illegal transition", () => {
    const r = validateSpec({
      statusValue: "Accepted",
      historyRows: [
        { date: "2026-06-18", status: "Implemented" },
        { date: "2026-06-19", status: "Accepted" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(
      /illegal transition: Implemented -> Accepted/,
    );
  });

  it("fails on non-monotonic dates", () => {
    const r = validateSpec({
      statusValue: "Accepted",
      historyRows: [
        { date: "2026-06-19", status: "Proposed" },
        { date: "2026-06-18", status: "Accepted" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/not monotonic/);
  });

  it("fails when the history table is missing", () => {
    const r = validateSpec({ statusValue: "Accepted", historyRows: null });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(
      /missing or unparseable '## Status history'/,
    );
  });

  it("fails when the Status section is missing", () => {
    const r = validateSpec({ statusValue: null, historyRows: rows });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/missing '## Status' section/);
  });
});

describe("repository specs are all consistent", () => {
  it("every specs/changes/NNNN-*.md passes the guard", () => {
    const dir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "specs/changes",
    );
    const failures = [];
    for (const file of readdirSync(dir).filter((f) =>
      /^\d{4}-.*\.md$/.test(f),
    )) {
      const { ok, errors } = checkSpecBody(
        readFileSync(join(dir, file), "utf8"),
      );
      if (!ok) failures.push(`${file}: ${errors.join("; ")}`);
    }
    expect(failures).toEqual([]);
  });
});

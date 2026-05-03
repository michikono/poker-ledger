import { describe, expect, it } from "vitest";
import { getValidTransitions, validateTransition } from "./transitions";
import type { SessionStatus } from "./types";

const ALL_STATUSES = [
  "in_progress",
  "settling",
  "settled",
  "archived",
] as const satisfies readonly SessionStatus[];

const RECOVERABLE_STATUSES = [
  "in_progress",
  "settling",
  "settled",
] as const satisfies readonly SessionStatus[];

type Allowed = readonly [SessionStatus, SessionStatus];

const NON_ARCHIVED_ALLOWED: readonly Allowed[] = [
  ["in_progress", "settling"],
  ["in_progress", "settled"],
  ["in_progress", "archived"],
  ["settling", "in_progress"],
  ["settling", "settled"],
  ["settling", "archived"],
  ["settled", "settling"],
  ["settled", "archived"],
];

function isAllowedNonArchivedSource(
  from: SessionStatus,
  to: SessionStatus,
): boolean {
  return NON_ARCHIVED_ALLOWED.some(([f, t]) => f === from && t === to);
}

describe("validateTransition — cross product (non-archived source)", () => {
  for (const from of ALL_STATUSES) {
    if (from === "archived") continue;
    for (const to of ALL_STATUSES) {
      const expected = isAllowedNonArchivedSource(from, to);
      it(`${from} → ${to} is ${expected ? "allowed" : "denied"}`, () => {
        const result = validateTransition({ from, to });
        if (expected) {
          expect(result).toEqual({ ok: true });
        } else {
          expect(result).toEqual({
            ok: false,
            code: "INVALID_STATE_TRANSITION",
          });
        }
      });
    }
  }
});

describe("validateTransition — same-state transitions are denied", () => {
  for (const status of ALL_STATUSES) {
    it(`${status} → ${status} is denied`, () => {
      const result =
        status === "archived"
          ? validateTransition({
              from: status,
              to: status,
              previousStatus: status,
            })
          : validateTransition({ from: status, to: status });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_STATE_TRANSITION",
      });
    });
  }
});

describe("validateTransition — unarchive edge cases", () => {
  it("archived → in_progress with previousStatus=in_progress is allowed", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "in_progress",
        previousStatus: "in_progress",
      }),
    ).toEqual({ ok: true });
  });

  it("archived → settling with previousStatus=settling is allowed", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "settling",
        previousStatus: "settling",
      }),
    ).toEqual({ ok: true });
  });

  it("archived → settled with previousStatus=settled is allowed", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "settled",
        previousStatus: "settled",
      }),
    ).toEqual({ ok: true });
  });

  it("archived → in_progress with mismatched previousStatus=settling is denied", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "in_progress",
        previousStatus: "settling",
      }),
    ).toEqual({ ok: false, code: "INVALID_STATE_TRANSITION" });
  });

  it("archived → in_progress with previousStatus=undefined is denied", () => {
    expect(validateTransition({ from: "archived", to: "in_progress" })).toEqual(
      { ok: false, code: "INVALID_STATE_TRANSITION" },
    );
  });

  it("archived → in_progress with previousStatus=null is denied", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "in_progress",
        previousStatus: null,
      }),
    ).toEqual({ ok: false, code: "INVALID_STATE_TRANSITION" });
  });

  it("archived → in_progress with corrupt previousStatus=archived is denied", () => {
    expect(
      validateTransition({
        from: "archived",
        to: "in_progress",
        previousStatus: "archived",
      }),
    ).toEqual({ ok: false, code: "INVALID_STATE_TRANSITION" });
  });

  it("archived → archived is denied regardless of previousStatus", () => {
    for (const previousStatus of [...ALL_STATUSES, null, undefined] as const) {
      const ctx =
        previousStatus === undefined
          ? { from: "archived" as const, to: "archived" as const }
          : {
              from: "archived" as const,
              to: "archived" as const,
              previousStatus,
            };
      expect(validateTransition(ctx)).toEqual({
        ok: false,
        code: "INVALID_STATE_TRANSITION",
      });
    }
  });

  it("non-archived → archived ignores previousStatus", () => {
    for (const previousStatus of [...ALL_STATUSES, null, undefined] as const) {
      const ctx =
        previousStatus === undefined
          ? { from: "in_progress" as const, to: "archived" as const }
          : {
              from: "in_progress" as const,
              to: "archived" as const,
              previousStatus,
            };
      expect(validateTransition(ctx)).toEqual({ ok: true });
    }
  });
});

describe("getValidTransitions", () => {
  it("from in_progress returns [settling, settled, archived]", () => {
    expect(new Set(getValidTransitions("in_progress"))).toEqual(
      new Set(["settling", "settled", "archived"]),
    );
    expect(getValidTransitions("in_progress")).toHaveLength(3);
  });

  it("from settling returns [in_progress, settled, archived]", () => {
    expect(new Set(getValidTransitions("settling"))).toEqual(
      new Set(["in_progress", "settled", "archived"]),
    );
    expect(getValidTransitions("settling")).toHaveLength(3);
  });

  it("from settled returns [settling, archived]", () => {
    expect(new Set(getValidTransitions("settled"))).toEqual(
      new Set(["settling", "archived"]),
    );
    expect(getValidTransitions("settled")).toHaveLength(2);
  });

  it("from archived with previousStatus=in_progress returns [in_progress]", () => {
    expect(getValidTransitions("archived", "in_progress")).toEqual([
      "in_progress",
    ]);
  });

  it("from archived with previousStatus=settling returns [settling]", () => {
    expect(getValidTransitions("archived", "settling")).toEqual(["settling"]);
  });

  it("from archived with previousStatus=settled returns [settled]", () => {
    expect(getValidTransitions("archived", "settled")).toEqual(["settled"]);
  });

  it("from archived with previousStatus=null returns []", () => {
    expect(getValidTransitions("archived", null)).toEqual([]);
  });

  it("from archived with previousStatus=undefined returns []", () => {
    expect(getValidTransitions("archived")).toEqual([]);
  });

  it("from archived with corrupt previousStatus=archived returns []", () => {
    expect(getValidTransitions("archived", "archived")).toEqual([]);
  });

  it("ignores previousStatus when from is non-archived", () => {
    for (const previousStatus of [...ALL_STATUSES, null, undefined] as const) {
      expect(
        new Set(getValidTransitions("in_progress", previousStatus)),
      ).toEqual(new Set(["settling", "settled", "archived"]));
    }
  });
});

describe("consistency invariant — validateTransition agrees with getValidTransitions", () => {
  const PREVIOUS_VARIANTS = [...ALL_STATUSES, null, undefined] as const;

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      for (const previousStatus of PREVIOUS_VARIANTS) {
        const label = `from=${from}, to=${to}, previousStatus=${String(previousStatus)}`;
        it(`agrees for ${label}`, () => {
          const ctx =
            previousStatus === undefined
              ? { from, to }
              : { from, to, previousStatus };
          const validated = validateTransition(ctx).ok;
          const listed = getValidTransitions(from, previousStatus).includes(to);
          expect(validated).toBe(listed);
        });
      }
    }
  }
});

describe("recoverable status invariant", () => {
  it("RECOVERABLE_STATUSES is exactly the set of non-archived statuses", () => {
    expect(new Set(RECOVERABLE_STATUSES)).toEqual(
      new Set(ALL_STATUSES.filter((s) => s !== "archived")),
    );
  });
});

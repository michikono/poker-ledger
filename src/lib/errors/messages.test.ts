import { describe, expect, it } from "vitest";
import {
  describeErrorCode,
  GENERIC_ERROR,
  type ServerActionErrorCode,
} from "./messages";

describe("describeErrorCode", () => {
  // Table-driven: each known code maps to its expected message.
  const cases: Array<[ServerActionErrorCode, string]> = [
    ["UNAUTHENTICATED", "Session expired. Please sign in again."],
    ["SESSION_NOT_FOUND", "Session not found."],
    [
      "SESSION_NOT_EDITABLE",
      "This session can't be edited in its current state.",
    ],
    ["INVALID_STATE_TRANSITION", "Can't perform that action right now."],
    ["DUPLICATE_PLAYER_NAME", "A player with that name already exists."],
    [
      "INVALID_VENMO_USERNAME",
      "Venmo username must be 5–30 characters: letters, digits, _ . or -.",
    ],
    ["PAYMENT_NOT_FOUND", "Some data is out of date. Refreshing."],
    ["PLAYER_NOT_FOUND", "Some data is out of date. Refreshing."],
    ["BUY_IN_NOT_FOUND", "Some data is out of date. Refreshing."],
    ["INVALID_INPUT", "All players must have a cash-out set."],
    [
      "BALANCE_OUT_OF_RANGE",
      "Cash-outs do not match buy-ins within tolerance.",
    ],
    ["INTERNAL_ERROR", GENERIC_ERROR],
    ["INVALID_AMOUNT", GENERIC_ERROR],
    ["INVALID_PLAYER_NAME", GENERIC_ERROR],
    ["NAME_COLLISION", GENERIC_ERROR],
  ];

  it.each(cases)("maps %s to its specific message", (code, expected) => {
    expect(describeErrorCode(code)).toBe(expected);
  });

  it("returns GENERIC_ERROR for an unknown code", () => {
    expect(describeErrorCode("TOTALLY_NOT_A_REAL_CODE")).toBe(GENERIC_ERROR);
  });

  it("returns GENERIC_ERROR for an empty string", () => {
    expect(describeErrorCode("")).toBe(GENERIC_ERROR);
  });
});

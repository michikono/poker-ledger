import { describe, expect, it } from "vitest";
import { buildVenmoPayUrl, formatVenmoNote, parseVenmoHandle } from "./url";

describe("parseVenmoHandle", () => {
  it("returns the canonical handle when valid", () => {
    expect(parseVenmoHandle("alice123")).toBe("alice123");
  });

  it("strips a single leading @", () => {
    expect(parseVenmoHandle("@alice123")).toBe("alice123");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(parseVenmoHandle("  alice123  ")).toBe("alice123");
    expect(parseVenmoHandle(" @alice123 ")).toBe("alice123");
  });

  it("accepts dots, underscores, and hyphens", () => {
    expect(parseVenmoHandle("a_b.c-d")).toBe("a_b.c-d");
    expect(parseVenmoHandle("user.name")).toBe("user.name");
  });

  it("returns null for handles shorter than 5 characters", () => {
    expect(parseVenmoHandle("abcd")).toBeNull();
    expect(parseVenmoHandle("@abcd")).toBeNull();
  });

  it("returns null for handles longer than 30 characters", () => {
    expect(parseVenmoHandle("a".repeat(31))).toBeNull();
  });

  it("accepts handles up to exactly 30 characters", () => {
    expect(parseVenmoHandle("a".repeat(30))).toBe("a".repeat(30));
  });

  it("returns null for handles containing disallowed characters", () => {
    expect(parseVenmoHandle("alice@bob")).toBeNull();
    expect(parseVenmoHandle("alice space")).toBeNull();
    expect(parseVenmoHandle("alice/bob")).toBeNull();
    expect(parseVenmoHandle("alice!")).toBeNull();
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(parseVenmoHandle("")).toBeNull();
    expect(parseVenmoHandle("   ")).toBeNull();
    expect(parseVenmoHandle("@")).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(parseVenmoHandle(null)).toBeNull();
    expect(parseVenmoHandle(undefined)).toBeNull();
  });

  it("does not strip multiple leading @ symbols (only one)", () => {
    expect(parseVenmoHandle("@@alice")).toBeNull();
  });
});

describe("buildVenmoPayUrl", () => {
  it("returns a venmo.com URL with txn=pay, amount, and note when handle is valid", () => {
    const url = buildVenmoPayUrl({
      handle: "alice123",
      amountCents: 1250,
      // U+00A0 between words — see formatVenmoNote for why.
      note: "Poker on 2026-05-04 (Friday game)",
    });
    expect(url).toBe(
      "https://venmo.com/alice123?txn=pay&amount=12.50&note=Poker%C2%A0on%C2%A02026-05-04%C2%A0(Friday%C2%A0game)",
    );
  });

  it("formats the amount with two decimals", () => {
    const url = buildVenmoPayUrl({
      handle: "alice123",
      amountCents: 100,
      note: "x",
    });
    expect(url).toContain("amount=1.00");
  });

  it("formats whole-dollar amounts as N.00", () => {
    const url = buildVenmoPayUrl({
      handle: "alice123",
      amountCents: 5000,
      note: "x",
    });
    expect(url).toContain("amount=50.00");
  });

  it("percent-encodes unicode characters in the note", () => {
    const url = buildVenmoPayUrl({
      handle: "alice123",
      amountCents: 100,
      note: "café",
    });
    expect(url).toContain("note=caf%C3%A9");
  });

  it("strips a leading @ from the handle", () => {
    const url = buildVenmoPayUrl({
      handle: "@alice123",
      amountCents: 100,
      note: "x",
    });
    expect(url).toContain("https://venmo.com/alice123?");
  });

  it("returns null when the handle is invalid", () => {
    expect(
      buildVenmoPayUrl({
        handle: "no spaces",
        amountCents: 100,
        note: "x",
      }),
    ).toBeNull();
  });

  it("returns null when amountCents is zero or negative", () => {
    expect(
      buildVenmoPayUrl({ handle: "alice123", amountCents: 0, note: "x" }),
    ).toBeNull();
    expect(
      buildVenmoPayUrl({ handle: "alice123", amountCents: -100, note: "x" }),
    ).toBeNull();
  });

  it("returns null when amountCents is not an integer", () => {
    expect(
      buildVenmoPayUrl({ handle: "alice123", amountCents: 12.5, note: "x" }),
    ).toBeNull();
  });
});

describe("formatVenmoNote", () => {
  it("uses non-breaking spaces between segments so Venmo's note UI renders them as spaces", () => {
    // new Date(year, monthIndex, day) constructs a local-time Date, so the
    // year/month/day we pass in are exactly what the formatter should emit
    // regardless of the test runner's TZ.
    expect(
      formatVenmoNote({
        name: "friday-game",
        createdAt: new Date(2026, 4, 4, 12, 0, 0),
      }),
    ).toBe("Poker on 2026-05-04 (friday-game)");
  });

  it("zero-pads single-digit months and days", () => {
    expect(
      formatVenmoNote({
        name: "x",
        createdAt: new Date(2026, 0, 9, 12, 0, 0),
      }),
    ).toBe("Poker on 2026-01-09 (x)");
  });

  it("normalizes whitespace inside the session name to NBSP", () => {
    expect(
      formatVenmoNote({
        name: "Friday Night (deluxe)",
        createdAt: new Date(2026, 4, 4, 12, 0, 0),
      }),
    ).toBe("Poker on 2026-05-04 (Friday Night (deluxe))");
  });
});

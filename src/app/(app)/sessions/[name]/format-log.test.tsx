import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatRelativeTime, renderLogDescription } from "./format-log";

function renderParts(description: string) {
  const { container } = render(<p>{renderLogDescription(description)}</p>);
  return container;
}

describe("renderLogDescription", () => {
  it("renders plain text without markers as text", () => {
    const c = renderParts("Alice added a player.");
    expect(c.textContent).toBe("Alice added a player.");
    expect(c.querySelector("strong")).toBeNull();
  });

  it("renders **amount** as bold", () => {
    const c = renderParts("Alice added **$50.00** buy-in.");
    expect(c.textContent).toBe("Alice added $50.00 buy-in.");
    const strong = c.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("$50.00");
  });

  it("renders multiple markers", () => {
    const c = renderParts("**$10.00** plus **$5.00** equals **$15.00**.");
    const strongs = c.querySelectorAll("strong");
    expect(strongs).toHaveLength(3);
    expect(strongs[0]?.textContent).toBe("$10.00");
    expect(strongs[1]?.textContent).toBe("$5.00");
    expect(strongs[2]?.textContent).toBe("$15.00");
  });

  it("does not interpret single asterisks", () => {
    const c = renderParts("a*b*c");
    expect(c.textContent).toBe("a*b*c");
    expect(c.querySelector("strong")).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-05-03T18:00:00.000Z");

  it("returns 'just now' for very recent times", () => {
    const t = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelativeTime(t, now)).toBe("just now");
  });

  it("returns Xm ago when within the hour", () => {
    const t = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(t, now)).toBe("5m ago");
  });

  it("returns Xh ago for hours-old timestamps", () => {
    const t = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(t, now)).toBe("3h ago");
  });

  it("returns 'Yesterday at <time>' for yesterday", () => {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(15, 0, 0, 0);
    expect(formatRelativeTime(yesterday.toISOString(), now)).toMatch(
      /Yesterday at/,
    );
  });

  it("returns absolute date for older entries", () => {
    const t = new Date("2026-04-15T15:00:00.000Z").toISOString();
    expect(formatRelativeTime(t, now)).toMatch(/Apr 15/);
  });

  it("treats future times as 'just now'", () => {
    const t = new Date(now.getTime() + 60_000).toISOString();
    expect(formatRelativeTime(t, now)).toBe("just now");
  });
});

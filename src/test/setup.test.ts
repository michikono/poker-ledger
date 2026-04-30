import { describe, expect, it } from "vitest";

describe("test infrastructure", () => {
  it("jest-dom matchers work in jsdom environment", () => {
    const el = document.createElement("div");
    el.textContent = "poker";
    document.body.appendChild(el);
    expect(el).toHaveTextContent("poker");
    document.body.removeChild(el);
  });
});

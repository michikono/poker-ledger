import { describe, expect, it } from "vitest";
import { generateSessionName, WORDS } from "./name";

const NAME_RE = /^[a-z]+-[a-z]+-\d{3}$/;

describe("generateSessionName", () => {
  it("matches the food-food-NNN format", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateSessionName()).toMatch(NAME_RE);
    }
  });

  it("draws both words from the WORDS list", () => {
    const wordSet: Set<string> = new Set(WORDS);
    for (let i = 0; i < 200; i++) {
      const [w1, w2] = generateSessionName().split("-");
      expect(wordSet.has(w1 ?? "")).toBe(true);
      expect(wordSet.has(w2 ?? "")).toBe(true);
    }
  });

  it("zero-pads NNN to three digits", () => {
    // Force the rng to produce small index/numbers — pad must still emit 3 digits.
    const rng = () => 0;
    expect(generateSessionName(rng)).toMatch(/-000$/);
  });

  it("draws words with replacement (same word can appear twice)", () => {
    // Force both word-draws to index 1 (e.g., "bacon"); third call picks the number.
    let call = 0;
    const sequence = [0.0001, 0.0001, 0.042];
    const rng = () => sequence[call++ % sequence.length] ?? 0;
    const name = generateSessionName(rng);
    const [w1, w2] = name.split("-");
    expect(w1).toBe(w2);
  });

  it("is deterministic when an explicit rng is injected", () => {
    const seq = [0.1, 0.2, 0.3];
    const make = () => {
      let i = 0;
      return generateSessionName(() => seq[i++ % seq.length] ?? 0);
    };
    expect(make()).toBe(make());
  });

  it("has every WORD in lowercase a–z only (no spaces, no hyphens, no digits)", () => {
    for (const w of WORDS) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });
});

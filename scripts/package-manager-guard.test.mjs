import { describe, expect, it } from "vitest";
import { checkManager, detectManager } from "./package-manager-guard.mjs";

describe("detectManager", () => {
  it("identifies npm/pnpm/yarn from the user-agent head token", () => {
    expect(detectManager("npm/10.9.7 node/v22.22.2 darwin arm64")).toBe("npm");
    expect(detectManager("pnpm/9.12.0 npm/? node/v22.22.2 darwin arm64")).toBe(
      "pnpm",
    );
    expect(detectManager("yarn/1.22.22 npm/? node/v22.22.2 darwin arm64")).toBe(
      "yarn",
    );
  });

  it("returns 'unknown' for absent or unrecognized agents", () => {
    expect(detectManager(undefined)).toBe("unknown");
    expect(detectManager("")).toBe("unknown");
    expect(detectManager("bun/1.1.0 node/v22")).toBe("unknown");
  });
});

describe("checkManager", () => {
  it("blocks pnpm and yarn", () => {
    for (const agent of ["pnpm/9.12.0 node/v22", "yarn/1.22.22 node/v22"]) {
      const result = checkManager(agent);
      expect(result.ok, agent).toBe(false);
      expect(result.message).toMatch(/npm-only/);
    }
  });

  it("allows npm", () => {
    expect(checkManager("npm/10.9.7 node/v22").ok).toBe(true);
  });

  it("fails open on unknown/absent agents", () => {
    expect(checkManager(undefined).ok).toBe(true);
    expect(checkManager("bun/1.1.0 node/v22").ok).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { evaluate } from "./lockfile-guard.mjs";

describe("evaluate", () => {
  it("passes on a clean npm-resolved tree", () => {
    const result = evaluate({
      foreignLockfiles: [],
      expectedBiome: "2.4.14",
      installedBiome: "2.4.14",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a foreign lockfile is present", () => {
    const result = evaluate({
      foreignLockfiles: ["pnpm-lock.yaml"],
      expectedBiome: "2.4.14",
      installedBiome: "2.4.14",
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/pnpm-lock\.yaml/);
    expect(result.errors[0]).toMatch(/npm ci/);
  });

  it("fails on Biome version drift", () => {
    const result = evaluate({
      foreignLockfiles: [],
      expectedBiome: "2.4.14",
      installedBiome: "2.5.0",
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/drift/);
    expect(result.errors[0]).toMatch(/2\.5\.0/);
  });

  it("reports both a foreign lockfile and drift together", () => {
    const result = evaluate({
      foreignLockfiles: ["pnpm-lock.yaml", "pnpm-workspace.yaml"],
      expectedBiome: "2.4.14",
      installedBiome: "2.5.0",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it("skips the drift check when a version is unknown", () => {
    expect(
      evaluate({
        foreignLockfiles: [],
        expectedBiome: null,
        installedBiome: "2.5.0",
      }).ok,
    ).toBe(true);
    expect(
      evaluate({
        foreignLockfiles: [],
        expectedBiome: "2.4.14",
        installedBiome: null,
      }).ok,
    ).toBe(true);
  });
});

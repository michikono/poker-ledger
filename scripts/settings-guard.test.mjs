import { describe, expect, it } from "vitest";
import { checkSettings, isDangerousBashGrant } from "./settings-guard.mjs";

describe("isDangerousBashGrant", () => {
  it("flags bare interpreters and unscoped runners", () => {
    for (const grant of [
      "Bash(node *)",
      "Bash(node)",
      "Bash(npx *)",
      "Bash(sh *)",
      "Bash(bash *)",
      "Bash(python3 *)",
      "Bash(* *)",
      "Bash(*)",
    ]) {
      expect(isDangerousBashGrant(grant), grant).toBe(true);
    }
  });

  it("allows scoped argument-wildcards and concrete commands", () => {
    for (const grant of [
      "Bash(npm test *)",
      "Bash(npx vitest *)",
      "Bash(npx tsc --noEmit *)",
      "Bash(npm run lint)",
      "Bash(./node_modules/.bin/biome lint *)",
    ]) {
      expect(isDangerousBashGrant(grant), grant).toBe(false);
    }
  });

  it("ignores non-Bash grants and non-strings", () => {
    expect(isDangerousBashGrant("WebFetch(domain:firebase.google.com)")).toBe(
      false,
    );
    expect(isDangerousBashGrant(undefined)).toBe(false);
  });
});

describe("checkSettings", () => {
  it("rejects malformed JSON", () => {
    const result = checkSettings("{ not json");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("rejects an arbitrary-execution wildcard in the allowlist", () => {
    const result = checkSettings(
      JSON.stringify({
        permissions: { allow: ["Bash(npm test *)", "Bash(node *)"] },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("passes a clean settings file", () => {
    const result = checkSettings(
      JSON.stringify({
        permissions: { allow: ["Bash(npm test *)", "Bash(npm run lint)"] },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

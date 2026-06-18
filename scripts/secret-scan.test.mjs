import { describe, expect, it } from "vitest";
import { findSecretsInDiff, scanText } from "./secret-scan.mjs";

// Secret-shaped literals for the scanner's own tests. Each keeps its inline
// allowlist marker on the same (short) line so this file never trips the
// scanner it tests; elsewhere these consts are referenced, never re-inlined.
const AWS = "AKIAIOSFODNN7EXAMPLE"; // pragma: allowlist secret
const SLACK = "xoxb-1234567890-abcdefABCDEF"; // pragma: allowlist secret
const PK = "-----BEGIN RSA PRIVATE KEY-----"; // pragma: allowlist secret

describe("scanText", () => {
  it("flags high-signal secret patterns", () => {
    expect(scanText(AWS)[0].pattern).toBe("aws-access-key-id");
    expect(scanText(`AIza${"B".repeat(35)}`)[0].pattern).toBe("google-api-key");
    expect(scanText(`x ghp_${"a".repeat(36)}`)[0].pattern).toBe("github-token");
    expect(scanText(`x sk_live_${"a".repeat(24)}`)[0].pattern).toBe(
      "stripe-live-key",
    );
    expect(scanText(SLACK)[0].pattern).toBe("slack-token");
    expect(scanText(PK)[0].pattern).toBe("private-key-block");
  });

  it("does not flag benign placeholders or lookalikes", () => {
    expect(scanText('apiKey: "demo-api-key"')).toHaveLength(0);
    expect(scanText("const tokenize = () => {}")).toHaveLength(0);
    expect(scanText("NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key")).toHaveLength(
      0,
    );
  });
});

describe("findSecretsInDiff", () => {
  it("only scans added lines and tracks the file", () => {
    const diff = [
      "diff --git a/config.ts b/config.ts",
      "--- a/config.ts",
      "+++ b/config.ts",
      `+const token = "ghp_${"a".repeat(36)}";`,
      `-const removed = "${AWS}";`,
      ` context ${AWS} stays untouched`,
    ].join("\n");
    const findings = findSecretsInDiff(diff);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "config.ts",
      pattern: "github-token",
    });
  });

  it("returns nothing for a clean diff", () => {
    const diff = ["+++ b/readme.md", "+Just some documentation text."].join(
      "\n",
    );
    expect(findSecretsInDiff(diff)).toHaveLength(0);
  });

  it("skips added lines carrying the allowlist marker", () => {
    const diff = [
      "+++ b/fixtures.ts",
      `+const k = "${AWS}"; // pragma: allowlist secret`,
    ].join("\n");
    expect(findSecretsInDiff(diff)).toHaveLength(0);
  });
});

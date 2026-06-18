import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A staged line carrying this marker is skipped — for legitimate fixtures (e.g.
// this scanner's own tests) that must contain secret-shaped literals.
export const ALLOWLIST_MARKER = "pragma: allowlist secret";

export const SECRET_PATTERNS = [
  { name: "private-key-block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "aws-access-key-id", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "stripe-live-key", regex: /\bsk_live_[0-9A-Za-z]{16,}\b/ },
  { name: "github-token", regex: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { name: "slack-token", regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
];

export function scanText(text) {
  const findings = [];
  text.split("\n").forEach((line, i) => {
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        findings.push({
          pattern: name,
          lineNumber: i + 1,
          snippet: line.trim().slice(0, 80),
        });
      }
    }
  });
  return findings;
}

// Scan only the added lines of a staged unified diff, tracking the current file.
export function findSecretsInDiff(diffText) {
  const findings = [];
  let currentFile = "(unknown)";
  for (const raw of diffText.split("\n")) {
    if (raw.startsWith("+++ ")) {
      const path = raw.slice(4).replace(/^b\//, "");
      currentFile = path === "/dev/null" ? "(unknown)" : path;
      continue;
    }
    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
    const added = raw.slice(1);
    if (added.includes(ALLOWLIST_MARKER)) continue;
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(added)) {
        findings.push({
          file: currentFile,
          pattern: name,
          snippet: added.trim().slice(0, 80),
        });
      }
    }
  }
  return findings;
}

function main() {
  let diff = "";
  try {
    diff = execFileSync(
      "git",
      ["diff", "--cached", "--no-color", "--unified=0"],
      { encoding: "utf8" },
    );
  } catch {
    process.exit(0);
  }
  const findings = findSecretsInDiff(diff);
  if (findings.length === 0) process.exit(0);
  process.stderr.write("\n✖ Potential secret(s) in staged changes:\n");
  for (const f of findings) {
    process.stderr.write(`  ${f.file}: ${f.pattern} — ${f.snippet}\n`);
  }
  process.stderr.write(
    "\nRemove the secret, or if it is a confirmed false positive bypass with: git commit --no-verify\n\n",
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

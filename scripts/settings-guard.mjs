import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DANGEROUS_RUNNERS = new Set([
  "node",
  "deno",
  "bun",
  "sh",
  "bash",
  "zsh",
  "fish",
  "python",
  "python3",
  "ruby",
  "perl",
  "eval",
  "exec",
  "env",
  "sudo",
  "npx",
  "pnpx",
  "ts-node",
  "tsx",
]);

// A Bash(...) grant permits arbitrary execution when it is a bare interpreter/runner
// with only a wildcard for arguments (e.g. "node *", "npx *", "sh"), or it begins with
// a wildcard ("*", "* *"). A runner scoped to a concrete subcommand ("npx vitest *",
// "npm test *") is fine.
export function isDangerousBashGrant(grant) {
  if (typeof grant !== "string") return false;
  const match = /^Bash\((.*)\)$/.exec(grant.trim());
  if (!match) return false;
  const cmd = match[1].trim();
  if (cmd === "") return false;
  if (cmd.startsWith("*")) return true;
  const tokens = cmd.split(/\s+/);
  if (!DANGEROUS_RUNNERS.has(tokens[0])) return false;
  const second = tokens[1];
  return second === undefined || second === "*";
}

export function checkSettings(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return {
      ok: false,
      errors: [`.claude/settings.json is not valid JSON: ${err.message}`],
    };
  }
  const errors = [];
  const allow = parsed?.permissions?.allow;
  if (Array.isArray(allow)) {
    for (const grant of allow) {
      if (isDangerousBashGrant(grant)) {
        errors.push(`arbitrary-execution wildcard grant not allowed: ${grant}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  let staged = "";
  try {
    const names = execFileSync("git", ["diff", "--cached", "--name-only"], {
      encoding: "utf8",
    });
    if (!names.split("\n").includes(".claude/settings.json")) process.exit(0);
    staged = execFileSync("git", ["show", ":.claude/settings.json"], {
      encoding: "utf8",
    });
  } catch {
    process.exit(0);
  }
  const { ok, errors } = checkSettings(staged);
  if (ok) process.exit(0);
  process.stderr.write(
    "\n✖ .claude/settings.json failed the settings guard:\n",
  );
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.stderr.write(
    "\nScope every Bash grant to a specific subcommand (e.g. Bash(npm test *)). See ADR 0007 / CLAUDE.md.\nBypass (not recommended): git commit --no-verify\n\n",
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

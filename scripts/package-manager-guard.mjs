import { fileURLToPath } from "node:url";

// This repo standardizes on npm (a single committed package-lock.json). pnpm
// and yarn ignore that lockfile and re-resolve caret ranges against the
// registry, silently drifting node_modules (e.g. @biomejs/biome 2.4.14 -> 2.5.0,
// which breaks lint/format). This runs as the npm `preinstall` script: npm
// reports its identity in npm_config_user_agent, so a pnpm/yarn invocation is
// caught and aborted before any lockfile or node_modules is written. We
// fail-open on an unknown/absent agent so unusual-but-valid environments (some
// CI runners, direct tooling) are never bricked. See spec 0029.

export function detectManager(userAgent) {
  if (typeof userAgent !== "string" || userAgent.trim() === "")
    return "unknown";
  const head = userAgent.trim().split(/\s+/)[0] ?? "";
  const name = head.split("/")[0]?.toLowerCase() ?? "";
  if (name === "npm") return "npm";
  if (name === "pnpm") return "pnpm";
  if (name === "yarn") return "yarn";
  return "unknown";
}

export function checkManager(userAgent) {
  const manager = detectManager(userAgent);
  if (manager === "pnpm" || manager === "yarn") {
    return {
      ok: false,
      manager,
      message:
        `This repo is npm-only — detected "${manager}". ${manager} ignores ` +
        "package-lock.json and drifts node_modules off the pinned toolchain.\n" +
        "Use npm instead:\n  npm install        # or: npm ci\n" +
        `If ${manager} created lockfiles, remove them: rm -f pnpm-lock.yaml pnpm-workspace.yaml yarn.lock`,
    };
  }
  return { ok: true, manager };
}

function main() {
  const { ok, message } = checkManager(process.env.npm_config_user_agent);
  if (ok) process.exit(0);
  process.stderr.write(`\n✖ package-manager guard:\n${message}\n\n`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

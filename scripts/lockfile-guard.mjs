import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Deterministic detection of npm-only violations that the preinstall guard
// can't catch after the fact: a foreign lockfile committed/left in the tree, or
// a node_modules whose @biomejs/biome drifted off the package-lock.json pin
// (the exact failure that broke lint during specs 0026-0028). Pure node, no
// dependency; wired into `npm run check` and the lefthook pre-commit. See 0029.

const FOREIGN_LOCKFILES = [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
];

// Pure core: given the observed state, produce ok + remediable errors.
export function evaluate({ foreignLockfiles, expectedBiome, installedBiome }) {
  const errors = [];
  for (const name of foreignLockfiles ?? []) {
    errors.push(
      `foreign lockfile present: ${name} — this repo is npm-only. Remove it and reinstall: rm -f ${name} && npm ci`,
    );
  }
  if (expectedBiome && installedBiome && expectedBiome !== installedBiome) {
    errors.push(
      `@biomejs/biome drift: installed ${installedBiome}, package-lock.json pins ${expectedBiome}. Restore with: npm ci`,
    );
  }
  return { ok: errors.length === 0, errors };
}

function detectForeignLockfiles(root, existsFn = existsSync) {
  return FOREIGN_LOCKFILES.filter((name) => existsFn(join(root, name)));
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function expectedBiomeFromLock(root) {
  const lock = readJson(join(root, "package-lock.json"));
  return lock?.packages?.["node_modules/@biomejs/biome"]?.version ?? null;
}

function installedBiome(root) {
  const pkg = readJson(join(root, "node_modules/@biomejs/biome/package.json"));
  return pkg?.version ?? null;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { ok, errors } = evaluate({
    foreignLockfiles: detectForeignLockfiles(root),
    expectedBiome: expectedBiomeFromLock(root),
    installedBiome: installedBiome(root),
  });
  if (ok) process.exit(0);
  process.stderr.write("\n✖ lockfile guard (npm-only):\n");
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.stderr.write("\n");
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

#!/usr/bin/env node
import { existsSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import concurrently from "concurrently";
import {
  bannerString,
  DEVPORTS_FILE,
  generateRuntimeFirebaseJson,
  loadOrPickOffset,
  persistOffset,
  portsForOffset,
  RUNTIME_FIREBASE_FILE,
} from "./dev-ports.mjs";

const MAX_ATTEMPTS = 4;
const cwd = process.cwd();

function probePortOnHost(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function probePort(port) {
  // Services bind on different stacks (Next.js → IPv6 dual-stack `::`, firebase
  // emulator → IPv4 `0.0.0.0`). A port that is free on one stack but held on the
  // other will still collide at start-up, so probe both and require both free.
  const [v4, v6] = await Promise.all([
    probePortOnHost(port, "0.0.0.0"),
    probePortOnHost(port, "::"),
  ]);
  return v4 && v6;
}

async function probeAll(ports) {
  const entries = Object.entries(ports);
  const results = await Promise.all(
    entries.map(async ([name, port]) => [name, port, await probePort(port)]),
  );
  const taken = results.filter(([, , free]) => !free);
  return { ok: taken.length === 0, taken };
}

async function chooseOffset() {
  let lastFailure = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { offset, source } = loadOrPickOffset(cwd);
    const ports = portsForOffset(offset);
    const probe = await probeAll(ports);
    if (probe.ok) {
      if (source === "picked" || attempt > 1) persistOffset(cwd, offset);
      return { offset, ports, attempt };
    }
    lastFailure = { offset, taken: probe.taken };
    const takenStr = probe.taken
      .map(([name, port]) => `${name}:${port}`)
      .join(", ");
    process.stderr.write(
      `[dev] Offset +${offset} unavailable (in use: ${takenStr}). ` +
        `Picking a new offset (attempt ${attempt}/${MAX_ATTEMPTS}).\n`,
    );
    const devportsPath = join(cwd, DEVPORTS_FILE);
    if (existsSync(devportsPath)) unlinkSync(devportsPath);
  }
  const taken = lastFailure?.taken
    .map(([name, port]) => `${name}:${port}`)
    .join(", ");
  process.stderr.write(
    `[dev] Could not find a free dev-port offset after ${MAX_ATTEMPTS} attempts. ` +
      `Last collision was at offset +${lastFailure?.offset} (${taken}). ` +
      `Inspect ${DEVPORTS_FILE}, stop another worktree's \`npm run dev\`, or edit ${DEVPORTS_FILE} by hand.\n`,
  );
  process.exit(1);
}

const { offset, ports } = await chooseOffset();
generateRuntimeFirebaseJson(cwd, offset);

process.stdout.write(`${bannerString(offset, ports)}\n`);

const childEnv = {
  ...process.env,
  PORT: String(ports.next),
  FIRESTORE_EMULATOR_HOST: `localhost:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `localhost:${ports.auth}`,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: `http://localhost:${ports.auth}`,
};

const { result } = concurrently(
  [
    {
      name: "emulator",
      command: `firebase --config ${RUNTIME_FIREBASE_FILE} emulators:start --project demo-poker-ledger --import .emulator-data --export-on-exit .emulator-data`,
      env: childEnv,
      prefixColor: "yellow",
    },
    {
      name: "next",
      command: "next dev",
      env: childEnv,
      prefixColor: "cyan",
    },
  ],
  {
    killOthers: ["failure", "success"],
    prefix: "name",
  },
);

result.then(
  () => process.exit(0),
  () => process.exit(1),
);

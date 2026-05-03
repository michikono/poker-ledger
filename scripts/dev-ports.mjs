import { randomInt } from "node:crypto";
import * as nodeFs from "node:fs";
import { join } from "node:path";

export const MIN_OFFSET = 100;
export const MAX_OFFSET = 5000;
export const STEP = 100;
export const BUCKETS = (MAX_OFFSET - MIN_OFFSET) / STEP + 1;

export const DEFAULT_PORTS = Object.freeze({
  next: 3000,
  ui: 4000,
  firestore: 8080,
  auth: 9099,
});

export const DEVPORTS_FILE = ".devports";
export const RUNTIME_FIREBASE_FILE = "firebase.runtime.json";
export const SOURCE_FIREBASE_FILE = "firebase.json";

function isValidOffset(offset) {
  return (
    Number.isInteger(offset) &&
    offset >= MIN_OFFSET &&
    offset <= MAX_OFFSET &&
    offset % STEP === 0
  );
}

export function portsForOffset(offset) {
  if (!isValidOffset(offset)) {
    throw new RangeError(
      `Offset must be an integer multiple of ${STEP} in [${MIN_OFFSET}, ${MAX_OFFSET}], got ${offset}`,
    );
  }
  return {
    next: DEFAULT_PORTS.next + offset,
    ui: DEFAULT_PORTS.ui + offset,
    firestore: DEFAULT_PORTS.firestore + offset,
    auth: DEFAULT_PORTS.auth + offset,
  };
}

export function pickRandomOffset(rng = randomInt) {
  const bucket = rng(0, BUCKETS);
  return MIN_OFFSET + bucket * STEP;
}

export function bannerString(offset, ports) {
  return `Worktree dev ports — offset +${offset} — Next ${ports.next}, UI ${ports.ui}, Firestore ${ports.firestore}, Auth ${ports.auth}`;
}

export function writeRuntimeFirebaseJson(srcConfig, offset) {
  const ports = portsForOffset(offset);
  const out = JSON.parse(JSON.stringify(srcConfig));
  out.emulators ??= {};
  if (out.emulators.auth) out.emulators.auth.port = ports.auth;
  if (out.emulators.firestore) out.emulators.firestore.port = ports.firestore;
  if (out.emulators.ui) out.emulators.ui.port = ports.ui;
  return out;
}

function parseOffsetFile(contents) {
  const match = /^\s*OFFSET\s*=\s*(\d+)\s*$/m.exec(contents);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return isValidOffset(parsed) ? parsed : null;
}

export function loadOrPickOffset(cwd, fs = nodeFs, rng = randomInt) {
  const path = join(cwd, DEVPORTS_FILE);
  if (fs.existsSync(path)) {
    const contents = fs.readFileSync(path, "utf8");
    const parsed = parseOffsetFile(contents);
    if (parsed !== null) return { offset: parsed, source: "loaded" };
  }
  return { offset: pickRandomOffset(rng), source: "picked" };
}

export function persistOffset(cwd, offset, fs = nodeFs) {
  if (!isValidOffset(offset)) {
    throw new RangeError(`Refusing to persist invalid offset ${offset}`);
  }
  fs.writeFileSync(join(cwd, DEVPORTS_FILE), `OFFSET=${offset}\n`);
}

export function generateRuntimeFirebaseJson(cwd, offset, fs = nodeFs) {
  const src = JSON.parse(
    fs.readFileSync(join(cwd, SOURCE_FIREBASE_FILE), "utf8"),
  );
  const shifted = writeRuntimeFirebaseJson(src, offset);
  fs.writeFileSync(
    join(cwd, RUNTIME_FIREBASE_FILE),
    `${JSON.stringify(shifted, null, 2)}\n`,
  );
  return shifted;
}

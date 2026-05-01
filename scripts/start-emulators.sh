#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=".emulator-data"
FIREBASE="./node_modules/.bin/firebase"

# Seed if:
#   - postinstall left a .needs-seed marker (new worktree / empty data), OR
#   - data dir is missing or empty (fallback for any edge case)
needs_seed() {
  [ -f ".needs-seed" ] && return 0
  [ ! -d "$DATA_DIR" ] && return 0
  [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ] && return 0
  return 1
}

if ! needs_seed; then
  # Existing worktree with real data — restore last session state
  exec "$FIREBASE" emulators:start \
    --import="$DATA_DIR" \
    --export-on-exit="$DATA_DIR"
fi

# Seed path: remove marker, start emulator, wait, seed, then hand off
rm -f ".needs-seed"

"$FIREBASE" emulators:start --export-on-exit="$DATA_DIR" &
EMULATOR_PID=$!

cleanup() {
  kill "$EMULATOR_PID" 2>/dev/null || true
  wait "$EMULATOR_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[emulator] Waiting for emulators to be ready..."
until curl -sf "http://localhost:4000" > /dev/null 2>&1; do sleep 1; done

echo "[emulator] Seeding initial data..."
npm run seed

echo "[emulator] Ready → http://localhost:4000"
wait "$EMULATOR_PID"

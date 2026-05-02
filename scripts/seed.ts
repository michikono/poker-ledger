/**
 * Clears the local Firebase emulator and seeds initial data.
 * Add seed data here as collections are implemented.
 *
 * Usage:
 *   npm run seed          (emulator must be running)
 *   npm run dev           (auto-runs on first start in a new worktree)
 */
import { initializeApp } from "firebase-admin/app";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const PROJECT_ID = "demo-poker-ledger";
initializeApp({ projectId: PROJECT_ID });

async function clearAll() {
  await fetch(
    `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await fetch(
    `http://localhost:9099/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: "DELETE" },
  );
}

async function seed() {
  console.log("  clearing emulator data...");
  await clearAll();
  console.log("✓ Emulator ready (no seed data defined yet)");
}

seed()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

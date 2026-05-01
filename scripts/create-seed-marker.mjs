import { existsSync, readdirSync, writeFileSync } from "node:fs";

// Runs on every `npm install` (postinstall).
// Creates .needs-seed if the emulator data dir is missing or empty,
// so start-emulators.sh knows to seed on next `npm run dev`.
const hasData =
  existsSync(".emulator-data") && readdirSync(".emulator-data").length > 0;

if (!hasData) {
  writeFileSync(".needs-seed", "");
}

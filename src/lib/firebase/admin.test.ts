// @vitest-environment node
import { getApps } from "firebase-admin/app";
import { describe, expect, test } from "vitest";

import { adminAuth, adminDb } from "./admin";

describe("Firebase Admin init", () => {
  test("initializes exactly one app on import", () => {
    expect(getApps().length).toBe(1);
  });

  test("adminDb is invocable without throwing", () => {
    expect(() => adminDb.collection("__regression__")).not.toThrow();
  });

  test("adminAuth is wired to the initialized Firebase app", () => {
    expect(adminAuth.app).toBe(getApps()[0]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectAuthEmulator = vi.fn<(...args: unknown[]) => void>();
const getAuth = vi.fn<(...args: unknown[]) => object>(() => ({}));
const initializeApp = vi.fn<(...args: unknown[]) => object>(() => ({}));
const getApps = vi.fn<() => unknown[]>(() => []);
const getApp = vi.fn<() => object>(() => ({}));

vi.mock("firebase/auth", () => ({
  connectAuthEmulator: (auth: unknown, url: unknown, options?: unknown) =>
    connectAuthEmulator(auth, url, options),
  getAuth: (app: unknown) => getAuth(app),
}));

vi.mock("firebase/app", () => ({
  initializeApp: (config: unknown) => initializeApp(config),
  getApps: () => getApps(),
  getApp: () => getApp(),
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL",
] as const;

describe("createClientAuth — auth emulator URL", () => {
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    connectAuthEmulator.mockClear();
    getAuth.mockClear();
    initializeApp.mockClear();
    getApps.mockReturnValue([]);
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  });

  it("uses NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL when set on a demo project", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-poker-ledger";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL =
      "http://localhost:9599";

    const { getClientAuth } = await import("./client");
    getClientAuth();

    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator.mock.calls[0]?.[1]).toBe(
      "http://localhost:9599",
    );
  });

  it("falls back to http://localhost:9099 when the env var is absent on a demo project", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-poker-ledger";
    Reflect.deleteProperty(
      process.env,
      "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL",
    );

    const { getClientAuth } = await import("./client");
    getClientAuth();

    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator.mock.calls[0]?.[1]).toBe(
      "http://localhost:9099",
    );
  });

  it("does not connect to the emulator on a non-demo project", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "real-project-id";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL =
      "http://localhost:9599";

    const { getClientAuth } = await import("./client");
    getClientAuth();

    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });
});

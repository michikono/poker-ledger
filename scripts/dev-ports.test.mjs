import { describe, expect, it } from "vitest";
import {
  bannerString,
  BUCKETS,
  DEVPORTS_FILE,
  loadOrPickOffset,
  MAX_OFFSET,
  MIN_OFFSET,
  persistOffset,
  pickRandomOffset,
  portsForOffset,
  STEP,
  writeRuntimeFirebaseJson,
} from "./dev-ports.mjs";

const CANONICAL_FIREBASE_JSON = {
  emulators: {
    auth: { port: 9099 },
    firestore: { port: 8080 },
    ui: { enabled: true, port: 4000 },
    singleProjectMode: true,
  },
};

describe("portsForOffset", () => {
  it("shifts the four default ports by the offset", () => {
    expect(portsForOffset(100)).toEqual({
      next: 3100,
      ui: 4100,
      firestore: 8180,
      auth: 9199,
    });
    expect(portsForOffset(2500)).toEqual({
      next: 5500,
      ui: 6500,
      firestore: 10580,
      auth: 11599,
    });
    expect(portsForOffset(5000)).toEqual({
      next: 8000,
      ui: 9000,
      firestore: 13080,
      auth: 14099,
    });
  });

  it("throws on offset below the minimum", () => {
    expect(() => portsForOffset(0)).toThrow(RangeError);
    expect(() => portsForOffset(50)).toThrow(RangeError);
  });

  it("throws on offset above the maximum", () => {
    expect(() => portsForOffset(5100)).toThrow(RangeError);
  });

  it("throws on offset that is not a multiple of the step", () => {
    expect(() => portsForOffset(150)).toThrow(RangeError);
  });

  it("throws on non-integer offsets", () => {
    expect(() => portsForOffset(100.5)).toThrow(RangeError);
    expect(() => portsForOffset(Number.NaN)).toThrow(RangeError);
    expect(() => portsForOffset("100")).toThrow(RangeError);
  });
});

describe("pickRandomOffset", () => {
  it("returns the lowest bucket when rng yields 0", () => {
    expect(pickRandomOffset(() => 0)).toBe(MIN_OFFSET);
  });

  it("returns the highest bucket when rng yields BUCKETS - 1", () => {
    expect(pickRandomOffset(() => BUCKETS - 1)).toBe(MAX_OFFSET);
  });

  it("returns a value that is always a multiple of the step within range", () => {
    const seen = new Set();
    for (let i = 0; i < BUCKETS; i++) {
      const offset = pickRandomOffset(() => i);
      expect(offset % STEP).toBe(0);
      expect(offset).toBeGreaterThanOrEqual(MIN_OFFSET);
      expect(offset).toBeLessThanOrEqual(MAX_OFFSET);
      seen.add(offset);
    }
    expect(seen.size).toBe(BUCKETS);
  });

  it("calls rng with [0, BUCKETS) so the distribution is uniform across buckets", () => {
    const calls = [];
    pickRandomOffset((min, max) => {
      calls.push([min, max]);
      return 0;
    });
    expect(calls).toEqual([[0, BUCKETS]]);
  });
});

describe("writeRuntimeFirebaseJson", () => {
  it("shifts the auth, firestore, and ui ports by the offset", () => {
    const out = writeRuntimeFirebaseJson(CANONICAL_FIREBASE_JSON, 500);
    expect(out.emulators.auth.port).toBe(9599);
    expect(out.emulators.firestore.port).toBe(8580);
    expect(out.emulators.ui.port).toBe(4500);
  });

  it("leaves unrelated emulator config untouched", () => {
    const out = writeRuntimeFirebaseJson(CANONICAL_FIREBASE_JSON, 100);
    expect(out.emulators.ui.enabled).toBe(true);
    expect(out.emulators.singleProjectMode).toBe(true);
  });

  it("does not mutate the input config", () => {
    const input = JSON.parse(JSON.stringify(CANONICAL_FIREBASE_JSON));
    writeRuntimeFirebaseJson(input, 300);
    expect(input).toEqual(CANONICAL_FIREBASE_JSON);
  });

  it("throws on invalid offsets", () => {
    expect(() => writeRuntimeFirebaseJson(CANONICAL_FIREBASE_JSON, 0)).toThrow(
      RangeError,
    );
  });
});

describe("bannerString", () => {
  it("produces a stable, grep-able banner with offset and four ports", () => {
    const ports = portsForOffset(500);
    expect(bannerString(500, ports)).toBe(
      "Worktree dev ports — offset +500 — Next 3500, UI 4500, Firestore 8580, Auth 9599",
    );
  });
});

function makeMemFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    existsSync: (p) => files.has(p),
    readFileSync: (p) => {
      if (!files.has(p)) throw new Error(`ENOENT: ${p}`);
      return files.get(p);
    },
    writeFileSync: (p, contents) => {
      files.set(p, contents);
    },
  };
}

describe("loadOrPickOffset", () => {
  it("returns the parsed offset from an existing .devports file", () => {
    const fs = makeMemFs({ [`/work/${DEVPORTS_FILE}`]: "OFFSET=500\n" });
    const result = loadOrPickOffset("/work", fs, () => {
      throw new Error("rng should not be called");
    });
    expect(result).toEqual({ offset: 500, source: "loaded" });
  });

  it("picks a fresh offset via rng when .devports is missing", () => {
    const fs = makeMemFs();
    const result = loadOrPickOffset("/work", fs, () => 0);
    expect(result).toEqual({ offset: MIN_OFFSET, source: "picked" });
  });

  it("re-picks via rng when .devports is garbage", () => {
    const fs = makeMemFs({ [`/work/${DEVPORTS_FILE}`]: "not a valid file" });
    const result = loadOrPickOffset("/work", fs, () => 1);
    expect(result).toEqual({ offset: MIN_OFFSET + STEP, source: "picked" });
  });

  it("re-picks when .devports has an out-of-range offset", () => {
    const fs = makeMemFs({ [`/work/${DEVPORTS_FILE}`]: "OFFSET=99\n" });
    const result = loadOrPickOffset("/work", fs, () => 0);
    expect(result.source).toBe("picked");
  });

  it("re-picks when .devports has an offset that is not a multiple of the step", () => {
    const fs = makeMemFs({ [`/work/${DEVPORTS_FILE}`]: "OFFSET=150\n" });
    const result = loadOrPickOffset("/work", fs, () => 0);
    expect(result.source).toBe("picked");
  });
});

describe("persistOffset", () => {
  it("writes OFFSET=<n> to .devports inside cwd", () => {
    const fs = makeMemFs();
    persistOffset("/work", 500, fs);
    expect(fs.files.get(`/work/${DEVPORTS_FILE}`)).toBe("OFFSET=500\n");
  });

  it("refuses to persist an invalid offset", () => {
    const fs = makeMemFs();
    expect(() => persistOffset("/work", 0, fs)).toThrow(RangeError);
  });
});

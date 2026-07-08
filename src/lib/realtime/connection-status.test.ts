import { describe, expect, it } from "vitest";
import {
  CONNECTION_COPY,
  type ConnectionStatus,
  deriveConnectionStatus,
  isLive,
} from "./connection-status";

describe("deriveConnectionStatus", () => {
  it("is live when active, online, and not errored", () => {
    expect(
      deriveConnectionStatus({ active: true, online: true, errored: false }),
    ).toBe("live");
  });

  it("is paused-idle when inactive, regardless of network", () => {
    expect(
      deriveConnectionStatus({ active: false, online: true, errored: false }),
    ).toBe("paused-idle");
    expect(
      deriveConnectionStatus({ active: false, online: false, errored: true }),
    ).toBe("paused-idle");
  });

  it("is offline when active but the network is down", () => {
    expect(
      deriveConnectionStatus({ active: true, online: false, errored: false }),
    ).toBe("offline");
  });

  it("is offline when active but the listener errored", () => {
    expect(
      deriveConnectionStatus({ active: true, online: true, errored: true }),
    ).toBe("offline");
  });
});

describe("isLive", () => {
  it("is true only for live", () => {
    expect(isLive("live")).toBe(true);
    expect(isLive("paused-idle")).toBe(false);
    expect(isLive("offline")).toBe(false);
  });
});

describe("CONNECTION_COPY", () => {
  it("has a banner for every non-live status and none for live", () => {
    expect(CONNECTION_COPY.live.banner).toBeUndefined();
    expect(CONNECTION_COPY["paused-idle"].banner).toBeTruthy();
    expect(CONNECTION_COPY.offline.banner).toBeTruthy();
  });

  it("has a label and detail for every status", () => {
    for (const status of [
      "live",
      "paused-idle",
      "offline",
    ] satisfies ConnectionStatus[]) {
      expect(CONNECTION_COPY[status].label).toBeTruthy();
      expect(CONNECTION_COPY[status].detail).toBeTruthy();
    }
  });
});

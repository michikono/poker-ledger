import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

type Snap = {
  exists: boolean;
  data?: () => Record<string, unknown> | undefined;
  id?: string;
  ref?: unknown;
  empty?: boolean;
  docs?: Array<Snap & { ref: unknown; data: () => Record<string, unknown> }>;
};

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const computeSettlement = vi.fn();

  let nextDocId = 1;
  const makeId = (prefix = "id") => `${prefix}-${nextDocId++}`;

  const getQueue: Array<unknown> = [];

  const txSet = vi.fn();
  const txUpdate = vi.fn();
  const txDelete = vi.fn();

  const txGet = vi.fn(async () => {
    const snap = getQueue.shift();
    if (!snap) {
      throw new Error("tx.get called more times than configured");
    }
    return snap;
  });

  const tx = {
    get: txGet,
    set: txSet,
    update: txUpdate,
    delete: txDelete,
  };

  const runTransaction = vi.fn(
    async (fn: (t: typeof tx) => unknown) => await fn(tx),
  );

  function makeRef(label = "ref"): Record<string, unknown> {
    const ref: Record<string, unknown> = {
      __label: label,
      id: makeId(label),
    };
    const self = ref;
    ref.collection = vi.fn((name: string) => makeRef(`${label}/${name}`));
    ref.doc = vi.fn((id?: string) => {
      const child = makeRef(`${label}/doc`);
      if (id) child.id = id;
      return child;
    });
    ref.where = vi.fn(() => self);
    ref.limit = vi.fn(() => self);
    ref.orderBy = vi.fn(() => self);
    return ref;
  }

  const collection = vi.fn((name: string) => makeRef(name));
  const adminDb = {
    collection,
    runTransaction: (...args: unknown[]) =>
      (runTransaction as unknown as (...a: unknown[]) => unknown)(...args),
  };

  return {
    verifyIdToken,
    computeSettlement,
    getQueue,
    txGet,
    txSet,
    txUpdate,
    txDelete,
    runTransaction,
    collection,
    adminDb,
    resetIds: () => {
      nextDocId = 1;
    },
  };
});

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: {
    verifyIdToken: (...args: unknown[]) => mocks.verifyIdToken(...args),
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__TS__",
    increment: (n: number) => ({ __increment: n }),
  },
}));

vi.mock("@/lib/settlement/compute", () => ({
  computeSettlement: (...args: unknown[]) => mocks.computeSettlement(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: mocks.adminDb,
}));

const {
  verifyIdToken,
  computeSettlement,
  getQueue,
  txGet,
  txSet,
  txUpdate,
  txDelete,
  runTransaction,
  collection,
  resetIds,
} = mocks;

// ============ Imports under test ============

import {
  addBuyIn,
  addPlayer,
  archiveSession,
  markPaymentPaid,
  removeBuyIn,
  rollbackSessionStatus,
  setCashOut,
  transitionToSettling,
  unarchiveSession,
  unmarkPaymentPaid,
  updatePlayer,
} from "./actions";

// ============ Helpers ============

function queueGets(...snaps: Snap[]) {
  getQueue.push(...snaps);
}

function snap(data: Record<string, unknown> | null): Snap {
  if (data === null) return { exists: false };
  return { exists: true, data: () => data };
}

function makeChainableRef(id: string): Record<string, unknown> {
  const ref: Record<string, unknown> = { __ref: id, id };
  ref.collection = vi.fn(() => makeChainableRef(`${id}/sub`));
  ref.doc = vi.fn(() => makeChainableRef(`${id}/doc`));
  ref.where = vi.fn(() => ref);
  ref.limit = vi.fn(() => ref);
  ref.orderBy = vi.fn(() => ref);
  return ref;
}

function querySnap(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
): Snap {
  const built = docs.map((d) => ({
    id: d.id,
    exists: true,
    data: () => d.data,
    ref: makeChainableRef(d.id),
  }));
  return {
    exists: true,
    empty: built.length === 0,
    docs: built,
  };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  computeSettlement.mockReset();
  txGet.mockClear();
  txSet.mockClear();
  txUpdate.mockClear();
  txDelete.mockClear();
  runTransaction.mockClear();
  collection.mockClear();
  getQueue.length = 0;
  resetIds();

  // Default: token verifies to a valid user
  verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
});

// ============ addPlayer ============

describe("addPlayer", () => {
  it("returns UNAUTHENTICATED when token is invalid", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await addPlayer(
      { sessionId: "s1", name: "Bob" },
      "bad-token",
    );
    expect(result).toEqual({
      success: false,
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("verifies the ID token with checkRevoked=true", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    await addPlayer({ sessionId: "s1", name: "Bob" }, "tok");
    expect(verifyIdToken).toHaveBeenCalledWith("tok", true);
  });

  it("returns INVALID_PLAYER_NAME for empty name", async () => {
    const result = await addPlayer({ sessionId: "s1", name: "   " }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_PLAYER_NAME");
  });

  it("returns INVALID_PLAYER_NAME for >50 chars", async () => {
    const result = await addPlayer(
      { sessionId: "s1", name: "a".repeat(51) },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_PLAYER_NAME");
  });

  it("returns INVALID_PLAYER_NAME for a punctuation-only name like '.'", async () => {
    const result = await addPlayer({ sessionId: "s1", name: "." }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_PLAYER_NAME");
      expect(result.error.message).toContain("letter or emoji");
    }
  });

  it("accepts an emoji-only player name", async () => {
    queueGets(snap({ status: "in_progress" }), querySnap([]));
    const result = await addPlayer(
      { sessionId: "s1", name: "\u{1F3B2}" },
      "tok",
    );
    expect(result.success).toBe(true);
  });

  it("returns SESSION_NOT_FOUND when session does not exist", async () => {
    queueGets(snap(null));
    const result = await addPlayer({ sessionId: "s1", name: "Bob" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns SESSION_NOT_EDITABLE when session is not in_progress", async () => {
    queueGets(snap({ status: "settling" }));
    const result = await addPlayer({ sessionId: "s1", name: "Bob" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_EDITABLE");
  });

  it("returns DUPLICATE_PLAYER_NAME when name_lower exists", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "px", data: { name: "Bob", name_lower: "bob" } }]),
    );
    const result = await addPlayer({ sessionId: "s1", name: "Bob" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("DUPLICATE_PLAYER_NAME");
  });

  it("succeeds and writes player + changelog + increments player_count", async () => {
    queueGets(
      snap({ status: "in_progress", default_buy_in_cents: 5000 }),
      querySnap([]), // no dupes
    );
    const result = await addPlayer({ sessionId: "s1", name: "  Bob " }, "tok");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.playerId).toBeTruthy();

    // 4 sets: player, player_added changelog, default buy-in, buy_in_added
    // changelog (the starting buy-in is logged for balance lineage).
    expect(txSet).toHaveBeenCalledTimes(4);
    // 1 update on session for player_count + updated_at
    expect(txUpdate).toHaveBeenCalledTimes(1);

    const playerWrite = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(playerWrite).toMatchObject({
      name: "Bob",
      name_lower: "bob",
      cash_out_cents: null,
      created_by_uid: "u1",
    });

    const playerAddedWrite = txSet.mock.calls[1]?.[1] as Record<
      string,
      unknown
    >;
    expect(playerAddedWrite).toMatchObject({
      action_type: "player_added",
      actor_uid: "u1",
      actor_name: "Alice",
      seq: 0,
    });

    const buyInWrite = txSet.mock.calls[2]?.[1] as Record<string, unknown>;
    expect(buyInWrite).toMatchObject({ amount_cents: 5000 });

    // The starting buy-in is logged as a buy_in_added event so it shows in the
    // player's History — same shape as a manual buy-in, ordered after
    // player_added via seq.
    const startingBuyInLog = txSet.mock.calls[3]?.[1] as Record<
      string,
      unknown
    >;
    expect(startingBuyInLog).toMatchObject({
      action_type: "buy_in_added",
      actor_name: "Alice",
      seq: 1,
      metadata: { player_id: expect.any(String), amount_cents: 5000 },
    });
    expect(
      (startingBuyInLog.metadata as Record<string, unknown>).buy_in_id,
    ).toBeTruthy();
  });

  it("does not create a buy-in or buy_in_added event when default is null", async () => {
    queueGets(
      snap({ status: "in_progress", default_buy_in_cents: null }),
      querySnap([]),
    );
    const result = await addPlayer({ sessionId: "s1", name: "Bob" }, "tok");
    expect(result.success).toBe(true);
    // 2 sets: player, player_added changelog (no buy-in, no buy_in_added).
    expect(txSet).toHaveBeenCalledTimes(2);
    const types = txSet.mock.calls.map(
      (c) => (c[1] as Record<string, unknown>).action_type,
    );
    expect(types).not.toContain("buy_in_added");
  });
});

// ============ addBuyIn ============

describe("addBuyIn", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await addBuyIn(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["zero", 0],
    ["negative", -100],
    ["non-integer", 12.5],
    ["above cap", 2_000_001],
  ])("returns INVALID_AMOUNT for %s", async (_label, value) => {
    const result = await addBuyIn(
      { sessionId: "s1", playerId: "p1", amountCents: value as number },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_AMOUNT");
  });

  it("returns SESSION_NOT_EDITABLE when not in_progress", async () => {
    queueGets(snap({ status: "settled" }));
    const result = await addBuyIn(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_EDITABLE");
  });

  it("returns PLAYER_NOT_FOUND when player missing", async () => {
    queueGets(snap({ status: "in_progress" }), snap(null));
    const result = await addBuyIn(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("PLAYER_NOT_FOUND");
  });

  it("succeeds and writes buy-in + changelog + session timestamp", async () => {
    queueGets(snap({ status: "in_progress" }), snap({ name: "Bob" }));
    const result = await addBuyIn(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "tok",
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.buyInId).toBeTruthy();
    expect(txSet).toHaveBeenCalledTimes(2);
    expect(txUpdate).toHaveBeenCalledTimes(1);
  });
});

// ============ removeBuyIn ============

describe("removeBuyIn", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await removeBuyIn(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns SESSION_NOT_EDITABLE when not in_progress", async () => {
    queueGets(snap({ status: "settling" }));
    const result = await removeBuyIn(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_EDITABLE");
  });

  it("returns BUY_IN_NOT_FOUND when buy-in missing", async () => {
    queueGets(snap({ status: "in_progress" }), snap(null));
    const result = await removeBuyIn(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("BUY_IN_NOT_FOUND");
  });

  it("succeeds and deletes buy-in + writes changelog", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ amount_cents: 2500 }),
      snap({ name: "Bob" }),
    );
    const result = await removeBuyIn(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "tok",
    );
    expect(result.success).toBe(true);
    expect(txDelete).toHaveBeenCalledTimes(1);
    expect(txSet).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);

    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      action_type: "buy_in_removed",
      metadata: { amount_cents: 2500, buy_in_id: "b1" },
    });
  });
});

// ============ setCashOut ============

describe("setCashOut", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_AMOUNT for negative", async () => {
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: -1 },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_AMOUNT");
  });

  it("returns INVALID_AMOUNT for above cap", async () => {
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: 2_000_001 },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_AMOUNT");
  });

  it("returns SESSION_NOT_EDITABLE when not in_progress", async () => {
    queueGets(snap({ status: "settling" }));
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: 5000 },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_EDITABLE");
  });

  it("succeeds with a positive amount", async () => {
    queueGets(snap({ status: "in_progress" }), snap({ name: "Bob" }));
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: 7500 },
      "tok",
    );
    expect(result.success).toBe(true);
    expect(txUpdate).toHaveBeenCalledTimes(2); // player + session
    expect(txSet).toHaveBeenCalledTimes(1); // changelog
    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      action_type: "cash_out_set",
      metadata: { amount_cents: 7500, player_id: "p1" },
    });
  });

  it("succeeds when amountCents is null (cleared) and metadata.cleared is true", async () => {
    queueGets(snap({ status: "in_progress" }), snap({ name: "Bob" }));
    const result = await setCashOut(
      { sessionId: "s1", playerId: "p1", amountCents: null },
      "tok",
    );
    expect(result.success).toBe(true);
    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      metadata: { player_id: "p1", amount_cents: null, cleared: true },
    });
  });
});

// ============ updatePlayer ============

describe("updatePlayer", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: null,
      },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_PLAYER_NAME for empty", async () => {
    const result = await updatePlayer(
      { sessionId: "s1", playerId: "p1", name: "  ", venmoUsername: null },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_PLAYER_NAME");
  });

  it("returns INVALID_VENMO_USERNAME for malformed handle", async () => {
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: "no spaces",
      },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_VENMO_USERNAME");
  });

  it("treats empty/whitespace/single-@ handle as null (clearing)", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob", venmo_username: "alice123" }),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Bob",
        venmoUsername: "  ",
      },
      "tok",
    );
    expect(result.success).toBe(true);
    const update = txUpdate.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).venmo_username === null,
    );
    expect(update).toBeDefined();
  });

  it("returns SESSION_NOT_EDITABLE when archived", async () => {
    queueGets(snap({ status: "archived" }));
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: null,
      },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_EDITABLE");
  });

  it("returns PLAYER_NOT_FOUND when missing", async () => {
    queueGets(snap({ status: "in_progress" }), snap(null));
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: null,
      },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("PLAYER_NOT_FOUND");
  });

  it("returns DUPLICATE_PLAYER_NAME on collision with another player", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob" }),
      querySnap([
        { id: "p2", data: { name: "Charlie", name_lower: "charlie" } },
      ]),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: null,
      },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("DUPLICATE_PLAYER_NAME");
  });

  it("succeeds and emits player_renamed when only name changes", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob", venmo_username: null }),
      querySnap([]),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Charlie",
        venmoUsername: null,
      },
      "tok",
    );
    expect(result.success).toBe(true);
    const renameLog = txSet.mock.calls
      .map((c) => c[1] as Record<string, unknown>)
      .find((d) => d.action_type === "player_renamed");
    expect(renameLog).toMatchObject({
      action_type: "player_renamed",
      metadata: { player_id: "p1", from: "Bob", to: "Charlie" },
    });
    const venmoLog = txSet.mock.calls
      .map((c) => c[1] as Record<string, unknown>)
      .find((d) => d.action_type === "player_venmo_updated");
    expect(venmoLog).toBeUndefined();
  });

  it("emits player_venmo_updated with booleans only when handle is added", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob", venmo_username: null }),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Bob",
        venmoUsername: "alice123",
      },
      "tok",
    );
    expect(result.success).toBe(true);
    const venmoLog = txSet.mock.calls
      .map((c) => c[1] as Record<string, unknown>)
      .find((d) => d.action_type === "player_venmo_updated");
    expect(venmoLog).toMatchObject({
      action_type: "player_venmo_updated",
      metadata: { player_id: "p1", had_handle: false, has_handle: true },
    });
    expect(JSON.stringify(venmoLog)).not.toContain("alice123");
  });

  it("emits player_venmo_updated when handle is cleared (had → none)", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({
        name: "Bob",
        name_lower: "bob",
        venmo_username: "alice123",
      }),
    );
    const result = await updatePlayer(
      { sessionId: "s1", playerId: "p1", name: "Bob", venmoUsername: null },
      "tok",
    );
    expect(result.success).toBe(true);
    const venmoLog = txSet.mock.calls
      .map((c) => c[1] as Record<string, unknown>)
      .find((d) => d.action_type === "player_venmo_updated");
    expect(venmoLog).toMatchObject({
      metadata: { had_handle: true, has_handle: false },
    });
  });

  it("strips a leading @ from the handle before persisting", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob", venmo_username: null }),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Bob",
        venmoUsername: "@alice123",
      },
      "tok",
    );
    expect(result.success).toBe(true);
    const update = txUpdate.mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).venmo_username === "alice123",
    );
    expect(update).toBeDefined();
  });

  it("is a no-op when neither name nor handle changed", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      snap({ name: "Bob", name_lower: "bob", venmo_username: "alice123" }),
    );
    const result = await updatePlayer(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "BOB",
        venmoUsername: "@alice123",
      },
      "tok",
    );
    expect(result.success).toBe(true);
    expect(txSet).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });
});

// ============ transitionToSettling ============

describe("transitionToSettling", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await transitionToSettling({ sessionId: "s1" }, "bad");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_STATE_TRANSITION when not in_progress", async () => {
    queueGets(snap({ status: "settling" }));
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns INVALID_INPUT when no players", async () => {
    queueGets(snap({ status: "in_progress" }), querySnap([]));
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns INVALID_INPUT when any player has null cash_out_cents", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "p1", data: { name: "Alice", cash_out_cents: null } }]),
    );
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("returns BALANCE_OUT_OF_RANGE when total buy-in is zero", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "p1", data: { name: "Alice", cash_out_cents: 0 } }]),
      // buy-ins for p1
      querySnap([]),
    );
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("BALANCE_OUT_OF_RANGE");
  });

  it("returns BALANCE_OUT_OF_RANGE when shortfall > 2%", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "p1", data: { name: "Alice", cash_out_cents: 5000 } }]),
      querySnap([{ id: "b1", data: { amount_cents: 10000 } }]),
    );
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("BALANCE_OUT_OF_RANGE");
  });

  it("returns BALANCE_OUT_OF_RANGE when cash-out exceeds buy-in", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "p1", data: { name: "Alice", cash_out_cents: 15000 } }]),
      querySnap([{ id: "b1", data: { amount_cents: 10000 } }]),
    );
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("BALANCE_OUT_OF_RANGE");
  });

  it("succeeds with payments and writes Payment docs", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([
        { id: "p1", data: { name: "Alice", cash_out_cents: 0 } },
        { id: "p2", data: { name: "Bob", cash_out_cents: 20000 } },
      ]),
      querySnap([{ id: "b1", data: { amount_cents: 10000 } }]),
      querySnap([{ id: "b2", data: { amount_cents: 10000 } }]),
    );
    computeSettlement.mockReturnValueOnce([
      { fromPlayerId: "p1", toPlayerId: "p2", amountCents: 10000 },
    ]);
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.finalStatus).toBe("settling");
      expect(result.data.payments).toHaveLength(1);
      expect(result.data.payments[0]).toMatchObject({
        fromPlayerId: "p1",
        toPlayerId: "p2",
        amountCents: 10000,
      });
    }
  });

  it("transitions directly to settled when zero payments are produced", async () => {
    queueGets(
      snap({ status: "in_progress" }),
      querySnap([{ id: "p1", data: { name: "Alice", cash_out_cents: 10000 } }]),
      querySnap([{ id: "b1", data: { amount_cents: 10000 } }]),
    );
    computeSettlement.mockReturnValueOnce([]);
    const result = await transitionToSettling({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.finalStatus).toBe("settled");
      expect(result.data.payments).toEqual([]);
    }
    // Changelog should include reason: "auto_settle_zero_payments"
    const calls = txSet.mock.calls;
    const changelogCall = calls.find((c) => {
      const v = c[1] as Record<string, unknown>;
      return v.action_type === "status_changed";
    });
    expect(changelogCall).toBeDefined();
    const meta = (changelogCall?.[1] as Record<string, unknown>).metadata as
      | Record<string, unknown>
      | undefined;
    expect(meta?.reason).toBe("auto_settle_zero_payments");
    expect(meta?.from).toBe("in_progress");
    expect(meta?.to).toBe("settled");
  });
});

// ============ markPaymentPaid ============

describe("markPaymentPaid", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_STATE_TRANSITION when status is in_progress", async () => {
    queueGets(snap({ status: "in_progress" }));
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns PAYMENT_NOT_FOUND when payment missing", async () => {
    queueGets(snap({ status: "settling" }), snap(null));
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("marks payment paid and stays in settling when other unpaid exist", async () => {
    queueGets(
      snap({ status: "settling" }),
      snap({ paid: false, amount_cents: 1000 }),
      querySnap([
        { id: "pay1", data: { paid: false } },
        { id: "pay2", data: { paid: false } },
      ]),
    );
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(true);
    // payment update + session timestamp; NO status change
    const updateCalls = txUpdate.mock.calls;
    expect(updateCalls.length).toBe(2);
    // Single set: payment_marked_paid changelog (no status_changed)
    expect(txSet).toHaveBeenCalledTimes(1);
  });

  it("auto-transitions to settled when this is the last unpaid payment", async () => {
    queueGets(
      snap({ status: "settling" }),
      snap({ paid: false, amount_cents: 1000 }),
      querySnap([{ id: "pay1", data: { paid: false } }]),
    );
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(true);
    // 2 sets: payment_marked_paid + status_changed
    expect(txSet).toHaveBeenCalledTimes(2);
    const lastChangelog = txSet.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(lastChangelog).toMatchObject({
      action_type: "status_changed",
      metadata: { from: "settling", to: "settled", reason: "payment_marked" },
    });
  });

  it("is idempotent when payment already paid (no writes for the payment)", async () => {
    queueGets(
      snap({ status: "settled" }),
      snap({ paid: true, amount_cents: 1000 }),
    );
    const result = await markPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(true);
    // No payment update, no payment_marked_paid changelog. Just session timestamp.
    expect(txSet).toHaveBeenCalledTimes(0);
    expect(txUpdate).toHaveBeenCalledTimes(1);
  });
});

// ============ unmarkPaymentPaid ============

describe("unmarkPaymentPaid", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await unmarkPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_STATE_TRANSITION when in_progress", async () => {
    queueGets(snap({ status: "in_progress" }));
    const result = await unmarkPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns PAYMENT_NOT_FOUND when missing", async () => {
    queueGets(snap({ status: "settling" }), snap(null));
    const result = await unmarkPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("unmarks payment and stays in settling when status is settling", async () => {
    queueGets(
      snap({ status: "settling" }),
      snap({ paid: true, amount_cents: 1000 }),
    );
    const result = await unmarkPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(true);
    // 1 set: payment_unmarked_paid changelog
    expect(txSet).toHaveBeenCalledTimes(1);
  });

  it("unmarks payment and auto-transitions to settling when status was settled", async () => {
    queueGets(
      snap({ status: "settled" }),
      snap({ paid: true, amount_cents: 1000 }),
    );
    const result = await unmarkPaymentPaid(
      { sessionId: "s1", paymentId: "pay1" },
      "tok",
    );
    expect(result.success).toBe(true);
    // 2 sets: payment_unmarked_paid + status_changed
    expect(txSet).toHaveBeenCalledTimes(2);
    const lastChangelog = txSet.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(lastChangelog).toMatchObject({
      action_type: "status_changed",
      metadata: { from: "settled", to: "settling", reason: "payment_unmarked" },
    });
  });
});

// ============ rollbackSessionStatus ============

describe("rollbackSessionStatus", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await rollbackSessionStatus(
      { sessionId: "s1", targetStatus: "in_progress" },
      "bad",
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_STATE_TRANSITION for invalid target", async () => {
    const result = await rollbackSessionStatus(
      {
        sessionId: "s1",
        targetStatus: "settled" as unknown as "settling" | "in_progress",
      },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns INVALID_STATE_TRANSITION when current state is wrong", async () => {
    queueGets(snap({ status: "in_progress" }));
    const result = await rollbackSessionStatus(
      { sessionId: "s1", targetStatus: "in_progress" },
      "tok",
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("rolls back settling → in_progress and deletes payment docs", async () => {
    queueGets(
      snap({ status: "settling" }),
      querySnap([
        { id: "pay1", data: {} },
        { id: "pay2", data: {} },
      ]),
    );
    const result = await rollbackSessionStatus(
      { sessionId: "s1", targetStatus: "in_progress" },
      "tok",
    );
    expect(result.success).toBe(true);
    expect(txDelete).toHaveBeenCalledTimes(2);
    // session update + changelog
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(txSet).toHaveBeenCalledTimes(1);
    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      action_type: "status_changed",
      metadata: {
        from: "settling",
        to: "in_progress",
        reason: "manual_rollback",
      },
    });
  });

  it("rolls back settled → settling and resets paid marks (no individual unmark entries)", async () => {
    queueGets(
      snap({ status: "settled" }),
      querySnap([
        { id: "pay1", data: { paid: true } },
        { id: "pay2", data: { paid: true } },
      ]),
    );
    const result = await rollbackSessionStatus(
      { sessionId: "s1", targetStatus: "settling" },
      "tok",
    );
    expect(result.success).toBe(true);
    // 2 payment updates + session update = 3
    expect(txUpdate).toHaveBeenCalledTimes(3);
    // 1 changelog only
    expect(txSet).toHaveBeenCalledTimes(1);
  });
});

// ============ archiveSession ============

describe("archiveSession", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await archiveSession({ sessionId: "s1" }, "bad");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns SESSION_NOT_FOUND when missing", async () => {
    queueGets(snap(null));
    const result = await archiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns INVALID_STATE_TRANSITION when already archived", async () => {
    queueGets(snap({ status: "archived" }));
    const result = await archiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("archives and stores previous_status", async () => {
    queueGets(snap({ status: "in_progress" }));
    const result = await archiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(true);
    const update = txUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update).toMatchObject({
      status: "archived",
      previous_status: "in_progress",
    });
    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      action_type: "session_archived",
      metadata: { previous_status: "in_progress" },
    });
  });
});

// ============ unarchiveSession ============

describe("unarchiveSession", () => {
  it("returns UNAUTHENTICATED on bad token", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockRejectedValueOnce(new Error("bad"));
    const result = await unarchiveSession({ sessionId: "s1" }, "bad");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns INVALID_STATE_TRANSITION when not archived", async () => {
    queueGets(snap({ status: "in_progress" }));
    const result = await unarchiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns INVALID_STATE_TRANSITION when previous_status missing", async () => {
    queueGets(snap({ status: "archived", previous_status: null }));
    const result = await unarchiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns INVALID_STATE_TRANSITION when previous_status is not recoverable", async () => {
    queueGets(snap({ status: "archived", previous_status: "archived" }));
    const result = await unarchiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("restores to previous_status and clears it", async () => {
    queueGets(snap({ status: "archived", previous_status: "settling" }));
    const result = await unarchiveSession({ sessionId: "s1" }, "tok");
    expect(result.success).toBe(true);
    const update = txUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(update).toMatchObject({ status: "settling", previous_status: null });
    const changelog = txSet.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(changelog).toMatchObject({
      action_type: "session_unarchived",
      metadata: { restored_to: "settling" },
    });
  });
});

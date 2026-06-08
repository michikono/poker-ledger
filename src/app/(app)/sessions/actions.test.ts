import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
const generateSessionName = vi.fn();
const runTransaction = vi.fn();

const sessionDocRef = { __sessionDoc: true };
const changelogDocRef = { __changelogDoc: true };
const changelogCollectionDoc = vi.fn(() => changelogDocRef);
const sessionDocCollection = vi.fn(() => ({ doc: changelogCollectionDoc }));
const sessionDoc = vi.fn(() => ({
  ...sessionDocRef,
  collection: sessionDocCollection,
}));
const sessionsCollection = vi.fn(() => ({ doc: sessionDoc }));

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (name: string) => {
      if (name === "sessions") return sessionsCollection();
      throw new Error(`unexpected collection: ${name}`);
    },
    runTransaction: (...args: unknown[]) => runTransaction(...args),
  },
}));

vi.mock("@/lib/sessions/name", () => ({
  generateSessionName: () => generateSessionName(),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__SERVER_TIMESTAMP__" },
}));

import { createSession } from "./actions";

function makeTx(existsSequence: boolean[]) {
  let i = 0;
  const setMock = vi.fn();
  const getMock = vi.fn(async () => {
    const exists = existsSequence[i++] ?? false;
    return { exists };
  });
  return { tx: { get: getMock, set: setMock }, getMock, setMock };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  generateSessionName.mockReset();
  runTransaction.mockReset();
  sessionsCollection.mockClear();
  sessionDoc.mockClear();
  sessionDocCollection.mockClear();
  changelogCollectionDoc.mockClear();
});

describe("createSession", () => {
  it("returns UNAUTHENTICATED when the token is invalid", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("bad token"));
    const result = await createSession({}, "bad-token");
    expect(result).toEqual({
      success: false,
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("verifies the ID token with checkRevoked=true", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "u1", name: "Alice Smith" });
    const { tx } = makeTx([false]);
    runTransaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );
    generateSessionName.mockReturnValueOnce("alpha-bravo-001");

    await createSession({}, "tok");

    expect(verifyIdToken).toHaveBeenCalledWith("tok", true);
  });

  it.each([
    ["non-integer", 12.5],
    ["zero", 0],
    ["negative", -100],
    ["above the cap", 2_000_001],
  ])("returns INVALID_AMOUNT when defaultBuyInCents is %s", async (_label, value) => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    const result = await createSession(
      { defaultBuyInCents: value as number },
      "tok",
    );
    expect(result).toEqual({
      success: false,
      error: { code: "INVALID_AMOUNT", message: expect.any(String) },
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("succeeds and returns the generated sessionId on first attempt", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    generateSessionName.mockReturnValueOnce("apple-bacon-001");
    const { tx, setMock } = makeTx([false]);
    runTransaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const result = await createSession({ defaultBuyInCents: 2500 }, "tok");

    expect(result).toEqual({
      success: true,
      data: { sessionId: "apple-bacon-001" },
    });
    expect(sessionDoc).toHaveBeenCalledWith("apple-bacon-001");
    expect(setMock).toHaveBeenCalledTimes(2);

    const [, sessionPayload] = setMock.mock.calls[0] ?? [];
    expect(sessionPayload).toMatchObject({
      name: "apple-bacon-001",
      name_lower: "apple-bacon-001",
      status: "in_progress",
      default_buy_in_cents: 2500,
      player_count: 0,
      previous_status: null,
      created_by_uid: "u1",
      created_by_name: "Alice",
    });

    const [changelogTarget, changelogPayload] = setMock.mock.calls[1] ?? [];
    expect(changelogTarget).toBe(changelogDocRef);
    expect(changelogPayload).toMatchObject({
      actor_uid: "u1",
      actor_name: "Alice",
      action_type: "session_created",
      metadata: { default_buy_in_cents: 2500 },
    });
  });

  it("stores default_buy_in_cents as null when input is omitted", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    generateSessionName.mockReturnValueOnce("bacon-bacon-007");
    const { tx, setMock } = makeTx([false]);
    runTransaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const result = await createSession({}, "tok");

    expect(result.success).toBe(true);
    const [, sessionPayload] = setMock.mock.calls[0] ?? [];
    expect(sessionPayload).toMatchObject({ default_buy_in_cents: null });
    const [, changelogPayload] = setMock.mock.calls[1] ?? [];
    expect(changelogPayload).toMatchObject({
      metadata: { default_buy_in_cents: null },
    });
  });

  it("retries on a name collision and succeeds with a new name", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    generateSessionName
      .mockReturnValueOnce("apple-bacon-001")
      .mockReturnValueOnce("cherry-date-002");

    // First attempt: doc exists → throws inside transaction.
    runTransaction.mockImplementationOnce(
      async (fn: (t: unknown) => unknown) => {
        const { tx } = makeTx([true]);
        return fn(tx); // throws NAME_COLLISION_RETRY
      },
    );
    // Second attempt: doc does not exist → succeeds.
    const { tx: secondTx } = makeTx([false]);
    runTransaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(secondTx),
    );

    const result = await createSession({}, "tok");
    expect(result).toEqual({
      success: true,
      data: { sessionId: "cherry-date-002" },
    });
    expect(generateSessionName).toHaveBeenCalledTimes(2);
  });

  it("returns NAME_COLLISION after 5 failed attempts", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    generateSessionName.mockReturnValue("apple-bacon-001");
    runTransaction.mockImplementation(async (fn: (t: unknown) => unknown) => {
      const { tx } = makeTx([true]);
      return fn(tx);
    });

    const result = await createSession({}, "tok");
    expect(result).toEqual({
      success: false,
      error: { code: "NAME_COLLISION", message: expect.any(String) },
    });
    expect(runTransaction).toHaveBeenCalledTimes(5);
  });

  it("returns INTERNAL_ERROR for non-collision transaction errors", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", name: "Alice Smith" });
    generateSessionName.mockReturnValueOnce("apple-bacon-001");
    runTransaction.mockRejectedValueOnce(new Error("boom"));

    const result = await createSession({}, "tok");
    expect(result).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: expect.any(String) },
    });
  });

  it("falls back to actor_name = Anonymous when the decoded token has no name", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1" });
    generateSessionName.mockReturnValueOnce("apple-bacon-001");
    const { tx, setMock } = makeTx([false]);
    runTransaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    await createSession({}, "tok");
    const [, sessionPayload] = setMock.mock.calls[0] ?? [];
    expect(sessionPayload).toMatchObject({ created_by_name: "Anonymous" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

const mocks = vi.hoisted(() => {
  const batchUpdate = vi.fn();
  const batchSet = vi.fn();
  const batchCommit = vi.fn(async () => {});

  const batch = { update: batchUpdate, set: batchSet, commit: batchCommit };

  const queryGet = vi.fn(async () => ({ docs: [] as unknown[] }));

  const queryWhere = vi.fn();

  function makeQueryChain() {
    const chain = { where: queryWhere, get: queryGet };
    queryWhere.mockReturnValue(chain);
    return chain;
  }

  const collection = vi.fn(() => makeQueryChain());

  const adminDb = {
    collection,
    batch: vi.fn(() => batch),
  };

  return {
    adminDb,
    batchUpdate,
    batchSet,
    batchCommit,
    batch,
    queryGet,
    queryWhere,
    collection,
  };
});

vi.mock("@/lib/firebase/admin", () => ({ adminDb: mocks.adminDb }));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__TS__" },
  Timestamp: {
    fromDate: (d: Date) => ({ _seconds: Math.floor(d.getTime() / 1000) }),
  },
}));

// ============ Import under test ============

import { archiveStaleSessionsOnLogin } from "./garbage-collect";

// ============ Helpers ============

type FakeDoc = {
  id: string;
  ref: {
    // Typed as a plain function rather than `ReturnType<typeof vi.fn>` so
    // Vitest 4's mock typing (Mock<Procedure | Constructable>) doesn't make
    // calls like .collection(...).doc(...) appear non-callable to tsc 6.
    collection: (path: string) => { doc: (id?: string) => { id: string } };
  };
  data: () => { status: string };
};

function makeDoc(id: string, status: string): FakeDoc {
  const logDocRef = { id: `${id}-log-doc` };
  const changeLogRef = { doc: vi.fn(() => logDocRef) };
  const ref = { collection: vi.fn(() => changeLogRef) };
  return { id, ref, data: () => ({ status }) };
}

// ============ Tests ============

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no stale docs
  mocks.queryGet.mockResolvedValue({ docs: [] });
  mocks.batchCommit.mockResolvedValue(undefined);
});

describe("archiveStaleSessionsOnLogin", () => {
  it("does nothing when no sessions are stale", async () => {
    mocks.queryGet.mockResolvedValue({ docs: [] });
    await archiveStaleSessionsOnLogin();
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("skips sessions that are already archived", async () => {
    mocks.queryGet.mockResolvedValue({
      docs: [makeDoc("s1", "archived")],
    });
    await archiveStaleSessionsOnLogin();
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("archives in_progress sessions and writes a change-log entry", async () => {
    const doc = makeDoc("s1", "in_progress");
    mocks.queryGet.mockResolvedValue({ docs: [doc] });

    await archiveStaleSessionsOnLogin();

    expect(mocks.batchUpdate).toHaveBeenCalledWith(doc.ref, {
      status: "archived",
      previous_status: "in_progress",
      updated_at: "__TS__",
    });

    const logRef = doc.ref.collection("change_log").doc(undefined);
    expect(mocks.batchSet).toHaveBeenCalledWith(logRef, {
      actor_uid: "system",
      actor_name: "Poker Ledger",
      action_type: "session_auto_archived",
      description:
        "Session automatically archived after 30 days of inactivity.",
      metadata: { previous_status: "in_progress" },
      created_at: "__TS__",
    });

    expect(mocks.batchCommit).toHaveBeenCalledOnce();
  });

  it("archives settling and settled sessions", async () => {
    mocks.queryGet.mockResolvedValue({
      docs: [makeDoc("s1", "settling"), makeDoc("s2", "settled")],
    });

    await archiveStaleSessionsOnLogin();

    expect(mocks.batchUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.batchSet).toHaveBeenCalledTimes(2);
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
  });

  it("only archives non-archived sessions when mixed results are returned", async () => {
    mocks.queryGet.mockResolvedValue({
      docs: [
        makeDoc("s1", "in_progress"),
        makeDoc("s2", "archived"),
        makeDoc("s3", "settling"),
      ],
    });

    await archiveStaleSessionsOnLogin();

    expect(mocks.batchUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
  });

  it("swallows errors so login is never blocked", async () => {
    mocks.queryGet.mockRejectedValue(new Error("Firestore unavailable"));
    await expect(archiveStaleSessionsOnLogin()).resolves.toBeUndefined();
  });

  it("swallows batch commit errors so login is never blocked", async () => {
    mocks.queryGet.mockResolvedValue({
      docs: [makeDoc("s1", "in_progress")],
    });
    mocks.batchCommit.mockRejectedValue(new Error("write failed"));
    await expect(archiveStaleSessionsOnLogin()).resolves.toBeUndefined();
  });
});

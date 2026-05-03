// @vitest-environment node
import fs from "node:fs";
import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8080";
const [host, portStr] = emulatorHost.split(":");
const port = Number(portStr ?? "8080");

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: host ?? "localhost",
      port,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const docs = {
  session: "sessions/abc",
  player: "sessions/abc/players/p1",
  buyIn: "sessions/abc/players/p1/buy_ins/b1",
  payment: "sessions/abc/payments/pay1",
  changeLog: "sessions/abc/change_log/log1",
  catchAll: "other_collection/x",
};

describe("/sessions/{sessionId}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc(docs.session).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.session).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.session)
        .set({ name: "x" }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .firestore()
        .doc(docs.session)
        .set({ name: "x" }),
    );
  });
});

describe("/sessions/{sessionId}/players/{playerId}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc(docs.player).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.player).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.player)
        .set({ display_name: "x" }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .firestore()
        .doc(docs.player)
        .set({ display_name: "x" }),
    );
  });
});

describe("/sessions/{sessionId}/players/{playerId}/buy_ins/{buyInId}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc(docs.buyIn).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.buyIn).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.buyIn)
        .set({ amount_cents: 100 }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .firestore()
        .doc(docs.buyIn)
        .set({ amount_cents: 100 }),
    );
  });
});

describe("/sessions/{sessionId}/payments/{paymentId}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc(docs.payment).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.payment).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.payment)
        .set({ amount_cents: 100 }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .firestore()
        .doc(docs.payment)
        .set({ amount_cents: 100 }),
    );
  });
});

describe("/sessions/{sessionId}/change_log/{entryId}", () => {
  test("authenticated read succeeds", async () => {
    await assertSucceeds(
      env.authenticatedContext("alice").firestore().doc(docs.changeLog).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.changeLog).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.changeLog)
        .set({ action: "x" }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env
        .unauthenticatedContext()
        .firestore()
        .doc(docs.changeLog)
        .set({ action: "x" }),
    );
  });
});

describe("catch-all /{document=**}", () => {
  test("authenticated read fails", async () => {
    await assertFails(
      env.authenticatedContext("alice").firestore().doc(docs.catchAll).get(),
    );
  });

  test("unauthenticated read fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.catchAll).get(),
    );
  });

  test("authenticated write fails", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc(docs.catchAll)
        .set({ x: 1 }),
    );
  });

  test("unauthenticated write fails", async () => {
    await assertFails(
      env.unauthenticatedContext().firestore().doc(docs.catchAll).set({ x: 1 }),
    );
  });
});

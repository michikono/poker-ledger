#!/usr/bin/env node
// Deploys Firestore security rules and composite indexes via the Firebase REST
// APIs, authenticating with the short-lived Workload Identity Federation access
// token minted by google-github-actions/auth. firebase-tools cannot authenticate
// from a keyless WIF credentials file (it wants a `firebase login` refresh
// token), so we call the APIs directly. See spec 0044.
//
// Env:
//   FIREBASE_ACCESS_TOKEN  (required) OAuth2 access token, cloud-platform scope.
//   FIREBASE_PROJECT_ID    (optional) defaults to poker-ledger-8d3bc.
//
// Behavior: creates a ruleset from firestore.rules and points the
// cloud.firestore release at it; creates each composite index from
// firestore.indexes.json, treating ALREADY_EXISTS as success. It does not delete
// indexes removed from the file (matches `firebase deploy` in --non-interactive),
// and it does not manage single-field fieldOverrides (fails loudly if any exist).

import { readFileSync } from "node:fs";

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "poker-ledger-8d3bc";
const TOKEN = process.env.FIREBASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("Missing FIREBASE_ACCESS_TOKEN.");
  process.exit(1);
}

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, json };
}

function fail(label, res) {
  throw new Error(
    `${label} failed (HTTP ${res.status}): ${JSON.stringify(res.json)}`,
  );
}

async function deployRules() {
  const content = readFileSync("firestore.rules", "utf8");
  const created = await api(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    "POST",
    { source: { files: [{ name: "firestore.rules", content }] } },
  );
  if (!created.ok) fail("Create ruleset", created);
  const rulesetName = created.json.name;
  console.log(`Created ruleset ${rulesetName}`);

  const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
  const updated = await api(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    "PATCH",
    {
      release: { name: releaseName, rulesetName },
      updateMask: "rulesetName",
    },
  );
  if (updated.ok) {
    console.log("Pointed cloud.firestore release at the new ruleset");
    return;
  }
  if (updated.status === 404) {
    const createdRelease = await api(
      `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,
      "POST",
      { name: releaseName, rulesetName },
    );
    if (!createdRelease.ok) fail("Create release", createdRelease);
    console.log("Created cloud.firestore release");
    return;
  }
  fail("Update release", updated);
}

async function deployIndexes() {
  const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
  const indexes = config.indexes ?? [];

  const overrides = config.fieldOverrides ?? [];
  if (overrides.length > 0) {
    throw new Error(
      `firestore.indexes.json has ${overrides.length} fieldOverrides, which this ` +
        "deploy does not manage — apply them manually or extend this script.",
    );
  }

  for (const index of indexes) {
    const { collectionGroup, queryScope, fields } = index;
    const res = await api(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups/${collectionGroup}/indexes`,
      "POST",
      { queryScope, fields },
    );
    const label = `${collectionGroup} [${fields
      .map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig}`)
      .join(", ")}]`;
    if (res.ok) {
      console.log(`Created index on ${label}`);
      continue;
    }
    if (res.status === 409 || res.json?.error?.status === "ALREADY_EXISTS") {
      console.log(`Index on ${label} already exists`);
      continue;
    }
    fail(`Create index on ${label}`, res);
  }
}

await deployRules();
await deployIndexes();
console.log("Firestore config deployed.");

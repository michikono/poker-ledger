import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "demo-poker-ledger";
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n",
);

if (!getApps().length) {
  const options: AppOptions =
    clientEmail && privateKey
      ? { credential: cert({ projectId, clientEmail, privateKey }), projectId }
      : { projectId };
  initializeApp(options);
}

export const adminAuth = getAuth();

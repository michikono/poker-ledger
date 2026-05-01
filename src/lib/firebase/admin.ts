import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Local dev: emulator is used automatically when FIRESTORE_EMULATOR_HOST is set.
// Production: TODO — set FIREBASE_SERVICE_ACCOUNT_KEY (base64 service account JSON)
//             when the Firebase project is configured.
const app =
  getApps().length === 0
    ? initializeApp({
        projectId:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-poker-ledger",
      })
    : (getApps()[0] ?? initializeApp({ projectId: "demo-poker-ledger" }));

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

// Firebase Admin SDK initialization is in @/lib/auth/admin.
// This module re-exports adminAuth and provides adminDb for Firestore usage.
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Ensure auth/admin has initialized the app before we use getFirestore
// (Next.js module evaluation order means auth/admin may not be imported first).
// We import it here only for the side effect of initialization.
import "@/lib/auth/admin";

const app = getApps()[0];
if (!app) throw new Error("Firebase Admin app not initialized");
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

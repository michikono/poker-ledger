import type { FirebaseOptions } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
} from "firebase/firestore";

function getClientApp() {
  const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function isDemoProject() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-");
}

function createClientAuth() {
  const auth = getAuth(getClientApp());

  if (isDemoProject()) {
    const emulatorUrl =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ??
      "http://localhost:9099";
    try {
      connectAuthEmulator(auth, emulatorUrl, {
        disableWarnings: true,
      });
    } catch {
      // already connected
    }
  }

  return auth;
}

function createClientDb() {
  const db = getFirestore(getClientApp());

  if (isDemoProject()) {
    const host =
      process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ??
      "localhost:8080";
    const [hostname, port] = host.split(":");
    try {
      connectFirestoreEmulator(
        db,
        hostname ?? "localhost",
        Number(port ?? 8080),
      );
    } catch {
      // already connected
    }
  }

  return db;
}

// Lazy singletons — initialized once, only when first accessed in the browser.
let _auth: ReturnType<typeof createClientAuth> | undefined;
let _db: Firestore | undefined;

export function getClientAuth() {
  if (!_auth) {
    _auth = createClientAuth();
  }
  return _auth;
}

export function getClientDb(): Firestore {
  if (!_db) {
    _db = createClientDb();
  }
  return _db;
}

import type { FirebaseOptions } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

function createClientAuth() {
  const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-")) {
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

// Lazy singleton — initialized once, only when first accessed in the browser
let _auth: ReturnType<typeof createClientAuth> | undefined;

export function getClientAuth() {
  if (!_auth) {
    _auth = createClientAuth();
  }
  return _auth;
}

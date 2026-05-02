"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";
import { createSession } from "./actions";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/sessions";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(getClientAuth(), provider);
      const idToken = await result.user.getIdToken();
      await createSession(idToken);
      router.push(from);
    } catch (err) {
      setError("Sign-in failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400, padding: "2rem" }}>
        <h1>Poker Ledger</h1>
        <p style={{ margin: "1rem 0 2rem" }}>Track your cash game sessions.</p>
        {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
        <button type="button" onClick={handleSignIn} disabled={loading}>
          {loading ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

"use client";

import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CardIcon } from "@/components/icons/card-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getClientAuth } from "@/lib/firebase/client";
import { createSession } from "./actions";

const SILENT_POPUP_ERRORS = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

function SignInFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/sessions";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-warm Firebase auth on mount so the click handler can open the OAuth
  // popup synchronously within the user-activation window. Awaiting auth
  // state inside the click handler made the first click race with IndexedDB
  // persistence init, exhausting the gesture window and causing the popup
  // to be suppressed; the second click then worked because state was cached.
  useEffect(() => {
    getClientAuth()
      .authStateReady()
      .catch(() => {});
  }, []);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const auth = getClientAuth();
    const provider = new GoogleAuthProvider();
    const popupPromise = signInWithPopup(auth, provider);
    try {
      const result = await popupPromise;
      const idToken = await result.user.getIdToken();
      await createSession(idToken);
      router.push(from);
    } catch (err) {
      if (err instanceof FirebaseError && SILENT_POPUP_ERRORS.has(err.code)) {
        // User dismissed the popup — don't show an error.
        setLoading(false);
        return;
      }
      setError("Sign-in failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-1 flex size-14 items-center justify-center rounded-2xl bg-felt/10">
            <CardIcon size={36} />
          </div>
          <CardTitle className="text-xl">Poker Ledger</CardTitle>
          <CardDescription>Track your cash game sessions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="h-12 w-full text-base"
          >
            {loading ? "Signing in…" : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function SignInForm() {
  return (
    <Suspense>
      <SignInFormInner />
    </Suspense>
  );
}

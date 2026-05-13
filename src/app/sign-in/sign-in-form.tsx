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
} from "@/components/ui/card";
import { getClientAuth } from "@/lib/firebase/client";
import { createSession } from "./actions";

const SILENT_POPUP_ERRORS = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

/**
 * Guards against open-redirect via the `from` query param. We only accept
 * values that are unambiguous internal paths:
 *   - must start with a single "/"
 *   - must not start with "//" (protocol-relative URL → external host)
 *   - must not contain "://" (absolute URL with protocol → external host)
 *   - must not start with "/\\" (some browsers normalise this to "//")
 *   - capped at a sane length
 *
 * Anything else falls back to /sessions.
 */
export function isSafeInternalPath(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 1000) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  if (value.includes("://")) return false;
  return true;
}

function SignInFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const from =
    fromParam && isSafeInternalPath(fromParam) ? fromParam : "/sessions";
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
          <h1 className="font-heading text-xl leading-snug font-medium">
            Poker Ledger
          </h1>
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

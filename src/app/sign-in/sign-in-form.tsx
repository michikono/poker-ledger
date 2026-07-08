"use client";

import { FirebaseError } from "firebase/app";
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
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

// Popup is blocked or unsupported (common in mobile in-app browsers). Fall back
// to a full-page redirect, which `getRedirectResult` completes on return.
const REDIRECT_FALLBACK_ERRORS = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/**
 * Routes a `signInWithPopup` failure to one of three actions:
 *   - "silent": the user dismissed the popup — don't show an error.
 *   - "redirect": the popup is unavailable — fall back to a full-page redirect.
 *   - "error": a real failure — surface it to the user.
 */
export function classifyPopupError(
  err: unknown,
): "silent" | "redirect" | "error" {
  if (!(err instanceof FirebaseError)) return "error";
  if (SILENT_POPUP_ERRORS.has(err.code)) return "silent";
  if (REDIRECT_FALLBACK_ERRORS.has(err.code)) return "redirect";
  return "error";
}

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
  // Start busy: on mount we resolve any pending OAuth redirect before the
  // button becomes actionable, so a redirect return can't be interrupted.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount, complete a redirect-based sign-in and pre-warm auth. Mobile
  // browsers frequently degrade `signInWithPopup` into a full-page redirect
  // (ADR 0011); `getRedirectResult` is what finishes that flow when the user
  // lands back here. Without it, the session cookie is never created and the
  // proxy bounces the user straight back to /sign-in. Pre-warming auth here
  // also lets the click handler open the popup synchronously within the
  // user-activation window (a cold first click otherwise raced IndexedDB
  // persistence init and got suppressed).
  useEffect(() => {
    const auth = getClientAuth();
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) {
          setLoading(false);
          return;
        }
        const idToken = await result.user.getIdToken();
        await createSession(idToken);
        router.push(from);
      })
      .catch((err) => {
        setError("Sign-in failed. Please try again.");
        console.error(err);
        setLoading(false);
      });
  }, [from, router]);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const auth = getClientAuth();
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await createSession(idToken);
      router.push(from);
    } catch (err) {
      const action = classifyPopupError(err);
      if (action === "silent") {
        // User dismissed the popup — don't show an error.
        setLoading(false);
        return;
      }
      if (action === "redirect") {
        // Navigates away; getRedirectResult completes on return. Keep loading.
        await signInWithRedirect(auth, provider);
        return;
      }
      setError("Sign-in failed. Please try again.");
      console.error(err);
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
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-fg"
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

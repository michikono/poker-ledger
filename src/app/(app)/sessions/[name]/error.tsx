"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SessionErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Session detail error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">
        Couldn&apos;t load this session
      </h1>
      <p className="text-muted-foreground">
        Something went wrong while loading. You can try again or go back to the
        session list.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/sessions" />}>
          Back to sessions
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";

export default function SessionsError({
  reset,
}: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground">
          Something went wrong loading sessions.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}

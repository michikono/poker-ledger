"use client";

import { SessionSearchInput } from "@/components/sessions/session-search-input";
import { Button } from "@/components/ui/button";
import { CreateSessionDialog } from "./create-session-dialog";

export function SessionsHeader() {
  return (
    <div className="flex items-center justify-between gap-4">
      <SessionSearchInput className="max-w-sm" />
      <CreateSessionDialog trigger={<Button>New session</Button>} />
    </div>
  );
}

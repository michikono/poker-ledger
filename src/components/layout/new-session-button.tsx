"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSessionDialog } from "@/app/(app)/sessions/create-session-dialog";

export function NewSessionButton() {
  return (
    <CreateSessionDialog
      trigger={
        <Button className="w-full justify-start gap-2">
          <PlusIcon className="size-4" />
          New session
        </Button>
      }
    />
  );
}

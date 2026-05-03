"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/app/sign-in/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export type UserMenuProps = {
  firstName: string;
};

export function UserMenu({ firstName }: UserMenuProps) {
  const [pending, startTransition] = useTransition();
  const initial = firstName.charAt(0).toUpperCase() || "?";

  function handleSignOut() {
    startTransition(() => {
      signOut();
    });
  }

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <Avatar size="sm">
        <AvatarFallback className="bg-felt text-primary-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-sm font-medium">{firstName}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        disabled={pending}
        className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <LogOutIcon className="size-3.5" />
        {pending ? "Signing out…" : "Log out"}
      </Button>
    </div>
  );
}

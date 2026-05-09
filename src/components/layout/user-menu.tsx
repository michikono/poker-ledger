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
      <Avatar>
        <AvatarFallback className="bg-felt text-primary-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-base font-medium md:text-sm">
        {firstName}
      </span>
      <Button
        variant="ghost"
        onClick={handleSignOut}
        disabled={pending}
        className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground md:h-7 md:gap-1 md:px-2.5 md:text-[0.8rem]"
      >
        <LogOutIcon className="size-4 md:size-3.5" />
        {pending ? "Signing out…" : "Log out"}
      </Button>
    </div>
  );
}

"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/app/sign-in/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type UserMenuProps = {
  firstName: string;
  variant?: "rail" | "header";
};

export function UserMenu({ firstName, variant = "rail" }: UserMenuProps) {
  const [pending, startTransition] = useTransition();
  const initial = firstName.charAt(0).toUpperCase() || "?";

  function handleSignOut() {
    startTransition(() => {
      signOut();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={variant === "rail" ? "lg" : "icon"}
            className={cn(
              variant === "rail"
                ? "h-auto w-full justify-start gap-2 px-2 py-2"
                : "rounded-full",
            )}
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-felt text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        {variant === "rail" && (
          <span className="truncate text-sm font-medium">{firstName}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>Signed in as {firstName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={pending}
          variant="destructive"
        >
          <LogOutIcon />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

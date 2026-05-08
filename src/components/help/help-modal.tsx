"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HelpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * Full-screen mobile-friendly help modal.
 *
 * Layout: header at the top, scrollable body in the middle, floating
 * close button anchored to the bottom of the modal. The body has
 * pb-20 padding so the last paragraph can scroll fully into view above
 * the floating close button at every scroll position.
 */
export function HelpModal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: HelpModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="help-modal"
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            "md:inset-y-4 md:left-1/2 md:h-auto md:w-[calc(100%-2rem)] md:max-w-2xl md:-translate-x-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10",
            className,
          )}
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogPrimitive.Title
              data-slot="help-modal-title"
              className="font-heading text-base font-medium"
            >
              {title}
            </DialogPrimitive.Title>
          </header>
          <div
            data-slot="help-modal-body"
            className="flex-1 overflow-y-auto p-4 pb-20"
          >
            {children}
          </div>
          <div
            data-slot="help-modal-footer"
            className="absolute inset-x-0 bottom-0 border-t border-border bg-background/85 p-3 supports-backdrop-filter:bg-background/70 supports-backdrop-filter:backdrop-blur-sm"
          >
            <DialogPrimitive.Close
              data-slot="help-modal-close"
              render={<Button variant="default" className="w-full" />}
            >
              Close
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

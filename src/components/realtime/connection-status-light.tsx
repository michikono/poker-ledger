"use client";

import { Popover } from "@base-ui/react/popover";
import { CONNECTION_COPY, isLive } from "@/lib/realtime/connection-status";
import { cn } from "@/lib/utils";
import { useRealtimeStatus } from "./realtime-sync-provider";

// Small connection light shown right of the page header. Green + subtle pulse
// when live, solid red + static otherwise. Tapping it opens a short popover
// explaining the state. The dot is a ≥44px tap target (padded) so it's
// thumb-friendly on mobile.
export function ConnectionStatusLight() {
  const status = useRealtimeStatus();
  const live = isLive(status);
  const copy = CONNECTION_COPY[status];

  return (
    <Popover.Root>
      <Popover.Trigger
        data-testid="connection-status-light"
        aria-label={`Connection: ${copy.label}. Tap for details.`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9"
      >
        <span
          className={cn(
            "size-2.5 rounded-full",
            live
              ? "bg-emerald-500 connection-pulse shadow-[0_0_0_2px] shadow-emerald-500/25"
              : "bg-red-500",
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <Popover.Popup className="z-50 max-w-[16rem] origin-(--transform-origin) rounded-md bg-popover p-3 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Popover.Title className="flex items-center gap-1.5 font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  live ? "bg-emerald-500" : "bg-red-500",
                )}
              />
              {copy.label}
            </Popover.Title>
            <Popover.Description className="mt-1 text-muted-foreground">
              {copy.detail}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

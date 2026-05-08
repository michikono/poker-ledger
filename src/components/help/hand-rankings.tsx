"use client";

import { HelpModal } from "./help-modal";

export type HandRankingsCheatsheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Stub. Track 4 of spec 0017 replaces this with the real 10-row hand-rankings
 * content driven by HAND_RANKINGS from src/lib/help/hand-rankings-data.ts.
 *
 * Never user-visible while HELP_ENABLED is false (see help-buttons.tsx).
 */
export function HandRankingsCheatsheet({
  open,
  onOpenChange,
}: HandRankingsCheatsheetProps) {
  return (
    <HelpModal
      open={open}
      onOpenChange={onOpenChange}
      title="Hand rankings (Texas Hold'em)"
    >
      <p className="text-sm text-muted-foreground">
        Coming soon — track 4 of spec 0017.
      </p>
    </HelpModal>
  );
}

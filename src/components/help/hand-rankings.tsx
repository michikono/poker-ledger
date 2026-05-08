"use client";

import { HAND_RANKINGS } from "@/lib/help/hand-rankings-data";
import { HelpModal } from "./help-modal";

export type HandRankingsCheatsheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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
      <p className="mb-4 text-sm text-muted-foreground">
        From strongest to weakest. Odds are the chance you'll make exactly this
        rank by the river in a 7-card Texas Hold'em hand.
      </p>
      <ul className="flex flex-col gap-3">
        {HAND_RANKINGS.map((hand) => (
          <li
            key={hand.rank}
            className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 md:flex-row md:items-center md:gap-4"
          >
            <img
              src={hand.svgPath}
              alt={`${hand.name} example`}
              className="h-20 w-auto self-center md:self-start"
              loading="lazy"
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h2 className="font-heading text-base font-medium">
                  {hand.name}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {hand.oddsLabel}
                </span>
              </div>
              <p className="text-sm text-foreground/85">{hand.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </HelpModal>
  );
}

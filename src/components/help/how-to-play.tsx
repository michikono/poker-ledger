"use client";

import { HelpModal } from "./help-modal";

export type HowToPlayGuideProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Stub. Track 5 of spec 0017 replaces this with the newbie-friendly
 * No-Limit Texas Hold'em walkthrough (with the terminology rule and six
 * expandable worked examples).
 *
 * Never user-visible while HELP_ENABLED is false (see help-buttons.tsx).
 */
export function HowToPlayGuide({ open, onOpenChange }: HowToPlayGuideProps) {
  return (
    <HelpModal
      open={open}
      onOpenChange={onOpenChange}
      title="How to play (No-Limit Texas Hold'em)"
    >
      <p className="text-sm text-muted-foreground">
        Coming soon — track 5 of spec 0017.
      </p>
    </HelpModal>
  );
}

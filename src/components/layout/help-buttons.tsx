"use client";

import { BookOpen, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Feature flag for the help buttons + modals UI introduced by spec 0017.
 *
 * - `false` (default): the AppShell renders unchanged. Tracks 1–3 of the
 *   spec land the infrastructure but no user-visible UI.
 * - `true`: the AppShell shows the Rankings + Rules buttons in its
 *   top-right corner, and the mobile header swaps the right-side avatar
 *   for these buttons (dropping the "Poker Ledger" text from the brand
 *   to make horizontal room).
 *
 * Flip to `true` once tracks 4 and 5 (cheatsheet content + guide content)
 * have merged.
 */
export const HELP_ENABLED = false;

const HandRankingsCheatsheet = dynamic(
  () =>
    import("@/components/help/hand-rankings").then(
      (m) => m.HandRankingsCheatsheet,
    ),
  { ssr: false },
);

const HowToPlayGuide = dynamic(
  () => import("@/components/help/how-to-play").then((m) => m.HowToPlayGuide),
  { ssr: false },
);

export function HelpButtons() {
  const [rankingsOpen, setRankingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setRankingsOpen(true)}
        aria-label="Hand rankings"
        className="gap-1.5"
      >
        <Trophy className="size-4" aria-hidden />
        <span>Rankings</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setRulesOpen(true)}
        aria-label="How to play"
        className="gap-1.5"
      >
        <BookOpen className="size-4" aria-hidden />
        <span>Rules</span>
      </Button>
      {rankingsOpen && (
        <HandRankingsCheatsheet
          open={rankingsOpen}
          onOpenChange={setRankingsOpen}
        />
      )}
      {rulesOpen && (
        <HowToPlayGuide open={rulesOpen} onOpenChange={setRulesOpen} />
      )}
    </>
  );
}

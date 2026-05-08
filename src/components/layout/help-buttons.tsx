"use client";

import { BookOpen, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { Button } from "@/components/ui/button";

/**
 * Feature flag for the help buttons + modals UI introduced by spec 0017.
 *
 * Live: track 5 of spec 0017 turned this on once both content surfaces
 * (hand-rankings cheatsheet + how-to-play guide) shipped.
 *
 * When true: the AppShell shows the "Cheat sheet" + "Rules" buttons in its
 * top-right corner, and the mobile header swaps the right-side avatar for
 * these buttons (dropping the "Poker Ledger" text from the brand to make
 * horizontal room).
 */
export const HELP_ENABLED = true;

/**
 * URL search-param key used to deep-link into a help modal.
 *
 * `?help=cheatsheet` → hand-rankings cheatsheet open.
 * `?help=rules`      → how-to-play guide open.
 *
 * Lives in the search params (not the path) so any session URL can be
 * shared with `?help=…` appended and the recipient lands on the same
 * session with the help modal already open. Closing the modal removes
 * the param.
 */
export const HELP_PARAM = "help";

type HelpKind = "cheatsheet" | "rules";

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
  // useSearchParams() suspends during streaming SSR. Wrap so the AppShell
  // doesn't suspend on every page until search params resolve.
  return (
    <Suspense fallback={<HelpButtonsShell />}>
      <HelpButtonsImpl />
    </Suspense>
  );
}

/** Renders just the buttons, used as the Suspense fallback so the layout
 *  doesn't shift while search params are pending. */
function HelpButtonsShell() {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled
        aria-label="Hand rankings"
        className="gap-1.5"
      >
        <Trophy className="size-4" aria-hidden />
        <span>Cheat sheet</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled
        aria-label="How to play"
        className="gap-1.5"
      >
        <BookOpen className="size-4" aria-hidden />
        <span>Rules</span>
      </Button>
    </>
  );
}

function HelpButtonsImpl() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentHelp = searchParams.get(HELP_PARAM);
  const cheatsheetOpen = currentHelp === "cheatsheet";
  const rulesOpen = currentHelp === "rules";

  const buildUrl = useCallback(
    (next: HelpKind | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null) {
        params.delete(HELP_PARAM);
      } else {
        params.set(HELP_PARAM, next);
      }
      const search = params.toString();
      return search ? `${pathname}?${search}` : pathname;
    },
    [pathname, searchParams],
  );

  const openHelp = useCallback(
    (kind: HelpKind) => {
      router.replace(buildUrl(kind), { scroll: false });
    },
    [router, buildUrl],
  );

  const closeHelp = useCallback(() => {
    router.replace(buildUrl(null), { scroll: false });
  }, [router, buildUrl]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => openHelp("cheatsheet")}
        aria-label="Hand rankings"
        aria-expanded={cheatsheetOpen}
        className="gap-1.5"
      >
        <Trophy className="size-4" aria-hidden />
        <span>Cheat sheet</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => openHelp("rules")}
        aria-label="How to play"
        aria-expanded={rulesOpen}
        className="gap-1.5"
      >
        <BookOpen className="size-4" aria-hidden />
        <span>Rules</span>
      </Button>
      {cheatsheetOpen && (
        <HandRankingsCheatsheet
          open={cheatsheetOpen}
          onOpenChange={(next) => {
            if (!next) closeHelp();
          }}
        />
      )}
      {rulesOpen && (
        <HowToPlayGuide
          open={rulesOpen}
          onOpenChange={(next) => {
            if (!next) closeHelp();
          }}
        />
      )}
    </>
  );
}

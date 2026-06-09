export type HandRank =
  | "royal-flush"
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "one-pair"
  | "high-card";

export type HandInfo = {
  rank: HandRank;
  name: string;
  oddsLabel: string;
  oddsHumanReadable: string;
  explanation: string;
  svgPath: string;
};

// Ordered strongest → weakest. Odds are 7-card Hold'em probabilities — the
// chance your best 5-card hand at showdown is exactly this rank.
// Source: Wikipedia, "Poker probability".
export const HAND_RANKINGS = [
  {
    rank: "royal-flush",
    name: "Royal flush",
    oddsLabel: "1 in 30,940 (0.0032%)",
    oddsHumanReadable: "About 1 in 30,000",
    explanation:
      "10 J Q K A all of one suit. The unbeatable hand: nothing in poker beats it.",
    svgPath: "/help/hand-rankings/royal-flush.svg",
  },
  {
    rank: "straight-flush",
    name: "Straight flush",
    oddsLabel: "1 in 3,590 (0.028%)",
    oddsHumanReadable: "About 1 in 3,500",
    explanation:
      "Five cards of one suit in sequence. Beaten only by a higher straight flush.",
    svgPath: "/help/hand-rankings/straight-flush.svg",
  },
  {
    rank: "four-of-a-kind",
    name: "Four of a kind",
    oddsLabel: "1 in 594 (0.17%)",
    oddsHumanReadable: "About 1 in 600",
    explanation:
      "Four cards of the same rank, plus a fifth card (the kicker). Often called “quads”.",
    svgPath: "/help/hand-rankings/four-of-a-kind.svg",
  },
  {
    rank: "full-house",
    name: "Full house",
    oddsLabel: "1 in 38 (2.6%)",
    oddsHumanReadable: "About 1 in 40",
    explanation:
      "Three of one rank and two of another. Higher trips win first; if those tie, higher pair wins.",
    svgPath: "/help/hand-rankings/full-house.svg",
  },
  {
    rank: "flush",
    name: "Flush",
    oddsLabel: "1 in 33 (3.0%)",
    oddsHumanReadable: "About 1 in 30",
    explanation:
      "Five cards of one suit, not in sequence. Highest card wins between flushes.",
    svgPath: "/help/hand-rankings/flush.svg",
  },
  {
    rank: "straight",
    name: "Straight",
    oddsLabel: "1 in 22 (4.6%)",
    oddsHumanReadable: "About 1 in 20",
    explanation:
      "Five cards in sequence, mixed suits. Ace plays high (10-J-Q-K-A) or low (A-2-3-4-5).",
    svgPath: "/help/hand-rankings/straight.svg",
  },
  {
    rank: "three-of-a-kind",
    name: "Three of a kind",
    oddsLabel: "1 in 21 (4.8%)",
    oddsHumanReadable: "About 1 in 20",
    explanation:
      "Three cards of the same rank plus two unrelated cards. Often called “trips” or a “set”.",
    svgPath: "/help/hand-rankings/three-of-a-kind.svg",
  },
  {
    rank: "two-pair",
    name: "Two pair",
    oddsLabel: "1 in 4.3 (23.5%)",
    oddsHumanReadable: "Roughly 1 in 4",
    explanation:
      "Two cards of one rank, two of another, plus a fifth card. Higher pair wins between two-pair hands.",
    svgPath: "/help/hand-rankings/two-pair.svg",
  },
  {
    rank: "one-pair",
    name: "One pair",
    oddsLabel: "1 in 2.3 (43.8%)",
    oddsHumanReadable: "Roughly 1 in 2",
    explanation:
      "Two cards of the same rank plus three unrelated cards. The most common showdown hand.",
    svgPath: "/help/hand-rankings/one-pair.svg",
  },
  {
    rank: "high-card",
    name: "High card",
    oddsLabel: "1 in 5.7 (17.4%)",
    oddsHumanReadable: "About 1 in 6",
    explanation:
      "When you don’t make any of the above. Highest card wins; tied highs are broken by the next-highest, and so on.",
    svgPath: "/help/hand-rankings/high-card.svg",
  },
] as const satisfies readonly HandInfo[];

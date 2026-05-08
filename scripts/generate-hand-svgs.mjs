#!/usr/bin/env node
/**
 * Generates the 10 hand-rankings SVGs into public/help/hand-rankings/.
 *
 * Idempotent: same input → same output bytes. Run via `npm run gen:hand-rankings`.
 *
 * The example hands are hardcoded here (rather than imported from the
 * runtime data file) so this script stays standalone Node.js — the project
 * doesn't ship a TypeScript runtime for scripts. Slugs must match the
 * `svgPath` values in src/lib/help/hand-rankings-data.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const outDir = join(repoRoot, "public/help/hand-rankings");

const SUITS = {
  spades: { symbol: "♠", color: "#1a1a1a" },
  hearts: { symbol: "♥", color: "#c4263a" },
  diamonds: { symbol: "♦", color: "#c4263a" },
  clubs: { symbol: "♣", color: "#1a1a1a" },
};

/**
 * Each card has an optional `dim` flag. Dimmed cards are rendered at lower
 * opacity to signal that they're NOT part of the hand's defining rank — they
 * are kickers / unrelated cards that only matter for tie-breaking. The intent
 * is to draw the reader's eye to the cards that actually make the hand.
 *
 * Hands where every card contributes to the definition (royal flush, straight
 * flush, full house, flush, straight) have no dimmed cards.
 *
 * @type {{slug: string; cards: {rank: string; suit: keyof typeof SUITS; dim?: boolean}[]}[]}
 */
const HANDS = [
  {
    slug: "royal-flush",
    cards: [
      { rank: "10", suit: "spades" },
      { rank: "J", suit: "spades" },
      { rank: "Q", suit: "spades" },
      { rank: "K", suit: "spades" },
      { rank: "A", suit: "spades" },
    ],
  },
  {
    slug: "straight-flush",
    cards: [
      { rank: "5", suit: "hearts" },
      { rank: "6", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "8", suit: "hearts" },
      { rank: "9", suit: "hearts" },
    ],
  },
  {
    // Four aces are the hand; the 9 is just a kicker.
    slug: "four-of-a-kind",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "diamonds" },
      { rank: "A", suit: "clubs" },
      { rank: "9", suit: "spades", dim: true },
    ],
  },
  {
    slug: "full-house",
    cards: [
      { rank: "K", suit: "spades" },
      { rank: "K", suit: "hearts" },
      { rank: "K", suit: "diamonds" },
      { rank: "7", suit: "spades" },
      { rank: "7", suit: "clubs" },
    ],
  },
  {
    slug: "flush",
    cards: [
      { rank: "A", suit: "clubs" },
      { rank: "J", suit: "clubs" },
      { rank: "8", suit: "clubs" },
      { rank: "5", suit: "clubs" },
      { rank: "2", suit: "clubs" },
    ],
  },
  {
    slug: "straight",
    cards: [
      { rank: "5", suit: "spades" },
      { rank: "6", suit: "hearts" },
      { rank: "7", suit: "diamonds" },
      { rank: "8", suit: "clubs" },
      { rank: "9", suit: "hearts" },
    ],
  },
  {
    // Three sevens are the hand; K and 2 are kickers.
    slug: "three-of-a-kind",
    cards: [
      { rank: "7", suit: "spades" },
      { rank: "7", suit: "hearts" },
      { rank: "7", suit: "diamonds" },
      { rank: "K", suit: "clubs", dim: true },
      { rank: "2", suit: "spades", dim: true },
    ],
  },
  {
    // The two pairs are the hand; the 3 is the kicker.
    slug: "two-pair",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "clubs" },
      { rank: "8", suit: "spades" },
      { rank: "8", suit: "diamonds" },
      { rank: "3", suit: "hearts", dim: true },
    ],
  },
  {
    // The pair of jacks is the hand; the rest are kickers.
    slug: "one-pair",
    cards: [
      { rank: "J", suit: "spades" },
      { rank: "J", suit: "hearts" },
      { rank: "9", suit: "clubs", dim: true },
      { rank: "6", suit: "diamonds", dim: true },
      { rank: "2", suit: "spades", dim: true },
    ],
  },
  {
    // Only the ace defines the hand ("ace high"); the rest are tie-breakers.
    slug: "high-card",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "clubs", dim: true },
      { rank: "8", suit: "spades", dim: true },
      { rank: "5", suit: "diamonds", dim: true },
      { rank: "2", suit: "hearts", dim: true },
    ],
  },
];

const CARD_W = 60;
const CARD_H = 84;
const STEP = 65; // card width + 5 gap
const PAD = 2; // viewBox margin so the 1px stroke isn't clipped

/**
 * @param {{rank: string; suit: keyof typeof SUITS; dim?: boolean}} card
 * @param {number} x
 */
function renderCard(card, x) {
  const { symbol, color } = SUITS[card.suit];
  // Visual hierarchy: rank in the corner is the primary identifier, since many
  // hands (e.g., straights, two pair) are read by rank rather than suit. Suit
  // symbol is the secondary identifier — kept legible but visually subordinate.
  // `dim` cards (kickers / unrelated cards) get reduced opacity so the reader
  // can see at a glance which cards make up the hand definition.
  const opacity = card.dim ? ' opacity="0.4"' : "";
  return `<g transform="translate(${x}, 0)"${opacity}>
    <rect width="${CARD_W}" height="${CARD_H}" rx="6" ry="6" fill="white" stroke="#9ca3af" stroke-width="1"/>
    <text x="6" y="22" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="${color}">${card.rank}</text>
    <text x="${CARD_W / 2}" y="${CARD_H / 2 + 9}" font-family="system-ui, sans-serif" font-size="22" fill="${color}" text-anchor="middle">${symbol}</text>
  </g>`;
}

/** @param {{rank: string; suit: keyof typeof SUITS}[]} cards */
function renderHand(cards) {
  const totalW = CARD_W + (cards.length - 1) * STEP;
  const cardsXml = cards.map((c, i) => renderCard(c, i * STEP)).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${PAD} -${PAD} ${totalW + 2 * PAD} ${CARD_H + 2 * PAD}" width="${totalW}" height="${CARD_H}" role="img">
  ${cardsXml}
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
let count = 0;
for (const hand of HANDS) {
  const svg = renderHand(hand.cards);
  writeFileSync(join(outDir, `${hand.slug}.svg`), svg);
  count++;
}
console.log(`✓ Generated ${count} hand SVGs in public/help/hand-rankings/`);

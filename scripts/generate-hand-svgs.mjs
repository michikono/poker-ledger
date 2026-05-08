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

/** @type {{slug: string; cards: {rank: string; suit: keyof typeof SUITS}[]}[]} */
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
    slug: "four-of-a-kind",
    cards: [
      { rank: "A", suit: "spades" },
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "diamonds" },
      { rank: "A", suit: "clubs" },
      { rank: "9", suit: "spades" },
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
    slug: "three-of-a-kind",
    cards: [
      { rank: "7", suit: "spades" },
      { rank: "7", suit: "hearts" },
      { rank: "7", suit: "diamonds" },
      { rank: "K", suit: "clubs" },
      { rank: "2", suit: "spades" },
    ],
  },
  {
    slug: "two-pair",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "clubs" },
      { rank: "8", suit: "spades" },
      { rank: "8", suit: "diamonds" },
      { rank: "3", suit: "hearts" },
    ],
  },
  {
    slug: "one-pair",
    cards: [
      { rank: "J", suit: "spades" },
      { rank: "J", suit: "hearts" },
      { rank: "9", suit: "clubs" },
      { rank: "6", suit: "diamonds" },
      { rank: "2", suit: "spades" },
    ],
  },
  {
    slug: "high-card",
    cards: [
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "clubs" },
      { rank: "8", suit: "spades" },
      { rank: "5", suit: "diamonds" },
      { rank: "2", suit: "hearts" },
    ],
  },
];

const CARD_W = 60;
const CARD_H = 84;
const STEP = 65; // card width + 5 gap
const PAD = 2; // viewBox margin so the 1px stroke isn't clipped

/**
 * @param {{rank: string; suit: keyof typeof SUITS}} card
 * @param {number} x
 */
function renderCard(card, x) {
  const { symbol, color } = SUITS[card.suit];
  return `<g transform="translate(${x}, 0)">
    <rect width="${CARD_W}" height="${CARD_H}" rx="6" ry="6" fill="white" stroke="#9ca3af" stroke-width="1"/>
    <text x="6" y="16" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${color}">${card.rank}</text>
    <text x="6" y="29" font-family="system-ui, sans-serif" font-size="12" fill="${color}">${symbol}</text>
    <text x="${CARD_W / 2}" y="${CARD_H / 2 + 12}" font-family="system-ui, sans-serif" font-size="32" fill="${color}" text-anchor="middle">${symbol}</text>
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

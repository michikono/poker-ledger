"use client";

import type { ReactNode } from "react";
import { HelpModal } from "./help-modal";

export type HowToPlayGuideProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HowToPlayGuide({ open, onOpenChange }: HowToPlayGuideProps) {
  return (
    <HelpModal
      open={open}
      onOpenChange={onOpenChange}
      title="How to play (No-Limit Texas Hold'em)"
    >
      <div className="space-y-6 text-sm leading-relaxed text-foreground">
        <p className="text-base">
          Each player tries to make the best 5-card poker hand using any
          combination of their own 2 face-down cards plus 5 shared face-up cards
          on the table. Whoever has the best hand at the end wins the chips that
          everyone bet during the hand (the <em>pot</em>).
        </p>

        <Section title="The goal of a hand">
          <p>
            You want the best 5-card hand at <em>showdown</em> — the moment at
            the end of the hand when remaining players reveal their cards. Each
            player has 7 cards available: their own 2 face-down cards (their{" "}
            <em>hole cards</em>) plus the 5 shared face-up cards on the table.
            You pick the best 5 of those 7.
          </p>
          <Example>
            <p>
              Your hole cards: <Hand>A♥ K♥</Hand>
            </p>
            <p>
              The five shared cards on the table: <Hand>A♠ K♣ 7♦ 4♣ 2♥</Hand>
            </p>
            <p>
              Out of those 7 cards, you pick the best 5: the two aces, the two
              kings, and the 7. That's <strong>two pair, aces and kings</strong>
              . The 4 and the 2 are ignored.
            </p>
          </Example>
        </Section>

        <Section title="Who deals; the button">
          <p>
            Someone shuffles and deals each hand. A small puck on the table (the{" "}
            <em>dealer button</em>) marks who is "the dealer" for that hand —
            for accounting, that is. Even if one designated person is physically
            dealing all the cards, the button still moves: it shifts one seat
            clockwise after every hand. The button decides where the forced bets
            and the action start.
          </p>
        </Section>

        <Section title="Forced bets — the blinds">
          <p>
            Before any cards are dealt, the two players directly clockwise from
            the dealer button are required to put in money. These forced bets
            are called the <em>small blind</em> and the <em>big blind</em>{" "}
            (often shortened to <em>SB</em> and <em>BB</em>). The big blind is
            double the small blind. The blinds give every player a reason to
            play a hand instead of just folding until they're dealt premium
            cards.
          </p>
          <BlindsDiagram />
        </Section>

        <Section title="The deal">
          <p>
            Each player is dealt 2 cards face-down — their hole cards. Only the
            player who got them sees them.
          </p>
        </Section>

        <Section title="The four rounds of betting (the streets)">
          <p>
            A hand has four betting rounds, each named after the cards being
            revealed. Players take turns clockwise; on every turn you can fold,
            check, call, bet, or raise (more on those below).
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Pre-flop.</strong> Before any shared cards are revealed.
              Action starts with the player to the left of the big blind
              (sometimes called <em>under the gun</em> or <em>UTG</em>). Each
              player can fold, call (match the big blind), or raise.
            </li>
            <li>
              <strong>The flop.</strong> Three shared cards (the{" "}
              <em>community cards</em>) are dealt face-up in the middle of the
              table. A new betting round begins. From the flop onward, action
              starts with the first remaining player to the dealer's left.
            </li>
            <li>
              <strong>The turn.</strong> A 4th community card is dealt. Another
              betting round.
            </li>
            <li>
              <strong>The river.</strong> A 5th and final community card is
              dealt. Final betting round.
            </li>
          </ul>
          <p>
            Visually, the four rounds look like this — each player keeps their
            two face-down hole cards throughout, and the shared community cards
            in the middle grow by one (or three) each round:
          </p>
          <StreetsDiagram />
          <Example>
            <p>
              Pre-flop, you check your hole cards (<Hand>A♥ K♥</Hand>) and call
              the big blind. The flop comes <Hand>A♠ 7♦ 4♣</Hand> — you bet,
              opponent calls. The turn is <Hand>K♣</Hand> — you bet, opponent
              calls. The river is <Hand>2♥</Hand> — you bet, and opponent folds.
              You win the pot without showing your hand.
            </p>
          </Example>
        </Section>

        <Section title="Burn cards">
          <p>
            Before each round of community cards (the flop, the turn, and the
            river), the dealer takes the top card off the deck and sets it aside
            face-down without showing anyone. That set-aside card is called a{" "}
            <em>burn card</em>. It's a tradition meant to thwart any player who
            might have caught a glimpse of the back of the next card. So the
            actual sequence is: <strong>burn 1, deal 3</strong> for the flop,
            then <strong>burn 1, deal 1</strong> for the turn, then{" "}
            <strong>burn 1, deal 1</strong> for the river. Three burn cards
            total per hand. They're never used.
          </p>
        </Section>

        <Section title="What you can do on your turn — the betting actions">
          <p>When the action gets to you, here are your options:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Fold</strong> — give up your cards and exit the hand. You
              lose anything you've already put in. You stop being part of this
              hand.
            </li>
            <li>
              <strong>Check</strong> — pass without putting any chips in. You
              only have this option when nobody has put a bet in front of you
              yet this round.
            </li>
            <li>
              <strong>Call</strong> — match the current bet to stay in the hand.
            </li>
            <li>
              <strong>Bet</strong> — be the first this round to put chips in.
              (You can only "bet" if no one has put any in yet this round.)
            </li>
            <li>
              <strong>Raise</strong> — increase a bet that's already there.
            </li>
            <li>
              <strong>All-in</strong> — push every chip you have. Always
              available; covered separately below.
            </li>
          </ul>
        </Section>

        <Section title="How big can you bet? (No-limit)">
          <p>
            "No-limit" means there's no cap on bet size other than the chips in
            front of you. You can bet 1 chip, the size of the pot, or everything
            you have, on any betting round.
          </p>
        </Section>

        <Section title="The minimum bet and minimum raise">
          <p>
            Two related rules govern how big your wager has to be when you put
            chips in.
          </p>
          <p>
            <strong>Minimum bet.</strong> When you're the first player this
            round to put chips in (you're <em>betting</em>, not raising), the
            bet has to be at least the size of the big blind. Anything smaller
            isn't allowed.
          </p>
          <p>
            <strong>Minimum raise.</strong> When there's already a bet in front
            of you and you want to increase it, your raise has to be{" "}
            <em>at least</em> as large as the most recent bet or raise on this
            round. Pre-flop, the first raise has to be at least double the big
            blind (because the big blind is the "bet" everyone else is calling).
          </p>
          <Example>
            <p>
              The big blind is <strong>$2</strong>.
            </p>
            <p>
              <strong>Minimum bet, post-flop.</strong> The flop has been dealt;
              everyone has checked to you. If you want to bet, the smallest
              legal bet is <strong>$2</strong> (one big blind). You can always
              go higher — $5, $20, all-in — but you can't bet $1.
            </p>
            <p>
              <strong>Minimum raise, pre-flop.</strong> The first player to act
              raises the bet from $2 up to <strong>$6</strong> — a $4 raise.
            </p>
            <p>
              You want to re-raise. The most recent raise was $4, so your raise
              has to be at least $4 on top of the current $6 bet — meaning the
              new total has to be at least <strong>$10</strong>. You can raise
              to $10, $20, $50, or any amount up to your stack (all-in). What
              you <em>can't</em> do is raise to, say, $7 or $9 — that's smaller
              than the previous raise and not legal.
            </p>
          </Example>
        </Section>

        <Section title="All-in and side pots">
          <p>
            When you bet all your chips, you're "all-in". You can still win the
            part of the pot you put chips into, but if other players have more
            chips than you and keep betting beyond your stack, that extra money
            goes into a separate <em>side pot</em> you're not eligible to win.
          </p>
          <Example>
            <p>
              Three players are all-in. Player A has <strong>$50</strong>,
              player B has <strong>$100</strong>, player C has{" "}
              <strong>$200</strong>.
            </p>
            <p>
              The first $50 from each player ($150 total) goes into the{" "}
              <strong>main pot</strong>. A can win this. The next $50 from B and
              C ($100 total) goes into <strong>side pot 1</strong>. Only B and C
              can win this — A is already capped out. C's last $100 has nothing
              to call (since B is out of chips), so it's returned to C uncalled.
            </p>
          </Example>
        </Section>

        <Section title="Showdown — who wins">
          <p>
            If two or more players are still in after the river's betting round,
            they show their cards. The last player who put in a bet or raise on
            the river (the <em>aggressor</em>) shows first; if everyone checked
            the river, the first remaining player to the dealer's left shows
            first. Best 5-card hand wins.
          </p>
          <Example>
            <p>
              On the river, you bet <strong>$20</strong>, opponent calls. You
              show first because you were the last aggressor: <Hand>A♥ K♥</Hand>{" "}
              giving you two pair, aces and kings. Opponent shows{" "}
              <Hand>8♠ 8♣</Hand> giving them three eights ("three of a kind").
              Three of a kind beats two pair — opponent wins.
            </p>
          </Example>
        </Section>

        <Section title="Buying in">
          <p>
            When you sit down at the table, you exchange cash for chips — that's
            your <em>buy-in</em>. There's no fixed minimum or maximum at this
            table; players agree on a sensible buy-in on the spot. (A common
            starter for a casual cash game is around 50× the big blind, but it's
            flexible.) You can re-buy or top off your stack whenever you'd like.
          </p>
        </Section>

        <Section title="Joining the table mid-game">
          <p>
            If you arrive after a hand has started, you wait for that hand to
            finish. Then you have two choices: pay an amount equal to the big
            blind to start receiving cards on the very next hand, or wait until
            the big-blind position rotates around to your seat (then you're
            dealt in for free starting that hand).
          </p>
          <Example>
            <p>
              You sit down. The hand in progress finishes. The big blind is
              currently seat 3, and you take seat 6. If the big blind is{" "}
              <strong>$2</strong>, you have two options:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                Pay $2 right now and play the next hand (sometimes called
                "posting").
              </li>
              <li>
                Sit out 3 hands until the big blind rotates to your seat 6, then
                play normally.
              </li>
            </ul>
          </Example>
        </Section>
      </div>
    </HelpModal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Example({ children }: { children: ReactNode }) {
  return (
    <details className="my-2 rounded-md border border-border bg-muted/40">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2.5 text-sm font-medium text-foreground/85 select-none">
        Show me an example
      </summary>
      <div className="space-y-2 px-3 pb-3 text-foreground/90">{children}</div>
    </details>
  );
}

function Hand({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.95em] tabular-nums">{children}</span>
  );
}

function BlindsDiagram() {
  const cx = 120;
  const cy = 110;
  const r = 70;
  const arrowR = r + 24; // outside the seat circles (radius 14) so it doesn't occlude
  const seats = Array.from({ length: 6 }, (_, i) => {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    let label: string | null = null;
    if (i === 0) label = "D";
    else if (i === 1) label = "SB";
    else if (i === 2) label = "BB";
    return { x, y, label };
  });

  return (
    <figure className="my-3 flex flex-col items-center">
      <svg
        viewBox="0 0 240 230"
        width="240"
        height="230"
        role="img"
        aria-labelledby="blinds-diagram-title"
        className="text-foreground"
      >
        <title id="blinds-diagram-title">
          Dealer, small blind, and big blind seating around a six-seat table
        </title>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1.5}
        />
        <path
          d={`M ${cx + arrowR} ${cy} A ${arrowR} ${arrowR} 0 0 1 ${cx} ${cy + arrowR}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1.25}
        />
        <polygon
          points={`${cx - 4},${cy + arrowR - 2} ${cx + 4},${cy + arrowR - 2} ${cx},${cy + arrowR + 6}`}
          fill="currentColor"
          fillOpacity={0.45}
        />
        {seats.map((seat) => (
          <g
            key={seat.label ?? `seat-${seat.x.toFixed(1)}-${seat.y.toFixed(1)}`}
          >
            <circle
              cx={seat.x}
              cy={seat.y}
              r={14}
              fill={seat.label ? "var(--accent)" : "var(--muted)"}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
            {seat.label && (
              <text
                x={seat.x}
                y={seat.y + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="currentColor"
              >
                {seat.label}
              </text>
            )}
          </g>
        ))}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.55}
        >
          action moves clockwise
        </text>
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        D = dealer button. SB = small blind. BB = big blind.
      </figcaption>
    </figure>
  );
}

type Suit = "spades" | "hearts" | "diamonds" | "clubs";

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: "#1a1a1a",
  hearts: "#c4263a",
  diamonds: "#c4263a",
  clubs: "#1a1a1a",
};

const SUIT_NAMES: Record<Suit, string> = {
  spades: "spades",
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
};

function MiniCard({ rank, suit }: { rank: string; suit: Suit }) {
  const color = SUIT_COLORS[suit];
  const symbol = SUIT_SYMBOLS[suit];
  return (
    <svg
      viewBox="0 0 24 34"
      width="22"
      height="32"
      role="img"
      className="shrink-0"
    >
      <title>{`${rank} of ${SUIT_NAMES[suit]}`}</title>
      <rect
        width="24"
        height="34"
        rx="3"
        ry="3"
        fill="white"
        stroke="#9ca3af"
        strokeWidth="0.75"
      />
      <text
        x="3"
        y="11"
        fontSize="10"
        fontWeight="700"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {rank}
      </text>
      <text
        x="12"
        y="22"
        textAnchor="middle"
        fontSize="10"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {symbol}
      </text>
    </svg>
  );
}

function CardBack() {
  return (
    <svg
      viewBox="0 0 24 34"
      width="22"
      height="32"
      role="img"
      className="shrink-0"
    >
      <title>Face-down card</title>
      <rect
        width="24"
        height="34"
        rx="3"
        ry="3"
        fill="#1f3a52"
        stroke="#0f1f2e"
        strokeWidth="0.75"
      />
      {/* Diagonal hatching to suggest a card-back pattern. */}
      <path
        d="M 0 8 L 24 0 M 0 16 L 24 8 M 0 24 L 24 16 M 0 32 L 24 24"
        stroke="#6082a3"
        strokeWidth="0.6"
      />
    </svg>
  );
}

type Card = { rank: string; suit: Suit };

function StreetsDiagram() {
  // The shared cards used here mirror the worked example a few paragraphs
  // earlier in the streets section, so the visual "tells the same story" the
  // example does.
  const flop: Card[] = [
    { rank: "A", suit: "spades" },
    { rank: "7", suit: "diamonds" },
    { rank: "4", suit: "clubs" },
  ];
  const turn: Card = { rank: "K", suit: "clubs" };
  const river: Card = { rank: "2", suit: "hearts" };

  const rounds: { name: string; community: Card[] }[] = [
    { name: "Pre-flop", community: [] },
    { name: "Flop", community: flop },
    { name: "Turn", community: [...flop, turn] },
    { name: "River", community: [...flop, turn, river] },
  ];

  return (
    <figure className="my-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-3 text-xs">
        {rounds.map((round) => (
          <div
            key={round.name}
            className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="font-medium text-foreground sm:w-16 sm:shrink-0">
              {round.name}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-muted-foreground">
              <span className="flex shrink-0 items-center gap-2">
                <span className="flex shrink-0 items-center gap-0.5">
                  <CardBack />
                  <CardBack />
                </span>
                <span className="shrink-0">+</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <CardBack />
                  <CardBack />
                </span>
                <span className="shrink-0 text-base">…</span>
              </span>
              <span className="shrink-0">|</span>
              <span className="flex flex-wrap items-center gap-0.5">
                {round.community.length === 0 ? (
                  <span className="italic">no community cards yet</span>
                ) : (
                  round.community.map((c) => (
                    <MiniCard
                      key={`${c.rank}-${c.suit}`}
                      rank={c.rank}
                      suit={c.suit}
                    />
                  ))
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Each row shows two players' face-down hole cards (the "…" stands in for
        any other players), separated from the community cards in the middle of
        the table. Hole cards stay the same all four rounds; community cards
        accumulate.
      </figcaption>
    </figure>
  );
}

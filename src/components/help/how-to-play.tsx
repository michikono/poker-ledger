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

        <Section title="How big can you bet? (No-limit.)">
          <p>
            "No-limit" means there's no cap on bet size other than the chips in
            front of you. You can bet 1 chip, the size of the pot, or everything
            you have, on any betting round.
          </p>
        </Section>

        <Section title="The minimum raise">
          <p>
            A raise has to be <em>at least</em> the size of the most recent bet
            or raise. Pre-flop, the first raise has to be at least double the
            big blind.
          </p>
          <Example>
            <p>
              The big blind is <strong>$2</strong>. The first player to act
              raises to <strong>$6</strong> — that's a raise of $4 over the BB.
              The next person who wants to re-raise must add at least $4 more on
              top of the $6 — so they can raise to <strong>$10</strong> or
              higher (or go all-in for whatever they have).
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
    <details className="my-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground/85 select-none">
        Show me an example
      </summary>
      <div className="mt-2 space-y-2 text-foreground/90">{children}</div>
    </details>
  );
}

function Hand({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.95em] tabular-nums">{children}</span>
  );
}

function BlindsDiagram() {
  const cx = 110;
  const cy = 100;
  const r = 70;
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
        viewBox="0 0 220 200"
        width="220"
        height="200"
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
          d={`M ${cx + r + 12} ${cy} A ${r + 12} ${r + 12} 0 0 1 ${cx} ${cy + r + 12}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth={1.25}
        />
        <polygon
          points={`${cx - 4},${cy + r + 10} ${cx + 4},${cy + r + 10} ${cx},${cy + r + 16}`}
          fill="currentColor"
          fillOpacity={0.4}
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

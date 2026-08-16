import { parseAuctionCall } from "./bidding";
import { bidValue } from "./bidding";
import { cardRank, cardSuit, rankIndex } from "./cards";
import { partnershipOf } from "./seats";
import { trickWinner, type TrickPlay } from "./trick";
import type { AuctionEntry } from "./bidding";
import type { Card, Partnership, Seat, Strain, Suit } from "./types";

const HCP: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };

const SUIT_PRIORITY: Suit[] = ["S", "H", "D", "C"];

/** High-card points: A=4, K=3, Q=2, J=1. */
export function hcp(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + (HCP[cardRank(c)] ?? 0), 0);
}

function suitLengths(hand: Card[]): Record<Suit, number> {
  const out: Record<Suit, number> = { C: 0, D: 0, H: 0, S: 0 };
  for (const c of hand) out[cardSuit(c)]++;
  return out;
}

/** Deterministic best suit: most cards, ties broken S > H > D > C. */
export function longestSuit(hand: Card[]): Suit {
  const len = suitLengths(hand);
  return SUIT_PRIORITY.reduce(
    (best, s) => (len[s] > len[best] ? s : best),
    "C",
  );
}

function callString(level: number, strain: Strain): string {
  return `${level}${strain}`;
}

function lastBidFor(
  entries: AuctionEntry[],
  side: Partnership,
): { level: number; strain: Strain } | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const call = parseAuctionCall(entries[i]!.call);
    if (call.kind === "bid" && entries[i]!.side === side) {
      return { level: call.level, strain: call.strain };
    }
  }
  return null;
}

/** How many bids this side has already made in the auction. */
function mySideBids(entries: AuctionEntry[], side: Partnership): number {
  return entries.filter(
    (e) => e.side === side && parseAuctionCall(e.call).kind === "bid",
  ).length;
}

/** Smallest legal level whose bid value outranks `minBidValue`, or null. */
function lowestLegalLevel(
  minBidValue: number | null,
  strain: Strain,
): number | null {
  const min = minBidValue ?? 1;
  for (let level = 1; level <= 7; level++) {
    if (bidValue(level, strain) >= min) return level;
  }
  return null;
}

export type BotBidArgs = {
  hand: Card[];
  entries: AuctionEntry[];
  side: Partnership;
  canBid: boolean;
  minBidValue: number | null;
};

/**
 * Deterministic bidding: raise a partner's suit on a fit, overcall with
 * strength, open with 13+ HCP. Never doubles. Plays for this side's interest.
 */
export function chooseBid({
  hand,
  entries,
  side,
  canBid,
  minBidValue,
}: BotBidArgs): string {
  const points = hcp(hand);
  // cap each side at two bids so partners can't chain-raise to 7NT.
  if (mySideBids(entries, side) >= 2) return "P";
  const myLast = lastBidFor(entries, side);
  const oppLast = lastBidFor(entries, side === "NS" ? "EW" : "NS");

  // Raise partner's suit when holding a fit.
  if (myLast && canBid) {
    if (myLast.strain !== "NT") {
      const fit = suitLengths(hand)[myLast.strain];
      const raise = bidValue(myLast.level + 1, myLast.strain);
      if (
        fit >= 3 &&
        points >= 6 &&
        (minBidValue === null || raise >= minBidValue)
      ) {
        return callString(myLast.level + 1, myLast.strain);
      }
    }
    return "P";
  }

  // Overcall the opponents.
  if (oppLast && canBid) {
    const strain = longestSuit(hand);
    const level = lowestLegalLevel(minBidValue, strain);
    if (points >= 13 && level !== null) return callString(level, strain);
    return "P";
  }

  // Opening.
  if (!canBid) return "P";
  if (points >= 21) return "3NT";
  const longest = longestSuit(hand);
  if (suitLengths(hand)[longest] <= 4 && points >= 15) return "1NT";
  if (points >= 13) return callString(1, longest);
  return "P";
}

function lowestCard(cards: Card[]): Card {
  return cards.reduce(
    (best, c) =>
      rankIndex(cardRank(c)) < rankIndex(cardRank(best)) ? c : best,
    cards[0]!,
  );
}

/** Highest card of the longest suit (partner-friendly opening lead). */
function leadCard(legal: Card[]): Card {
  const len = suitLengths(legal);
  const suit = SUIT_PRIORITY.reduce(
    (best, s) => (len[s] > len[best] ? s : best),
    "C",
  );
  const cards = legal.filter((c) => cardSuit(c) === suit);
  return cards.reduce(
    (best, c) =>
      rankIndex(cardRank(c)) > rankIndex(cardRank(best)) ? c : best,
    cards[0]!,
  );
}

export type BotPlayArgs = {
  legal: Card[];
  trick: TrickPlay[];
  mySeat: Seat;
  trump: Strain | null;
  side: Partnership;
};

/** Cheapest card that wins the trick for this side, or the lowest follow. */
function lowestCardThatWins(
  legal: Card[],
  trick: TrickPlay[],
  mySeat: Seat,
  trump: Suit | null,
  side: Partnership,
): Card | null {
  let best: Card | null = null;
  for (const c of legal) {
    const winner = trickWinner([...trick, { card: c, seat: mySeat }], trump);
    if (partnershipOf(winner) !== side) continue;
    if (!best || rankIndex(cardRank(c)) < rankIndex(cardRank(best))) best = c;
  }
  return best;
}

/**
 * Deterministic play: when following, win the trick with the cheapest card or
 * duck with the lowest; when leading, top of the longest suit.
 */
export function choosePlay({
  legal,
  trick,
  mySeat,
  trump,
  side,
}: BotPlayArgs): Card {
  if (trick.length === 0) return leadCard(legal);
  const strain: Suit | null = trump === "NT" ? null : trump;
  return (
    lowestCardThatWins(legal, trick, mySeat, strain, side) ?? lowestCard(legal)
  );
}

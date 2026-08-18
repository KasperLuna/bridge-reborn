import { cardRank, cardSuit, rankIndex } from "./cards";
import { rotateFrom } from "./seats";
import type { Card, Direction, Seat, Strain, Suit } from "./types";

export type TrickPlay = { card: Card; seat: Seat };

/** Trump = contract strain, null when NT. Winner per SPEC §7.4. Downtown
    ("low") inverts the rank comparison: the lowest card of the led suit (or
    lowest trump) wins. Trump always beats the led suit in both directions. */
export function trickWinner(
  plays: TrickPlay[],
  strain: Strain | null,
  direction: Direction = "high",
): Seat {
  const trump: Suit | null = strain === null || strain === "NT" ? null : strain;
  const ledSuit = cardSuit(plays[0]!.card);
  let best = plays[0]!;

  for (const play of plays.slice(1)) {
    if (beats(play, best, trump, ledSuit, direction)) best = play;
  }
  return best.seat;
}

function beats(
  candidate: TrickPlay,
  current: TrickPlay,
  trump: Suit | null,
  ledSuit: Suit,
  direction: Direction,
): boolean {
  const cSuit = cardSuit(candidate.card);
  const curSuit = cardSuit(current.card);
  const cTrump = cSuit === trump;
  const curTrump = curSuit === trump;

  if (cTrump !== curTrump) return cTrump;
  const cFollows = cSuit === ledSuit;
  const curFollows = curSuit === ledSuit;
  if (cFollows !== curFollows) return cFollows;
  const cRank = rankIndex(cardRank(candidate.card));
  const curRank = rankIndex(cardRank(current.card));
  return direction === "high" ? cRank > curRank : cRank < curRank;
}

/**
 * Cards the player may legally play. When not leading and following suit
 * is enforced, only cards of the led suit are legal if held.
 */
export function legalPlays(
  hand: Card[],
  ledSuit: Suit | null,
  mustFollowSuit: boolean,
): Card[] {
  if (!mustFollowSuit || ledSuit === null) return hand;
  const follow = hand.filter((c) => cardSuit(c) === ledSuit);
  return follow.length > 0 ? follow : hand;
}

/** Seat whose turn it is, given the leader and how many plays exist in the trick. */
export function nextPlayerToPlay(leader: Seat, playCount: number): Seat {
  return rotateFrom(leader, playCount);
}

export type HandEndArgs = {
  endHandEarly: boolean;
  tricksPlayed: number;
  tricksRequired: number;
  declarerTricks: number;
};

/** SPEC §7.5 — bridge plays all 13; bid whist stops when outcome is decided.
    Downtown flips card ranking only (low cards win), never the trick target:
    the bid number is books above six in both directions. */
export function isHandOver(args: HandEndArgs): boolean {
  if (!args.endHandEarly) return args.tricksPlayed >= 13;
  const defenseTricks = args.tricksPlayed - args.declarerTricks;
  return (
    args.declarerTricks >= args.tricksRequired ||
    defenseTricks >= 13 - args.tricksRequired + 1
  );
}

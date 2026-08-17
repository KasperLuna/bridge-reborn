import type { AuctionEntry } from "@/lib/game/bidding";
import { legalCalls, resolveOpener } from "@/lib/game/bidding";
import { cardSuit, sortHand } from "@/lib/game/cards";
import { legalPlays, nextPlayerToPlay } from "@/lib/game/trick";
import type { Card, GamePlayers, Seat, Suit } from "@/lib/game/types";
import {
  leftOf,
  partnershipOf,
  playersFromUsernames,
  rotateFrom,
  seatOfUsername,
} from "@/lib/game/seats";
import type { Ruleset } from "@/lib/rulesets";
import type {
  BidRecord,
  ContractRecord,
  Hand,
  PlayRecord,
  RoomSeat,
  TrickRecord,
} from "@/lib/types";

export const players = playersFromUsernames;

export function auctionEntries(bids: BidRecord[], hand: Hand): AuctionEntry[] {
  const p = players(hand);
  return bids.map((b) => {
    const seat = seatOfUsername(p, b.username);
    return {
      call: b.call,
      username: b.username,
      side: seat ? partnershipOf(seat) : ("NS" as const),
    };
  });
}

export function myCards(hand: Hand, seat: Seat): Card[] {
  return sortHand(hand.deal[seat] ?? []);
}

export function currentTrick(tricks: TrickRecord[]): TrickRecord | null {
  const sorted = [...tricks].sort((a, b) => a.trick_number - b.trick_number);
  const last = sorted.at(-1);
  return last && !last.winner_username ? last : null;
}

export function trickPlaysFor(
  trickId: string,
  plays: PlayRecord[],
): PlayRecord[] {
  return plays
    .filter((p) => p.trick_id === trickId)
    .sort((a, b) => a.play_sequence - b.play_sequence);
}

/** Cards I'm currently allowed to play. */
export function legalCardsForMe(
  hand: Hand,
  seat: Seat,
  username: string,
  plays: PlayRecord[],
  tricks: TrickRecord[],
  ruleset: Ruleset,
): Card[] {
  const held = hand.deal[seat] ?? [];
  const playedByMe = new Set(
    plays.filter((p) => p.username === username).map((p) => p.card),
  );
  const remaining = held.filter((c) => !playedByMe.has(c));

  const trick = currentTrick(tricks);
  if (!trick) return sortHand(remaining);
  const inTrick = trickPlaysFor(trick.id, plays);
  const ledSuit: Suit | null = inTrick[0] ? cardSuit(inTrick[0].card) : null;
  return sortHand(legalPlays(remaining, ledSuit, ruleset.play.mustFollowSuit));
}

/** Seat whose turn it is to bid, or null before the hand is known. */
export function bidTurnSeat(
  bids: BidRecord[],
  hand: Hand,
  ruleset: Ruleset,
): Seat | null {
  const opener = resolveOpener(ruleset.openerRule, hand.deal, "N");
  if (!opener) return null;
  return rotateFrom(opener, bids.length);
}

export function playTurnSeat(
  tricks: TrickRecord[],
  plays: PlayRecord[],
  p: GamePlayers,
  declarerSeat: Seat | null,
): Seat | null {
  const trick = currentTrick(tricks);
  if (trick) {
    const leader =
      (trick.leader_seat as Seat | undefined) ??
      seatOfUsername(p, trick.leader_username);
    if (!leader) return null;
    return nextPlayerToPlay(leader, trickPlaysFor(trick.id, plays).length);
  }
  // No open trick: next trick is led by the winner of the last completed
  // trick, or (for the very first trick) by declarer's left-hand opponent.
  const lastWon = [...tricks]
    .filter((t) => t.winner_username)
    .sort((a, b) => b.trick_number - a.trick_number)[0];
  if (lastWon) {
    return (
      (lastWon.winner_seat as Seat | undefined) ??
      seatOfUsername(p, lastWon.winner_username)
    );
  }
  return declarerSeat ? leftOf(declarerSeat) : null;
}

export function legalBidsForMe(
  bids: BidRecord[],
  hand: Hand,
  ruleset: Ruleset,
  seat: Seat,
) {
  const entries = auctionEntries(bids, hand);
  const myTurn = bidTurnSeat(bids, hand, ruleset) === seat;
  const actorSide = partnershipOf(seat);
  const legal = legalCalls(entries, actorSide, ruleset.bidding);
  return { myTurn, ...legal };
}

export function contractShorthand(contract: ContractRecord | null): string {
  if (!contract) return "";
  const suffix = contract.redoubled ? "XX" : contract.doubled ? "X" : "";
  return `${contract.level}${contract.strain}${suffix}`;
}

export const seatedPlayers = (seats: RoomSeat[]) =>
  seats.filter((s) => !s.is_spectator && s.seat);

export const allFourReady = (seats: RoomSeat[]) => {
  const seated = seatedPlayers(seats);
  return seated.length === 4 && seated.every((s) => s.ready);
};

export const seatAt = (seats: RoomSeat[], seat: Seat) =>
  seats.find((s) => s.seat === seat && !s.is_spectator) ?? null;

export const spectators = (seats: RoomSeat[]) =>
  seats.filter((s) => s.is_spectator);

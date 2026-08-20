import type { Seat } from "@/lib/game/types";
import type { BidRecord, PlayRecord, TrickRecord } from "@/lib/types";

export type ReplayEvent = {
  kind: "bid" | "play";
  handNumber: number;
  label: string;
  username: string;
  seat: Seat | null;
};

const SUIT_GLYPH: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

/** "1S" → "1♠"; "L2S" → "L2♠"; passes and doubles stay as-is. */
function bidLabel(call: string): string {
  if (call === "P" || call === "X" || call === "XX") return call;
  const low = call.startsWith("L");
  const body = low ? call.slice(1) : call;
  const strain = body.slice(1);
  return strain === "NT"
    ? call
    : `${low ? "L" : ""}${body[0]}${SUIT_GLYPH[strain] ?? strain}`;
}

/** "AS" → "♠A" (suit glyph first, rank last). */
function playLabel(card: string): string {
  const rank = card[0] === "T" ? "10" : card[0];
  return `${SUIT_GLYPH[card[1]!] ?? card[1]!}${rank}`;
}

const byPos = (
  a: { sequence_position: number },
  b: { sequence_position: number },
) => a.sequence_position - b.sequence_position;

// play_sequence is a per-TRICK counter (1..4), so chronological order needs
// the play's trick_number first, then its sequence inside the trick.
export function orderedPlays(
  plays: PlayRecord[],
  tricks: TrickRecord[],
): PlayRecord[] {
  const trickNumber = new Map(tricks.map((t) => [t.id, t.trick_number]));
  return [...plays].sort(
    (a, b) =>
      (trickNumber.get(a.trick_id) ?? Infinity) -
        (trickNumber.get(b.trick_id) ?? Infinity) ||
      a.play_sequence - b.play_sequence,
  );
}

/**
 * One hand's chronological event list: every bid in order, then every play
 * trick by trick. `seatOf` resolves a bidder's seat (plays carry theirs).
 */
export function buildHandEvents(
  bids: BidRecord[],
  plays: PlayRecord[],
  tricks: TrickRecord[],
  handNumber: number,
  seatOf?: (username: string) => Seat | null,
): ReplayEvent[] {
  const bidEvents = [...bids].sort(byPos).map((b) => ({
    kind: "bid" as const,
    handNumber,
    label: bidLabel(b.call),
    username: b.username,
    seat: seatOf ? (seatOf(b.username) ?? null) : null,
  }));
  const playEvents = orderedPlays(plays, tricks).map((p) => ({
    kind: "play" as const,
    handNumber,
    label: playLabel(p.card),
    username: p.username,
    seat: p.seat,
  }));
  return [...bidEvents, ...playEvents];
}

/** Global event index → per-list slice counts (all bids precede all plays). */
export function indexToSlice(index: number, bidsLength: number) {
  const i = Math.max(0, index);
  return {
    bidSlice: Math.min(i, bidsLength),
    playSlice: Math.max(0, i - bidsLength),
  };
}

/** Records truncated so the first `index` events of the hand are included. */
export function sliceTo(bids: BidRecord[], plays: PlayRecord[], index: number) {
  const { bidSlice, playSlice } = indexToSlice(index, bids.length);
  return { bids: bids.slice(0, bidSlice), plays: plays.slice(0, playSlice) };
}

export function countEvents(bids: BidRecord[], plays: PlayRecord[]): number {
  return bids.length + plays.length;
}

/**
 * Tricks whose four plays are all present in the (truncated) plays list. The
 * in-progress trick is left out; the caller re-adds it as the open trick.
 */
export function visibleTricks(
  tricks: TrickRecord[],
  plays: PlayRecord[],
): TrickRecord[] {
  const countByTrick = new Map<string, number>();
  for (const pl of plays) {
    countByTrick.set(pl.trick_id, (countByTrick.get(pl.trick_id) ?? 0) + 1);
  }
  return tricks.filter((t) => (countByTrick.get(t.id) ?? 0) >= 4);
}

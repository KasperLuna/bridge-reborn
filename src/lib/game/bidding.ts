import type {
  Call,
  Contract,
  Deal,
  OpenerRule,
  Partnership,
  Seat,
  Strain,
} from "./types";
import { nextSeat, rotateFrom } from "./seats";

export type AuctionEntry = {
  call: string;
  username: string;
  side: Partnership;
};

export type LegalCalls = {
  canPass: boolean;
  canBid: boolean;
  minBidValue: number | null;
  canDouble: boolean;
  canRedouble: boolean;
};

const STRAIN_RANK: Record<Strain, number> = { C: 1, D: 2, H: 3, S: 4, NT: 5 };

export const MAX_BID_VALUE = 7 * 10 + STRAIN_RANK.NT; // 7NT = 75

export function bidValue(level: number, strain: Strain): number {
  return level * 10 + STRAIN_RANK[strain];
}

export function parseAuctionCall(call: string): Call {
  if (call === "P") return { kind: "pass" };
  if (call === "X") return { kind: "double" };
  if (call === "XX") return { kind: "redouble" };
  const m = /^([1-7])(NT|[CDHS])$/.exec(call);
  if (!m) throw new Error(`Unknown call: ${call}`);
  return { kind: "bid", level: Number(m[1]), strain: m[2] as Strain };
}

/** Who opens the auction, per ruleset opener rule. */
export function resolveOpener(
  openerRule: OpenerRule,
  deal: Deal,
  dealer: Seat,
): Seat | null {
  switch (openerRule) {
    case "twoClubHolder": {
      const seats: Seat[] = ["N", "E", "S", "W"];
      for (const seat of seats) {
        if (deal[seat].includes("2C")) return seat;
      }
      return null;
    }
    case "dealer":
      return dealer;
    case "leftOfDealer":
      return nextSeat(dealer);
  }
}

/** Last contract bid in the auction, with its 1-based index in `entries`. */
export function lastBid(entries: AuctionEntry[]): {
  entry: AuctionEntry;
  index: number;
  value: number;
} | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const call = parseAuctionCall(entries[i]!.call);
    if (call.kind === "bid") {
      return {
        entry: entries[i]!,
        index: i,
        value: bidValue(call.level, call.strain),
      };
    }
  }
  return null;
}

export function legalCalls(
  entries: AuctionEntry[],
  actor: Partnership,
  cfg: { doubleAllowed: boolean; redoubleAllowed: boolean },
): LegalCalls {
  const last = lastBid(entries);
  const lastEntry = entries.at(-1);

  const canPass = true;
  const minBidValue = last ? last.value + 1 : null;
  const canBid = minBidValue === null || minBidValue <= MAX_BID_VALUE;

  // Double: opponent of last bidder, and not yet doubled/redoubled since that bid.
  let canDouble = false;
  if (cfg.doubleAllowed && last && last.entry.side !== actor) {
    const since = entries.slice(last.index + 1);
    canDouble = !since.some((e) => e.call === "X" || e.call === "XX");
  }

  // Redouble: immediately after an opponent's double.
  let canRedouble = false;
  if (
    cfg.redoubleAllowed &&
    lastEntry?.call === "X" &&
    lastEntry.side !== actor
  ) {
    canRedouble = true;
  }

  return { canPass, canBid, minBidValue, canDouble, canRedouble };
}

/** Auction ends on 3 passes after a bid, or 4 passes with no bid (passed out). */
export function isAuctionComplete(entries: AuctionEntry[]): boolean {
  if (entries.length === 0) return false;
  const hasBid = entries.some((e) => parseAuctionCall(e.call).kind === "bid");
  const trailingPasses = entries
    .slice(-3)
    .every((e) => parseAuctionCall(e.call).kind === "pass");
  if (hasBid) return trailingPasses;
  // No bids: four passes required (passed out).
  return (
    entries.length >= 4 &&
    entries.every((e) => parseAuctionCall(e.call).kind === "pass")
  );
}

export function finalContract(entries: AuctionEntry[]): Contract | null {
  const last = lastBid(entries);
  if (!last) return null;
  const call = parseAuctionCall(last.entry.call);
  if (call.kind !== "bid") return null;
  const after = entries.slice(last.index + 1);
  return {
    level: call.level,
    strain: call.strain,
    doubled: after.some((e) => e.call === "X"),
    redoubled: after.some((e) => e.call === "XX"),
  };
}

/**
 * Declarer = first player of the winning partnership who bid the final strain.
 * `entries` must carry usernames (they do by construction).
 */
export function declarerUsername(entries: AuctionEntry[]): string | null {
  const contract = finalContract(entries);
  if (!contract) return null;
  const last = lastBid(entries)!;
  const winningSide = last.entry.side;
  for (const e of entries) {
    const call = parseAuctionCall(e.call);
    if (
      call.kind === "bid" &&
      call.strain === contract.strain &&
      e.side === winningSide
    ) {
      return e.username;
    }
  }
  return last.entry.username;
}

/**
 * Seat of the declarer. Auction rotation starts at `opener`, so entry i (0-based)
 * belongs to seat `rotateFrom(opener, i)`. Usernames alone can't pin the seat
 * in pairs mode (one username owns two seats), so derive it from rotation.
 */
export function declarerSeat(
  entries: AuctionEntry[],
  opener: Seat,
): Seat | null {
  const contract = finalContract(entries);
  if (!contract) return null;
  const last = lastBid(entries)!;
  const winningSide = last.entry.side;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const call = parseAuctionCall(e.call);
    if (
      call.kind === "bid" &&
      call.strain === contract.strain &&
      e.side === winningSide
    ) {
      return rotateFrom(opener, i);
    }
  }
  return rotateFrom(opener, last.index);
}

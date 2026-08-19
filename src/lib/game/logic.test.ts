import { describe, expect, it } from "vitest";
import type { AuctionEntry } from "./bidding";
import {
  bidValue,
  declarerUsername,
  finalContract,
  formatCall,
  isAuctionComplete,
  legalCalls,
  lastBid,
  parseAuctionCall,
  passNeed,
} from "./bidding";
import type { ScoringConfig, Vulnerability } from "./types";
import { isSideVulnerable, scoreContract } from "./scoring";
import { isHandOver, legalPlays, trickWinner, type TrickPlay } from "./trick";

const entry = (
  call: string,
  username: string,
  side: "NS" | "EW",
): AuctionEntry => ({ call, username, side });

describe("bidding", () => {
  it("parses calls", () => {
    expect(parseAuctionCall("P")).toEqual({ kind: "pass" });
    expect(parseAuctionCall("X")).toEqual({ kind: "double" });
    expect(parseAuctionCall("XX")).toEqual({ kind: "redouble" });
    expect(parseAuctionCall("1C")).toEqual({
      kind: "bid",
      level: 1,
      strain: "C",
      direction: "high",
    });
    expect(parseAuctionCall("7NT")).toEqual({
      kind: "bid",
      level: 7,
      strain: "NT",
      direction: "high",
    });
    expect(parseAuctionCall("L2S")).toEqual({
      kind: "bid",
      level: 2,
      strain: "S",
      direction: "low",
    });
  });

  it("formats calls with direction glyphs", () => {
    expect(formatCall("1C")).toBe("▲1C");
    expect(formatCall("L2S")).toBe("▼2S");
    expect(formatCall("7NT")).toBe("▲7NT");
    expect(formatCall("P")).toBe("P");
    expect(formatCall("X")).toBe("X");
    expect(formatCall("XX")).toBe("XX");
  });

  it("ranks bids by level then strain", () => {
    expect(bidValue(1, "C")).toBe(11);
    expect(bidValue(1, "NT")).toBe(15);
    expect(bidValue(2, "C")).toBe(21);
    expect(bidValue(7, "NT")).toBe(75);
    expect(bidValue(1, "S")).toBeLessThan(bidValue(1, "NT"));
    // Downtown: lower level outranks; all low bids outrank a fresh track.
    expect(bidValue(1, "C", "low")).toBe(-11);
    expect(bidValue(2, "C", "low")).toBeLessThan(bidValue(1, "C", "low"));
    expect(bidValue(7, "NT", "low")).toBeLessThan(bidValue(1, "C", "low"));
  });

  it("opens with any bid, no double before a bid", () => {
    const legal = legalCalls([], "NS", {
      doubleAllowed: true,
      redoubleAllowed: true,
    });
    expect(legal.canBid).toBe(true);
    expect(legal.minBidValue).toBeNull();
    expect(legal.canDouble).toBe(false);
    expect(legal.canRedouble).toBe(false);
  });

  it("lets opponents double, never partner", () => {
    const entries = [entry("1C", "north", "NS")];
    expect(
      legalCalls(entries, "EW", { doubleAllowed: true, redoubleAllowed: true })
        .canDouble,
    ).toBe(true);
    expect(
      legalCalls(entries, "NS", { doubleAllowed: true, redoubleAllowed: true })
        .canDouble,
    ).toBe(false);
    expect(
      legalCalls(entries, "EW", { doubleAllowed: true, redoubleAllowed: true })
        .minBidValue,
    ).toBe(12);
  });

  it("redouble only immediately after opponent double", () => {
    const entries = [entry("1C", "north", "NS"), entry("X", "east", "EW")];
    expect(
      legalCalls(entries, "NS", { doubleAllowed: true, redoubleAllowed: true })
        .canRedouble,
    ).toBe(true);
    expect(
      legalCalls(entries, "EW", { doubleAllowed: true, redoubleAllowed: true })
        .canRedouble,
    ).toBe(false);
    expect(
      legalCalls(entries, "EW", { doubleAllowed: true, redoubleAllowed: true })
        .canDouble,
    ).toBe(false);
  });

  it("ends on 3 passes after a bid, or 4 passes with none", () => {
    const pp = ["P", "P", "P"].map((c, i) => entry(c, `u${i}`, "NS"));
    expect(isAuctionComplete(pp)).toBe(false);
    const pppp = ["P", "P", "P", "P"].map((c, i) =>
      entry(c, `u${i}`, i % 2 ? "EW" : "NS"),
    );
    expect(isAuctionComplete(pppp)).toBe(true);
    expect(isAuctionComplete([entry("1C", "n", "NS"), ...pp])).toBe(true);
    expect(
      isAuctionComplete([
        entry("1C", "n", "NS"),
        entry("P", "e", "EW"),
        entry("P", "s", "NS"),
      ]),
    ).toBe(false);
  });

  it("forms the final contract and resolves declarer", () => {
    const entries = [
      entry("1H", "north", "NS"),
      entry("1S", "east", "EW"),
      entry("2H", "south", "NS"),
      entry("2S", "west", "EW"),
      entry("3H", "south", "NS"),
      entry("3S", "east", "EW"),
      entry("P", "south", "NS"),
      entry("P", "west", "EW"),
      entry("P", "north", "NS"),
    ];
    expect(finalContract(entries)).toEqual({
      level: 3,
      strain: "S",
      direction: "high",
      doubled: false,
      redoubled: false,
    });
    // First EW player to bid spades was east (1S).
    expect(declarerUsername(entries)).toBe("east");

    const doubled = [
      entry("1C", "north", "NS"),
      entry("1D", "east", "EW"),
      entry("X", "south", "NS"),
      entry("P", "west", "EW"),
      entry("P", "north", "NS"),
      entry("P", "east", "EW"),
    ];
    expect(finalContract(doubled)).toEqual({
      level: 1,
      strain: "D",
      direction: "high",
      doubled: true,
      redoubled: false,
    });
    expect(lastBid(doubled)?.value).toBe(12);
  });

  it("pass need reflects the standing contract and its owner", () => {
    const theirs = [entry("2H", "e", "EW")];
    expect(passNeed(theirs, "NS")).toEqual({ level: 2, contractIsMine: false });
    const ours = [entry("2H", "n", "NS")];
    expect(passNeed(ours, "NS")).toEqual({ level: 2, contractIsMine: true });
    expect(passNeed([], "NS")).toBeNull();
  });

  it("tracks high and low bids on independent tracks", () => {
    const entries = [entry("1C", "n", "NS"), entry("L2C", "e", "EW")];
    const legal = legalCalls(entries, "NS", {
      doubleAllowed: true,
      redoubleAllowed: true,
    });
    expect(legal.minBidValue).toBe(12);
    expect(legal.maxBidValue).toBe(-21);
    // L2NT (-25) outranks the L2C (-21); L1C (-11) does not.
    expect(bidValue(2, "NT", "low")).toBeLessThan(legal.maxBidValue!);
    expect(bidValue(1, "C", "low")).toBeGreaterThanOrEqual(legal.maxBidValue!);
  });

  it("keeps the direction in the final contract", () => {
    const entries = [
      entry("L2S", "north", "NS"),
      entry("L1D", "east", "EW"),
      entry("P", "south", "NS"),
      entry("P", "west", "EW"),
      entry("P", "north", "NS"),
    ];
    expect(finalContract(entries)).toEqual({
      level: 1,
      strain: "D",
      direction: "low",
      doubled: false,
      redoubled: false,
    });
  });
});

describe("trick", () => {
  it("picks the highest card of the led suit in no-trump", () => {
    const plays: TrickPlay[] = [
      { card: "2C", seat: "N" },
      { card: "AC", seat: "E" },
      { card: "AD", seat: "S" },
      { card: "KC", seat: "W" },
    ];
    expect(trickWinner(plays, "NT")).toBe("E");
  });

  it("lets trump beat the led suit", () => {
    const plays: TrickPlay[] = [
      { card: "2S", seat: "N" },
      { card: "AS", seat: "E" },
      { card: "3H", seat: "S" },
      { card: "KS", seat: "W" },
    ];
    expect(trickWinner(plays, "H")).toBe("S");
  });

  it("downtown: lowest card of the led suit wins", () => {
    const plays: TrickPlay[] = [
      { card: "2C", seat: "N" },
      { card: "AC", seat: "E" },
      { card: "AD", seat: "S" },
      { card: "KC", seat: "W" },
    ];
    expect(trickWinner(plays, "NT", "low")).toBe("N");
  });

  it("downtown: trump still beats the led suit", () => {
    const plays: TrickPlay[] = [
      { card: "2S", seat: "N" },
      { card: "AS", seat: "E" },
      { card: "3H", seat: "S" },
      { card: "KS", seat: "W" },
    ];
    expect(trickWinner(plays, "H", "low")).toBe("S");
  });

  it("downtown: lowest trump beats higher trump", () => {
    const plays: TrickPlay[] = [
      { card: "2H", seat: "N" },
      { card: "AH", seat: "E" },
      { card: "3H", seat: "S" },
      { card: "KH", seat: "W" },
    ];
    expect(trickWinner(plays, "H", "low")).toBe("N");
  });

  it("enforces following suit", () => {
    expect(legalPlays(["2C", "3C", "AH", "KS"], "C", true)).toEqual([
      "2C",
      "3C",
    ]);
    expect(legalPlays(["2D", "3D"], "C", true)).toEqual(["2D", "3D"]);
    expect(legalPlays(["2D", "3D"], null, true)).toEqual(["2D", "3D"]);
  });

  it("detects hand end for bridge and bid whist", () => {
    expect(
      isHandOver({
        endHandEarly: false,
        tricksPlayed: 13,
        tricksRequired: 7,
        declarerTricks: 8,
      }),
    ).toBe(true);
    expect(
      isHandOver({
        endHandEarly: false,
        tricksPlayed: 12,
        tricksRequired: 7,
        declarerTricks: 8,
      }),
    ).toBe(false);
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 10,
        tricksRequired: 7,
        declarerTricks: 7,
      }),
    ).toBe(true);
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 10,
        tricksRequired: 7,
        declarerTricks: 3,
      }),
    ).toBe(true);
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 5,
        tricksRequired: 7,
        declarerTricks: 4,
      }),
    ).toBe(false);
  });

  it("downtown shares the uptown trick target (level + 6)", () => {
    // L5S = take at least 11 books with low cards winning; a 5-bid at 5 tricks
    // is nowhere near made, and the hand only ends at 11 or when the defense
    // has 3.
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 5,
        tricksRequired: 11,
        declarerTricks: 5,
      }),
    ).toBe(false);
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 11,
        tricksRequired: 11,
        declarerTricks: 11,
      }),
    ).toBe(true);
    expect(
      isHandOver({
        endHandEarly: true,
        tricksPlayed: 5,
        tricksRequired: 11,
        declarerTricks: 2,
      }),
    ).toBe(true);
  });
});

const cfg: ScoringConfig = {
  minorTrick: 20,
  majorTrick: 30,
  ntTrick: 30,
  ntFirstTrickBonus: 10,
  partScoreBonus: 50,
  gameBonus: { vuln: 500, non: 300 },
  slamBonus: {
    small: { vuln: 750, non: 500 },
    grand: { vuln: 1500, non: 1000 },
  },
  insultBonus: { doubled: 50, redoubled: 100 },
  undertrick: {
    undoubled: { vuln: 100, non: 50 },
    doubled: { vuln: [200, 300, 300], non: [100, 200, 200] },
  },
};

const score = (
  level: number,
  strain: "C" | "D" | "H" | "S" | "NT",
  tricksMade: number,
  opts: {
    doubled?: boolean;
    redoubled?: boolean;
    vuln?: Vulnerability;
    direction?: "high" | "low";
  } = {},
) =>
  scoreContract(
    {
      level,
      strain,
      direction: opts.direction ?? "high",
      doubled: opts.doubled ?? false,
      redoubled: opts.redoubled ?? false,
    },
    tricksMade,
    "NS",
    opts.vuln ?? "none",
    cfg,
  );

describe("scoring", () => {
  it("scores partscore, game, slam", () => {
    expect(score(1, "NT", 7).declaring).toBe(90);
    expect(score(3, "NT", 9).declaring).toBe(400);
    expect(score(4, "S", 10).declaring).toBe(420);
    expect(score(6, "S", 12).declaring).toBe(980);
    expect(score(7, "NT", 13, { vuln: "both" }).declaring).toBe(2220);
  });

  it("applies vulnerability to game bonus", () => {
    expect(score(3, "NT", 9, { vuln: "ns" }).declaring).toBe(600);
  });

  it("scores doubled and redoubled undertricks", () => {
    expect(score(4, "H", 8, { doubled: true })).toEqual({
      declaring: -300,
      defending: 300,
    });
    expect(score(4, "H", 9, { redoubled: true })).toEqual({
      declaring: -200,
      defending: 200,
    });
    expect(score(4, "H", 8, { doubled: true, vuln: "ns" })).toEqual({
      declaring: -500,
      defending: 500,
    });
  });

  it("scores doubled overtricks with insult bonus", () => {
    expect(score(2, "S", 9, { doubled: true }).declaring).toBe(570);
  });

  it("resolves side vulnerability", () => {
    expect(isSideVulnerable("NS", "ns")).toBe(true);
    expect(isSideVulnerable("NS", "ew")).toBe(false);
    expect(isSideVulnerable("EW", "both")).toBe(true);
  });

  it("downtown scores identically to uptown (same trick target)", () => {
    // L5S makes at 11 tricks and is set at 10, exactly like 5S uptown.
    expect(score(2, "S", 8, { direction: "low" }).declaring).toBe(110);
    expect(score(2, "S", 2, { direction: "low" })).toEqual({
      declaring: -300,
      defending: 300,
    });
  });
});

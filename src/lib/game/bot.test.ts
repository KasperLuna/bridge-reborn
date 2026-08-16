import { describe, expect, it } from "vitest";

import { chooseBid, choosePlay, hcp, longestSuit } from "./bot";
import type { AuctionEntry } from "./bidding";
import type { Card } from "./types";

const entry = (call: string, side: "NS" | "EW"): AuctionEntry => ({
  call,
  username: side === "NS" ? "n" : "e",
  side,
});

const hand = (cards: string[]): Card[] => cards;

describe("bot hcp", () => {
  it("counts standard HCP", () => {
    expect(hcp(hand(["AS", "KH", "QD", "JC"]))).toBe(10);
    expect(hcp(hand(["2S", "3H", "4D", "5C"]))).toBe(0);
  });

  it("picks longest suit, ties broken S>H>D>C", () => {
    expect(
      longestSuit(hand(["AS", "KS", "QS", "2H", "3H", "4H", "5D", "6D"])),
    ).toBe("S");
    expect(longestSuit(hand(["2S", "3H", "4D", "5C", "6C"]))).toBe("C");
  });
});

describe("bot bidding", () => {
  it("opens the longest suit with 13+ HCP", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "JS",
        "2S",
        "3S",
        "4S",
        "AH",
        "KH",
        "2H",
        "3H",
        "4D",
        "5D",
      ]),
      entries: [],
      side: "NS",
      canBid: true,
      minBidValue: null,
    });
    expect(call).toBe("1S");
  });

  it("opens 1NT when balanced with 15+ HCP", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "2S",
        "AH",
        "KH",
        "2H",
        "3H",
        "4D",
        "5D",
        "6D",
        "7D",
        "8C",
      ]),
      entries: [],
      side: "NS",
      canBid: true,
      minBidValue: null,
    });
    expect(call).toBe("1NT");
  });

  it("bids 3NT with 21+ HCP", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "JS",
        "AH",
        "KH",
        "QH",
        "JH",
        "AD",
        "KD",
        "QD",
        "JD",
        "AC",
      ]),
      entries: [],
      side: "NS",
      canBid: true,
      minBidValue: null,
    });
    expect(call).toBe("3NT");
  });

  it("passes with a weak hand", () => {
    const call = chooseBid({
      hand: hand([
        "2S",
        "3S",
        "4S",
        "5S",
        "2H",
        "3H",
        "4H",
        "5H",
        "2D",
        "3D",
        "4D",
        "5D",
        "2C",
      ]),
      entries: [],
      side: "NS",
      canBid: true,
      minBidValue: null,
    });
    expect(call).toBe("P");
  });

  it("raises partner's suit on a fit", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "2H",
        "3H",
        "4H",
        "5H",
        "2D",
        "3D",
        "4D",
        "5D",
        "6D",
        "7C",
        "8C",
      ]),
      entries: [entry("1H", "NS")],
      side: "NS",
      canBid: true,
      minBidValue: 22,
    });
    expect(call).toBe("2H");
  });

  it("passes after partner's bid without a fit", () => {
    const call = chooseBid({
      hand: hand([
        "2S",
        "3S",
        "4S",
        "5S",
        "2H",
        "3H",
        "4H",
        "5H",
        "2D",
        "3D",
        "4D",
        "5D",
        "2C",
      ]),
      entries: [entry("1H", "NS")],
      side: "NS",
      canBid: true,
      minBidValue: 22,
    });
    expect(call).toBe("P");
  });

  it("does not raise a partner's raise (caps same-side escalation)", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "JS",
        "2S",
        "3S",
        "4S",
        "AH",
        "KH",
        "2H",
        "4D",
        "5D",
        "6D",
      ]),
      entries: [entry("1S", "EW"), entry("2S", "EW")],
      side: "EW",
      canBid: true,
      minBidValue: 23,
    });
    expect(call).toBe("P");
  });

  it("overcalls an opponent bid with strength", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "JS",
        "2S",
        "3S",
        "4S",
        "AH",
        "KH",
        "2H",
        "4D",
        "5D",
        "6D",
      ]),
      entries: [entry("1C", "EW")],
      side: "NS",
      canBid: true,
      minBidValue: 12,
    });
    expect(call).toBe("1S");
  });

  it("respects a high prior bid (passes when it cannot outrank)", () => {
    const call = chooseBid({
      hand: hand([
        "AS",
        "KS",
        "QS",
        "2S",
        "3S",
        "4S",
        "2H",
        "3H",
        "4D",
        "5D",
        "6D",
        "7C",
        "8C",
      ]),
      entries: [entry("7NT", "EW")],
      side: "NS",
      canBid: false,
      minBidValue: 76,
    });
    expect(call).toBe("P");
  });
});

describe("bot play", () => {
  it("wins the trick with the cheapest card", () => {
    const card = choosePlay({
      legal: hand(["QS", "JS", "2S", "3H"]),
      trick: [{ card: "5S", seat: "E" }],
      mySeat: "S",
      trump: null,
      side: "NS",
    });
    expect(card).toBe("JS");
  });

  it("ducks with the lowest card when it cannot win", () => {
    const card = choosePlay({
      legal: hand(["QS", "JS", "2S", "3H"]),
      trick: [{ card: "AS", seat: "E" }],
      mySeat: "S",
      trump: null,
      side: "NS",
    });
    expect(card).toBe("2S");
  });

  it("leads the top of the longest suit", () => {
    const card = choosePlay({
      legal: hand(["AS", "KS", "2H", "3H", "4H", "5H", "6D", "7D", "8C"]),
      trick: [],
      mySeat: "N",
      trump: null,
      side: "NS",
    });
    expect(card).toBe("5H");
  });
});

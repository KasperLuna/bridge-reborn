import { describe, expect, it } from "vitest";
import {
  buildDeck,
  buildShuffledDeal,
  cardRank,
  cardSuit,
  isValidDeal,
  rankIndex,
} from "./cards";

describe("cards", () => {
  it("builds a 52-card deck with no duplicates", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it("deals 13 valid cards to each seat", () => {
    const deal = buildShuffledDeal();
    expect(isValidDeal(deal)).toBe(true);
    for (const seat of ["N", "E", "S", "W"] as const) {
      expect(deal[seat]).toHaveLength(13);
    }
  });

  it("is deterministic for a seeded rng", () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const a = buildShuffledDeal(rng);
    seed = 42;
    const b = buildShuffledDeal(rng);
    expect(a).toEqual(b);
  });

  it("parses suits and ranks", () => {
    expect(cardSuit("AS")).toBe("S");
    expect(cardRank("TH")).toBe("T");
    expect(rankIndex("2")).toBe(0);
    expect(rankIndex("A")).toBe(12);
  });
});

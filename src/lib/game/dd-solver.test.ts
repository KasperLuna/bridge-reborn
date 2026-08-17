import { describe, expect, it } from "vitest";

import { buildDeck } from "./cards";
import { ddOutcome, solveDoubleDummy } from "./dd-solver";
import type { Deal, Seat } from "./types";

const ALL_SPADES = [
  "AS", "KS", "QS", "JS", "TS", "9S", "8S", "7S", "6S", "5S", "4S", "3S", "2S",
];

/** Deal where `fixed` seats get exactly `cards`; remaining cards fill the rest. */
function dealWith(fixed: { seat: Seat; cards: string[] }[]): Deal {
  const deck = buildDeck();
  const taken = new Set<string>();
  for (const f of fixed) for (const c of f.cards) taken.add(c);
  const pool = deck.filter((c) => !taken.has(c));
  const out = { N: [] as string[], E: [] as string[], S: [] as string[], W: [] as string[] };
  for (const f of fixed) out[f.seat] = f.cards;
  for (const seat of ["N", "E", "S", "W"] as Seat[]) {
    if (out[seat].length === 0) out[seat] = pool.splice(0, 13);
  }
  return out;
}

describe("solveDoubleDummy", () => {
  it("side holding all trumps takes all 13", () => {
    const deal = dealWith([{ seat: "N", cards: ALL_SPADES }]);
    expect(solveDoubleDummy(deal, "S", "N")).toBe(13);
  });

  it("defenders holding all trumps hold declarer to zero", () => {
    const deal = dealWith([{ seat: "E", cards: ALL_SPADES }]);
    expect(solveDoubleDummy(deal, "S", "N")).toBe(0);
  });
});

describe("ddOutcome", () => {
  it("flags a result that contradicts the double-dummy verdict", () => {
    expect(ddOutcome({ maxTricks: 9 }, 10, 9)).toEqual({
      made: true,
      ddMakes: true,
      upset: false,
    });
    expect(ddOutcome({ maxTricks: 8 }, 10, 9)).toEqual({
      made: true,
      ddMakes: false,
      upset: true,
    });
    expect(ddOutcome({ maxTricks: 10 }, 8, 9)).toEqual({
      made: false,
      ddMakes: true,
      upset: true,
    });
    expect(ddOutcome(null, 8, 9)).toBeNull();
  });
});

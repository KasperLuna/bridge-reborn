import { describe, expect, it } from "vitest";

import { buildShuffledDeal } from "@/lib/game/cards";
import type { Deal, Seat, Strain } from "@/lib/game/types";

import { solveDoubleDummy } from "./dd";

const ALL_SPADES = [
  "AS",
  "KS",
  "QS",
  "JS",
  "TS",
  "9S",
  "8S",
  "7S",
  "6S",
  "5S",
  "4S",
  "3S",
  "2S",
];
const ALL_HEARTS = [
  "AH",
  "KH",
  "QH",
  "JH",
  "TH",
  "9H",
  "8H",
  "7H",
  "6H",
  "5H",
  "4H",
  "3H",
  "2H",
];
const ALL_DIAMONDS = [
  "AD",
  "KD",
  "QD",
  "JD",
  "TD",
  "9D",
  "8D",
  "7D",
  "6D",
  "5D",
  "4D",
  "3D",
  "2D",
];
const ALL_CLUBS = [
  "AC",
  "KC",
  "QC",
  "JC",
  "TC",
  "9C",
  "8C",
  "7C",
  "6C",
  "5C",
  "4C",
  "3C",
  "2C",
];

const DEAL: Deal = {
  N: ALL_SPADES,
  E: ALL_HEARTS,
  S: ALL_DIAMONDS,
  W: ALL_CLUBS,
};

/** Defenders hold the four lowest spades (the best trumps downtown), declarer
    side holds the rest. Flipping to low inverts who controls the trump suit. */
function lowDiscriminatingDeal(): Deal {
  return {
    N: [
      "6S",
      "7S",
      "8S",
      "9S",
      "TS",
      "JS",
      "QS",
      "KS",
      "AS",
      "AH",
      "KH",
      "QH",
      "JH",
    ],
    E: [
      "2S",
      "3S",
      "AD",
      "KD",
      "QD",
      "JD",
      "TD",
      "9D",
      "8D",
      "7D",
      "6D",
      "5D",
      "4D",
    ],
    S: [
      "TH",
      "9H",
      "8H",
      "7H",
      "6H",
      "5H",
      "4H",
      "3H",
      "2H",
      "AC",
      "KC",
      "QC",
      "JC",
    ],
    W: [
      "4S",
      "5S",
      "TC",
      "9C",
      "8C",
      "7C",
      "6C",
      "5C",
      "4C",
      "3C",
      "2C",
      "3D",
      "2D",
    ],
  };
}

describe("solveDoubleDummy", () => {
  it("side holding all trumps takes all 13", async () => {
    await expect(solveDoubleDummy(DEAL, "S", "N")).resolves.toBe(13);
  });

  it("declarer in NT makes nothing when LHO runs a long suit", async () => {
    await expect(solveDoubleDummy(DEAL, "NT", "N")).resolves.toBe(0);
  });

  it("downtown mirrors each suit's ranks and reuses the bridge solver", async () => {
    const deal = lowDiscriminatingDeal();
    // Defenders hold the downtown master trumps (2S-5S), so they take two
    // tricks downtown but none uptown.
    await expect(solveDoubleDummy(deal, "S", "N", "high")).resolves.toBe(13);
    await expect(solveDoubleDummy(deal, "S", "N", "low")).resolves.toBe(11);
  });

  it("never returns a trick count outside 0..13 on random deals", async () => {
    const strains: Strain[] = ["S", "H", "D", "C", "NT"];
    const seats: Seat[] = ["N", "E", "S", "W"];
    const directions = ["high", "low"] as const;
    for (let i = 0; i < 3; i++) {
      const deal = buildShuffledDeal();
      for (const strain of strains) {
        for (const seat of seats) {
          for (const direction of directions) {
            const r = await solveDoubleDummy(deal, strain, seat, direction);
            expect(
              r === null || (r >= 0 && r <= 13),
              `${JSON.stringify(deal)} ${strain} ${seat} ${direction} -> ${r}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

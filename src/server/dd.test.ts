import { describe, expect, it } from "vitest";

import type { Deal } from "@/lib/game/types";

import { solveDoubleDummy } from "./dd";

const ALL_SPADES = [
  "AS", "KS", "QS", "JS", "TS", "9S", "8S", "7S", "6S", "5S", "4S", "3S", "2S",
];
const ALL_HEARTS = [
  "AH", "KH", "QH", "JH", "TH", "9H", "8H", "7H", "6H", "5H", "4H", "3H", "2H",
];
const ALL_DIAMONDS = [
  "AD", "KD", "QD", "JD", "TD", "9D", "8D", "7D", "6D", "5D", "4D", "3D", "2D",
];
const ALL_CLUBS = [
  "AC", "KC", "QC", "JC", "TC", "9C", "8C", "7C", "6C", "5C", "4C", "3C", "2C",
];

const DEAL: Deal = {
  N: ALL_SPADES,
  E: ALL_HEARTS,
  S: ALL_DIAMONDS,
  W: ALL_CLUBS,
};

describe("solveDoubleDummy", () => {
  it("side holding all trumps takes all 13", async () => {
    await expect(solveDoubleDummy(DEAL, "S", "N")).resolves.toBe(13);
  });

  it("declarer in NT makes nothing when LHO runs a long suit", async () => {
    await expect(solveDoubleDummy(DEAL, "NT", "N")).resolves.toBe(0);
  });
});

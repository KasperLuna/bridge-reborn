import { describe, expect, it } from "vitest";

import {
  KICK_VOTE_WINDOW_MS,
  isExpired,
  kickThreshold,
  shouldPass,
} from "@/lib/kick";

describe("kickThreshold", () => {
  it("computes strict-majority thresholds", () => {
    expect(kickThreshold(2)).toBe(2);
    expect(kickThreshold(3)).toBe(2);
    expect(kickThreshold(4)).toBe(3);
  });
});

describe("shouldPass", () => {
  it("passes exactly at the threshold", () => {
    expect(shouldPass(["a", "b"], 2)).toBe(true);
    expect(shouldPass(["a", "b"], 3)).toBe(true);
    expect(shouldPass(["a", "b", "c"], 4)).toBe(true);
  });

  it("lets the initiator alone kick with exactly two humans (1 other voter)", () => {
    expect(kickThreshold(1)).toBe(1);
    expect(shouldPass(["initiator"], 1)).toBe(true);
  });

  it("fails below the threshold", () => {
    expect(shouldPass(["a"], 2)).toBe(false);
    expect(shouldPass(["a"], 3)).toBe(false);
    expect(shouldPass(["a", "b"], 4)).toBe(false);
  });

  it("passes above the threshold", () => {
    expect(shouldPass(["a", "b", "c"], 3)).toBe(true);
    expect(shouldPass(["a", "b", "c", "d"], 4)).toBe(true);
  });
});

describe("isExpired", () => {
  it("is not expired strictly before the deadline", () => {
    const expiresAt = new Date(2000 + KICK_VOTE_WINDOW_MS).toISOString();
    expect(isExpired(expiresAt, 1000)).toBe(false);
  });

  it("is expired exactly at the deadline", () => {
    const expiresAt = new Date(2000).toISOString();
    expect(isExpired(expiresAt, 2000)).toBe(true);
  });

  it("is expired after the deadline", () => {
    const expiresAt = new Date(1000).toISOString();
    expect(isExpired(expiresAt, 2000)).toBe(true);
  });
});

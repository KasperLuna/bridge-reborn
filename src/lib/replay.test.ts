import { describe, expect, it } from "vitest";

import type { BidRecord, PlayRecord, TrickRecord } from "@/lib/types";
import {
  buildHandEvents,
  countEvents,
  indexToSlice,
  sliceTo,
  visibleTricks,
} from "./replay";

const bid = (
  id: string,
  username: string,
  sequence_position: number,
  call: string,
): BidRecord => ({
  id,
  hand_id: "h",
  username,
  sequence_position,
  call,
  hcp_held: 0,
  created: "",
  updated: "",
});

const play = (
  id: string,
  trick_id: string,
  play_sequence: number,
  seat: "N" | "E" | "S" | "W",
  card: string,
): PlayRecord => ({
  id,
  trick_id,
  hand_id: "h",
  username: seat.toLowerCase(),
  seat,
  play_sequence,
  card,
  created: "",
  updated: "",
});

const trick = (id: string, trick_number: number): TrickRecord => ({
  id,
  hand_id: "h",
  trick_number,
  leader_username: "north",
  leader_seat: "N",
  winner_username: "north",
  winner_seat: "N",
  created: "",
  updated: "",
});

describe("buildHandEvents", () => {
  it("orders all bids before plays, each in play order", () => {
    const bids = [
      bid("b1", "north", 0, "1S"),
      bid("b2", "east", 1, "P"),
      bid("b3", "south", 2, "P"),
      bid("b4", "west", 3, "2H"),
    ];
    const plays = [
      play("p1", "t1", 2, "W", "TH"),
      play("p2", "t1", 1, "S", "AS"),
      play("p3", "t1", 0, "N", "KS"),
      play("p4", "t1", 3, "E", "2S"),
      play("p5", "t2", 4, "W", "3H"),
    ];
    const tricks = [trick("t1", 1), trick("t2", 2)];
    const events = buildHandEvents(bids, plays, tricks, 3);
    expect(events.map((e) => e.kind)).toEqual([
      "bid",
      "bid",
      "bid",
      "bid",
      "play",
      "play",
      "play",
      "play",
      "play",
    ]);
    expect(events.map((e) => e.label)).toEqual([
      "1♠",
      "P",
      "P",
      "2♥",
      "♠K",
      "♠A",
      "♥10",
      "♠2",
      "♥3",
    ]);
    expect(events.every((e) => e.handNumber === 3)).toBe(true);
  });

  it("sorts bids by sequence_position regardless of input order", () => {
    const bids = [bid("b2", "east", 1, "P"), bid("b1", "north", 0, "1C")];
    expect(buildHandEvents(bids, [], [], 1).map((e) => e.label)).toEqual([
      "1♣",
      "P",
    ]);
  });

  it("renders NT bids and redoubles verbatim", () => {
    const bids = [bid("b1", "north", 0, "3NT"), bid("b2", "east", 1, "XX")];
    expect(buildHandEvents(bids, [], [], 2).map((e) => e.label)).toEqual([
      "3NT",
      "XX",
    ]);
  });

  it("resolves bid seats via seatOf and keeps explicit play seats", () => {
    const bids = [bid("b1", "north", 0, "1S")];
    const plays = [play("p1", "t1", 0, "E", "AS")];
    const events = buildHandEvents(bids, plays, [], 1, (u) =>
      u === "north" ? "N" : null,
    );
    expect(events[0]!.seat).toBe("N");
    expect(events[0]!.username).toBe("north");
    expect(events[1]!.seat).toBe("E");
  });

  it("leaves bid seats null without a resolver", () => {
    const bids = [bid("b1", "north", 0, "1S")];
    expect(buildHandEvents(bids, [], [], 1)[0]!.seat).toBeNull();
  });

  it("orders plays by trick_number then play_sequence", () => {
    // play_sequence repeats per trick, so seq alone interleaves tricks.
    const plays = [
      play("a", "t1", 1, "S", "AS"),
      play("b", "t2", 1, "E", "AH"),
      play("c", "t1", 2, "W", "2S"),
      play("d", "t2", 2, "S", "KH"),
    ];
    const tricks = [trick("t1", 1), trick("t2", 2)];
    expect(buildHandEvents([], plays, tricks, 1).map((e) => e.label)).toEqual([
      "♠A",
      "♠2",
      "♥A",
      "♥K",
    ]);
  });
});

describe("indexToSlice", () => {
  it("maps a global index onto bid and play slice counts", () => {
    expect(indexToSlice(0, 3)).toEqual({ bidSlice: 0, playSlice: 0 });
    expect(indexToSlice(2, 3)).toEqual({ bidSlice: 2, playSlice: 0 });
    expect(indexToSlice(3, 3)).toEqual({ bidSlice: 3, playSlice: 0 });
    expect(indexToSlice(5, 3)).toEqual({ bidSlice: 3, playSlice: 2 });
    expect(indexToSlice(-1, 3)).toEqual({ bidSlice: 0, playSlice: 0 });
  });
});

describe("sliceTo", () => {
  it("truncates records to the event index", () => {
    const bids = [bid("b1", "n", 0, "P"), bid("b2", "e", 1, "P")];
    const plays = [
      play("p1", "t1", 0, "N", "AS"),
      play("p2", "t1", 1, "E", "2S"),
    ];
    expect(sliceTo(bids, plays, 0)).toEqual({ bids: [], plays: [] });
    expect(sliceTo(bids, plays, 1)).toEqual({ bids: [bids[0]], plays: [] });
    expect(sliceTo(bids, plays, 2)).toEqual({ bids, plays: [] });
    expect(sliceTo(bids, plays, 3)).toEqual({ bids, plays: [plays[0]] });
    expect(sliceTo(bids, plays, 4)).toEqual({ bids, plays });
  });

  it("clamps out-of-range indices", () => {
    const bids = [bid("b1", "n", 0, "P")];
    const plays = [play("p1", "t1", 0, "N", "AS")];
    expect(sliceTo(bids, plays, -5)).toEqual({ bids: [], plays: [] });
    expect(sliceTo(bids, plays, 99)).toEqual({ bids, plays });
  });
});

describe("countEvents", () => {
  it("counts bids plus plays", () => {
    expect(countEvents([], [])).toBe(0);
    expect(
      countEvents([bid("b1", "n", 0, "P")], [play("p1", "t1", 0, "N", "AS")]),
    ).toBe(2);
  });
});

describe("visibleTricks", () => {
  it("returns only tricks whose four plays are present", () => {
    const tricks = [trick("t1", 1), trick("t2", 2)];
    const plays = [
      play("a", "t1", 0, "N", "AS"),
      play("b", "t1", 1, "E", "2S"),
      play("c", "t1", 2, "S", "3S"),
      play("d", "t1", 3, "W", "4S"),
      play("e", "t2", 0, "N", "AH"),
    ];
    expect(visibleTricks(tricks, plays).map((t) => t.id)).toEqual(["t1"]);
  });

  it("treats in-progress tricks as not yet visible", () => {
    const tricks = [trick("t1", 1)];
    const plays = [
      play("a", "t1", 0, "N", "AS"),
      play("b", "t1", 1, "E", "2S"),
    ];
    expect(visibleTricks(tricks, plays)).toEqual([]);
    expect(visibleTricks(tricks, [])).toEqual([]);
  });
});

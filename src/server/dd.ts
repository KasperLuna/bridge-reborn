import { createRequire } from "node:module";

import { leftOf } from "@/lib/game/seats";
import type { Deal, Direction, Seat, Strain } from "@/lib/game/types";

const require = createRequire(import.meta.url);

const BYTES_PER_INT = 4;
const INTS_PER_RESULT = 3;

const SUIT_TO_DDS: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
const RANK_TO_DDS: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};
const COMPASS_TO_DDS: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 };
const SUIT_ORDER = ["S", "H", "D", "C"] as const;

type DdsModule = {
  _dds_init: () => void;
  _dds_solve_board: (
    trump: number,
    direction: number,
    c0s: number,
    c0r: number,
    c1s: number,
    c1r: number,
    c2s: number,
    c2r: number,
    dealPbn: number,
    result: number,
  ) => void;
  _malloc: (n: number) => number;
  _free: (p: number) => void;
  allocateUTF8: (s: string) => number;
  getValue: (p: number, type: string) => number;
  setValue: (p: number, v: number, type: string) => void;
};

const createDdsModule = require("@bridge-tools/dd/wasm/compiled.js") as (
  opts?: Record<string, unknown>,
) => Promise<DdsModule>;

let instance: Promise<DdsModule> | null = null;

function getInstance(): Promise<DdsModule> {
  instance ??= createDdsModule().then((mod) => {
    mod._dds_init();
    return mod;
  });
  return instance;
}

function dealToPbn(deal: Deal): string {
  const seats: Seat[] = ["N", "E", "S", "W"];
  const hands = seats.map((seat) =>
    SUIT_ORDER.map((suit) =>
      (deal[seat] ?? [])
        .filter((c) => c[1] === suit)
        .map((c) => c[0])
        .sort((a, b) => RANK_TO_DDS[b]! - RANK_TO_DDS[a]!)
        .join(""),
    ).join("."),
  );
  return `N:${hands.join(" ")}`;
}

/** Downtown ("low") ranks cards 2, 3, ..., K, A: the deuce beats the ace, the
    mirror image of bridge order. Relabeling each suit's ranks with this
    bijection (2↔A, 3↔K, 4↔Q, 5↔J, 6↔T, 7↔9, 8↔8) maps a downtown game onto an
    order-isomorphic uptown game with identical trick outcomes, so the bridge
    DDS can solve it directly. */
const MIRROR_RANK: Record<string, string> = {
  "2": "A",
  "3": "K",
  "4": "Q",
  "5": "J",
  "6": "T",
  "7": "9",
  "8": "8",
  "9": "7",
  T: "6",
  J: "5",
  Q: "4",
  K: "3",
  A: "2",
};

function mirrorDeal(deal: Deal): Deal {
  const mirrored: Deal = { N: [], E: [], S: [], W: [] };
  for (const seat of ["N", "E", "S", "W"] as Seat[]) {
    mirrored[seat] = (deal[seat] ?? []).map(
      (c) => `${MIRROR_RANK[c[0]!]!}${c[1]}`,
    );
  }
  return mirrored;
}

/** Declarer side's max tricks on the given strain via the WASM bridge DDS.
    Downtown (low cards win) is not directly solvable, but mirroring each
    suit's ranks yields an equivalent uptown deal that is. Returns null if the
    solve fails for any reason. */
export async function solveDoubleDummy(
  deal: Deal,
  strain: Strain,
  declarerSeat: Seat,
  direction: Direction = "high",
): Promise<number | null> {
  const dealt = direction === "low" ? mirrorDeal(deal) : deal;
  try {
    const mod = await getInstance();
    const dealPtr = mod.allocateUTF8(dealToPbn(dealt));
    const resultPtr = mod._malloc(13 * INTS_PER_RESULT * BYTES_PER_INT);
    for (let i = 0; i < 13; i++) {
      mod.setValue(
        resultPtr + i * INTS_PER_RESULT * BYTES_PER_INT,
        -1,
        "i32",
      );
    }

    const trump = strain === "NT" ? 4 : SUIT_TO_DDS[strain]!;
    // DDS reports tricks for the side on lead. The opening leader is the
    // declarer's LHO, so solve from their seat and invert for the declarer.
    const leaderSeat = leftOf(declarerSeat);
    mod._dds_solve_board(
      trump,
      COMPASS_TO_DDS[leaderSeat],
      0,
      0,
      0,
      0,
      0,
      0,
      dealPtr,
      resultPtr,
    );

    let defendersTricks = -1;
    let valid = true;
    const leaderCards = new Set(
      (dealt[leaderSeat] ?? []).map(
        (c) => `${RANK_TO_DDS[c[0]!]!}:${SUIT_TO_DDS[c[1]!]!}`,
      ),
    );
    for (let i = 0; i < 13; i++) {
      const idx = resultPtr + i * INTS_PER_RESULT * BYTES_PER_INT;
      const rank = mod.getValue(idx, "i32");
      if (rank === -1 || rank === 0) break;
      const suit = mod.getValue(idx + BYTES_PER_INT, "i32");
      const tricks = mod.getValue(idx + 2 * BYTES_PER_INT, "i32");
      // DDS can return corrupted rows for some deals; a lead must be a card
      // the leader holds and the score must be a trick count.
      if (tricks < 0 || tricks > 13 || !leaderCards.has(`${rank}:${suit}`)) {
        valid = false;
        break;
      }
      if (tricks > defendersTricks) defendersTricks = tricks;
    }

    mod._free(resultPtr);
    mod._free(dealPtr);
    if (!valid) return null;
    return defendersTricks < 0 ? null : 13 - defendersTricks;
  } catch {
    return null;
  }
}

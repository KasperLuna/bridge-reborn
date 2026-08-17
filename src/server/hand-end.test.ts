import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContractRecord,
  Hand,
  HandResultRecord,
  Room,
  RoomSeat,
  TrickRecord,
} from "@/lib/types";
import type { Deal, Seat } from "@/lib/game/types";
import { getPreset } from "@/lib/rulesets";

// Emulates the real PocketBase field rules declared in pb_schema.json, most
// importantly that a required number field treats 0 as blank. This keeps the
// route integration tests faithful to the deployed schema.
const schema = JSON.parse(
  readFileSync(new URL("../../pb_schema.json", import.meta.url), "utf8"),
) as {
  name: string;
  fields: { name: string; required: boolean; type: string }[];
}[];
const schemaFields = new Map(schema.map((c) => [c.name, c.fields]));

const hoisted = vi.hoisted(() => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  let seq = 0;

  function matchAndSort<T>(
    rows: Map<string, Record<string, unknown>>,
    filter?: string,
    sort?: string,
  ): T[] {
    let out = [...rows.values()];
    if (filter) {
      out = out.filter((r) => {
        const conds = filter.split("&&").map((c) => c.trim());
        return conds.every((c) => {
          const m = /^(\w+)\s*=\s*"([^"]*)"$/.exec(c);
          if (!m) throw new Error(`unsupported filter: ${c}`);
          return String(r[m[1]]) === m[2];
        });
      });
    }
    if (sort) {
      const key = sort.replace(/^-/, "");
      const desc = sort.startsWith("-");
      out.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return desc ? -cmp : cmp;
      });
    }
    return out as T[];
  }

  // Required number fields reject 0, matching PocketBase's "0 is blank" rule.
  function validate(name: string, data: Record<string, unknown>): void {
    for (const f of schemaFields.get(name) ?? []) {
      if (f.required && f.type === "number" && data[f.name] === 0) {
        throw new Error(`validation_required: ${f.name} cannot be blank`);
      }
    }
  }

  const db = {
    filter: (tpl: string, params: Record<string, unknown>) =>
      tpl.replace(/\{:\w+\}/g, (m) => {
        const v = params[m.slice(2, -1)];
        return typeof v === "string" ? `"${v}"` : String(v);
      }),
    collection: (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const rows = store.get(name)!;
      return {
        async getOne<T>(id: string): Promise<T> {
          const r = rows.get(id);
          if (!r) throw new Error("not found");
          return r as T;
        },
        async getFullList<T>(opts?: {
          filter?: string;
          sort?: string;
        }): Promise<T[]> {
          return matchAndSort<T>(rows, opts?.filter, opts?.sort);
        },
        async getList<T>(
          _p: number,
          _n: number,
          opts?: { filter?: string; sort?: string },
        ): Promise<{ items: T[] }> {
          return { items: matchAndSort<T>(rows, opts?.filter, opts?.sort) };
        },
        async getFirstListItem<T>(filter: string): Promise<T> {
          const items = matchAndSort<T>(rows, filter);
          if (items.length === 0) throw new Error("no items");
          return items[0]!;
        },
        async create<T>(data: Partial<T>): Promise<T> {
          validate(name, data as Record<string, unknown>);
          const rec = {
            ...data,
            id: `${name}-${++seq}`,
            created: "",
            updated: "",
          };
          rows.set(rec.id, rec as Record<string, unknown>);
          return rec as unknown as T;
        },
        async update<T>(id: string, data: Partial<T>): Promise<T> {
          validate(name, data as Record<string, unknown>);
          const cur = rows.get(id);
          if (!cur) throw new Error("not found");
          const next = { ...cur, ...data, updated: "" };
          rows.set(id, next);
          return next as unknown as T;
        },
      };
    },
  };
  return { db, _store: store };
});

vi.mock("@/server/pb", () => ({
  getAdminClient: () => Promise.resolve(hoisted.db),
}));

const ruleset = getPreset("bid-whist-default");
const SEATS: Seat[] = ["N", "E", "S", "W"];

const HONOR: Record<Seat, string[]> = {
  N: ["AS", "AH", "AD", "AC"],
  S: ["KS", "KH", "KD", "KC"],
  E: ["QS", "QH", "QD", "QC"],
  W: ["JS", "JH", "JD", "JC"],
};
const FILL: Record<Seat, string[]> = {
  N: ["2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "TS"],
  S: ["2H", "3H", "4H", "5H", "6H", "7H", "8H", "9H", "TH"],
  E: ["2D", "3D", "4D", "5D", "6D", "7D", "8D", "9D", "TD"],
  W: ["2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "TC"],
};

function makeDeal(): Deal {
  const deal = {} as Deal;
  for (const s of SEATS) deal[s] = [...HONOR[s], ...FILL[s]];
  return deal;
}

function suitOf(card: string): string {
  return card[1]!;
}

function rankVal(card: string): number {
  return "23456789TJQKA".indexOf(card[0]!);
}

async function setupHand() {
  const room = await hoisted.db.collection("rooms").create<Room>({
    code: "ABCD",
    status: "active",
    mode: "solo",
    ruleset,
    started_at: "",
    ended_at: "",
  });
  const seatRecs: RoomSeat[] = [];
  for (const s of SEATS) {
    seatRecs.push(
      await hoisted.db.collection("room_seats").create<RoomSeat>({
        room_id: room.id,
        username: `U${s}`,
        seat: s,
        is_spectator: false,
        is_bot: false,
        ready: false,
        joined_at: "",
      }),
    );
  }
  const hand = await hoisted.db.collection("hands").create<Hand>({
    room_id: room.id,
    north_username: "UN",
    south_username: "US",
    east_username: "UE",
    west_username: "UW",
    deal: makeDeal(),
    started_at: "",
    ended_at: "",
    winner_side: "",
    end_reason: "",
  });
  await hoisted.db.collection("contracts").create<ContractRecord>({
    hand_id: hand.id,
    declarer_username: "UN",
    declarer_seat: "N",
    level: "2",
    strain: "NT",
    doubled: false,
    redoubled: false,
  });
  return { room, hand, seatRecs };
}

async function postPlay(
  room: Room,
  seatRecs: RoomSeat[],
  handId: string,
  seat: Seat,
  card: string,
): Promise<boolean> {
  const rec = seatRecs.find((r) => r.seat === seat)!;
  const { POST } = await import("@/app/api/hands/[id]/play/route");
  const res = await POST(
    new Request("http://localhost/api/hands/x/play", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        seatId: rec.id,
        username: rec.username,
        card,
      }),
    }),
    { params: Promise.resolve({ id: handId }) },
  );
  return res.ok;
}

describe("hand end when the contract is made exactly", () => {
  beforeEach(() => {
    hoisted._store.clear();
    vi.resetModules();
  });

  it("ends the hand when the declarer reaches the required tricks (delta 0)", async () => {
    const { room, hand, seatRecs } = await setupHand();
    const handId = hand.id;

    const remaining: Record<string, string[]> = {};
    for (const s of SEATS) remaining[`U${s}`] = [...makeDeal()[s]];

    // Left of declarer (N) leads the first trick; N wins every trick after
    // that by leading (or beating) with aces, so NS reaches 8 tricks exactly.
    let leader: Seat = "E";
    let ended = false;
    for (let t = 0; t < 13 && !ended; t++) {
      const trickCards: string[] = [];
      for (let p = 0; p < 4; p++) {
        const seat = SEATS[(SEATS.indexOf(leader) + p) % 4]!;
        const u = `U${seat}`;
        const mine = remaining[u]!;
        const ledSuit = trickCards[0] ? suitOf(trickCards[0]) : null;
        const follow = ledSuit ? mine.filter((c) => suitOf(c) === ledSuit) : [];
        let pick: string;
        if (p === 0) {
          const spades = mine.filter((c) => suitOf(c) === "S");
          pick =
            (seat === "N" || seat === "S") && spades.length > 0
              ? [...spades].sort((a, b) => rankVal(a) - rankVal(b))[0]!
              : [...mine].sort((a, b) => rankVal(a) - rankVal(b))[0]!;
        } else if (follow.length > 0) {
          pick =
            seat === "N" || seat === "S"
              ? [...follow].sort((a, b) => rankVal(b) - rankVal(a))[0]!
              : [...follow].sort((a, b) => rankVal(a) - rankVal(b))[0]!;
        } else {
          pick = [...mine].sort((a, b) => rankVal(a) - rankVal(b))[0]!;
        }
        trickCards.push(pick);
        remaining[u] = mine.filter((c) => c !== pick);
        const ok = await postPlay(room, seatRecs, handId, seat, pick);
        expect(ok, `play ${seat} ${pick} trick ${t + 1}/${p + 1}`).toBe(true);
      }
      const fresh = await hoisted.db.collection("hands").getOne<Hand>(handId);
      ended = !!fresh.ended_at;
      if (!ended) {
        const tr = await hoisted.db
          .collection("tricks")
          .getFullList<TrickRecord>({
            filter: `hand_id = "${handId}"`,
            sort: "trick_number",
          });
        leader = tr.at(-1)!.winner_seat as Seat;
      }
    }

    const fresh = await hoisted.db.collection("hands").getOne<Hand>(handId);
    const results = await hoisted.db
      .collection("hand_results")
      .getFullList<HandResultRecord>({
        filter: `hand_id = "${handId}"`,
      });
    expect(fresh.ended_at, "hand should have ended").toBeTruthy();
    expect(fresh.end_reason, "end reason").toBe("completed");
    expect(fresh.winner_side, "winner is declarer side").toBe("NS");
    expect(results.length, "exactly one scored result").toBe(1);
    expect(results[0]!.result_delta, "made the contract exactly").toBe(0);
  }, 30000);
});

describe("pb_schema", () => {
  it("hand_results.result_delta must not be required (0 = made exactly)", () => {
    const hr = schema.find((c) => c.name === "hand_results")!;
    const delta = hr.fields.find((f) => f.name === "result_delta")!;
    expect(delta.required).toBe(false);
  });
});

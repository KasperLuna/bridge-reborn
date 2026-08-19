import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Hand, Room, RoomSeat } from "@/lib/types";
import type { Deal, Seat } from "@/lib/game/types";
import { getPreset } from "@/lib/rulesets";

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
  for (const s of ["N", "E", "S", "W"] as Seat[]) {
    deal[s] = [...HONOR[s], ...FILL[s]];
  }
  return deal;
}

async function seedSoloRoomFinished() {
  const room = await hoisted.db.collection("rooms").create<Room>({
    code: "ABCD",
    status: "active",
    mode: "solo",
    ruleset,
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "",
  });
  const seatRecs: RoomSeat[] = [];
  const bySeat: Record<string, { username: string; isBot: boolean }> = {
    N: { username: "You", isBot: false },
    S: { username: "Bot S", isBot: true },
    E: { username: "Bot E", isBot: true },
    W: { username: "Bot W", isBot: true },
  };
  for (const s of ["N", "E", "S", "W"] as Seat[]) {
    seatRecs.push(
      await hoisted.db.collection("room_seats").create<RoomSeat>({
        room_id: room.id,
        username: bySeat[s]!.username,
        seat: s,
        is_spectator: false,
        is_bot: bySeat[s]!.isBot,
        ready: true,
        joined_at: "",
      }),
    );
  }
  // Previous finished hand.
  const finished = await hoisted.db.collection("hands").create<Hand>({
    room_id: room.id,
    north_username: "You",
    south_username: "Bot S",
    east_username: "Bot E",
    west_username: "Bot W",
    deal: makeDeal(),
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T00:10:00.000Z",
    winner_side: "NS",
    end_reason: "completed",
  });
  return { room, seatRecs, finished };
}

describe("new-game with bots", () => {
  beforeEach(() => {
    hoisted._store.clear();
    vi.resetModules();
  });

  it("deals a new hand and drives the opener bot to bid", async () => {
    const { room } = await seedSoloRoomFinished();

    // Mock buildShuffledDeal to a fixed deal where a bot holds 2C (opener = E).
    vi.mock("@/lib/game/cards", async (importOriginal) => {
      const mod = await importOriginal<typeof import("@/lib/game/cards")>();
      const fixedDeal: Deal = {
        N: ["AS", "KS", "QS", "JS", "TS", "9S", "8S", "7S", "6S", "5S", "4S", "3S", "2S"],
        E: ["2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "TC", "JC", "QC", "KC", "AC"],
        S: ["AH", "KH", "QH", "JH", "TH", "9H", "8H", "7H", "6H", "5H", "4H", "3H", "2H"],
        W: ["AD", "KD", "QD", "JD", "TD", "9D", "8D", "7D", "6D", "5D", "4D", "3D", "2D"],
      };
      return { ...mod, buildShuffledDeal: () => fixedDeal };
    });

    const { POST } = await import("@/app/api/rooms/[code]/new-game/route");
    const res = await POST(
      new Request("http://localhost/api/rooms/ABCD/new-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          seatId: (await hoisted.db
            .collection("room_seats")
            .getFullList<RoomSeat>())[0]!.id,
          username: "You",
        }),
      }),
      { params: Promise.resolve({ code: "ABCD" }) },
    );

    const body = await res.clone().json();
    console.log("new-game response", res.status, body);
    expect(res.ok).toBe(true);

    const newHandId = (body as { handId: string }).handId;
    const newHand = await hoisted.db.collection("hands").getOne<Hand>(newHandId);
    expect(newHand.ended_at ?? "").toBe("");
    expect(newHand.id).not.toBe((await seedSoloRoomFinished).toString());

    // 2C is in Bot E's hand, so the opener is E and it must have bid.
    const bids = await hoisted.db
      .collection("bids")
      .getFullList<{ hand_id: string; username: string; call: string }>({
        filter: `hand_id = "${newHand.id}"`,
      });
    expect(bids.length).toBeGreaterThan(0);
    expect(bids[0]!.username).toBe("Bot E");
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import type PocketBase from "pocketbase";

import type { Room, RoomSeat } from "@/lib/types";
import { kickBotSeat } from "@/server/helpers";

const hoisted = vi.hoisted(() => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  let seq = 0;

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
        async getFullList<T>(opts?: { filter?: string }): Promise<T[]> {
          let out = [...rows.values()];
          if (opts?.filter) {
            const conds = opts.filter.split("&&").map((c) => c.trim());
            out = out.filter((r) =>
              conds.every((c) => {
                const m = /^(\w+)\s*=\s*("([^"]*)"|true|false)$/.exec(c);
                if (!m) throw new Error(`unsupported filter: ${c}`);
                const want =
                  m[3] !== undefined
                    ? m[3]
                    : m[2] === "true"
                      ? true
                      : false;
                return String(r[m[1]]) === String(want);
              }),
            );
          }
          return out as T[];
        },
        async create<T>(data: Partial<T>): Promise<T> {
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
          const cur = rows.get(id);
          if (!cur) throw new Error("not found");
          const next = { ...cur, ...data, updated: "" };
          rows.set(id, next);
          return next as unknown as T;
        },
        async delete(id: string): Promise<boolean> {
          return rows.delete(id);
        },
      };
    },
  };
  return { db, store };
});

vi.mock("@/server/pb", () => ({
  getAdminClient: () => Promise.resolve(hoisted.db),
}));

async function seedRoom(overrides: Partial<Room> = {}) {
  const room = await hoisted.db.collection("rooms").create<Room>({
    code: "ABCD",
    status: "active",
    mode: "four",
    ruleset: {},
    started_at: "",
    ended_at: "",
    privacy: "public",
    password_hash: "",
    joinable: true,
    created: "",
    updated: "",
    ...overrides,
  });
  return room;
}

async function seedSeat(
  roomId: string,
  username: string,
  seat: "N" | "S" | "E" | "W",
  isBot: boolean,
  ready = false,
): Promise<RoomSeat> {
  return hoisted.db.collection("room_seats").create<RoomSeat>({
    room_id: roomId,
    username,
    seat,
    is_spectator: false,
    is_bot: isBot,
    ready,
    joined_at: "",
    created: "",
    updated: "",
  });
}

beforeEach(() => {
  hoisted.store.clear();
});

describe("kickBotSeat", () => {
  it("deletes the bot seat and drops an active room back to waiting", async () => {
    const room = await seedRoom();
    await seedSeat(room.id, "Alice", "N", false, true);
    const bot = await seedSeat(room.id, "Bot S", "S", true, true);
    await seedSeat(room.id, "Bob", "E", false, true);
    await seedSeat(room.id, "Bot W", "W", true, true);

    await kickBotSeat(
      hoisted.db as unknown as PocketBase,
      room.id,
      "Bot S",
    );

    const remaining = await hoisted.db
      .collection("room_seats")
      .getFullList<RoomSeat>();
    expect(remaining.map((s) => s.id)).not.toContain(bot.id);

    const updated = await hoisted.db.collection("rooms").getOne<Room>(room.id);
    expect(updated.status).toBe("waiting");
    expect(updated.started_at).toBe("");

    const humans = remaining.filter((s) => !s.is_bot);
    expect(humans.every((s) => s.ready === false)).toBe(true);

    const bots = remaining.filter((s) => s.is_bot);
    expect(bots.every((s) => s.ready === true)).toBe(true);
  });
});

describe("add-bot route", () => {
  it("rejects bots outside 4-player rooms", async () => {
    const room = await seedRoom({ mode: "solo" });
    const leader = await seedSeat(room.id, "Alice", "N", false);
    const { POST } = await import("@/app/api/rooms/[code]/bots/route");
    const res = await POST(
      new Request("http://localhost/api/rooms/ABCD/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          seatId: leader.id,
          username: "Alice",
        }),
      }),
      { params: Promise.resolve({ code: "ABCD" }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-leader actors", async () => {
    const room = await seedRoom({ status: "waiting" });
    const east = await seedSeat(room.id, "Bob", "E", false);
    const { POST } = await import("@/app/api/rooms/[code]/bots/route");
    const res = await POST(
      new Request("http://localhost/api/rooms/ABCD/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          seatId: east.id,
          username: "Bob",
        }),
      }),
      { params: Promise.resolve({ code: "ABCD" }) },
    );
    expect(res.status).toBe(403);
  });

  it("seats a ready bot in the first free seat", async () => {
    const room = await seedRoom({ status: "waiting" });
    await seedSeat(room.id, "Alice", "N", false, true);
    const { POST } = await import("@/app/api/rooms/[code]/bots/route");
    const leader = (await hoisted.db
      .collection("room_seats")
      .getFullList<RoomSeat>())[0]!;
    const res = await POST(
      new Request("http://localhost/api/rooms/ABCD/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          seatId: leader.id,
          username: "Alice",
        }),
      }),
      { params: Promise.resolve({ code: "ABCD" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { seat: RoomSeat };
    expect(body.seat.seat).toBe("S");
    expect(body.seat.is_bot).toBe(true);
    expect(body.seat.ready).toBe(true);
  });

  it("rejects when every seat is taken", async () => {
    const room = await seedRoom({ status: "waiting" });
    await seedSeat(room.id, "Alice", "N", false);
    await seedSeat(room.id, "Bob", "S", false);
    await seedSeat(room.id, "Carol", "E", false);
    await seedSeat(room.id, "Dave", "W", false);
    const { POST } = await import("@/app/api/rooms/[code]/bots/route");
    const leader = (await hoisted.db
      .collection("room_seats")
      .getFullList<RoomSeat>())[0]!;
    const res = await POST(
      new Request("http://localhost/api/rooms/ABCD/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          seatId: leader.id,
          username: "Alice",
        }),
      }),
      { params: Promise.resolve({ code: "ABCD" }) },
    );
    expect(res.status).toBe(409);
  });
});
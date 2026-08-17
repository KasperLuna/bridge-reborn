import { NextResponse } from "next/server";
import { z } from "zod";

import type { Seat } from "@/lib/game/types";
import { DEFAULT_RULESET_ID, getPreset } from "@/lib/rulesets";
import type { Room, RoomSeat } from "@/lib/types";
import { runBotTurns } from "@/server/bots";
import { errorResponse } from "@/server/errors";
import { createHand, getRoomByCode } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";
import { verifyPassword } from "@/server/room-password";

const SEAT_ORDER: Seat[] = ["N", "S", "E", "W"];

const JoinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[A-Z0-9]{4,8}$/.test(v), "Invalid room code"),
  username: z.string().trim().min(1, "Username required").max(40),
  wantSpectator: z.boolean().optional().default(false),
  password: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof JoinSchema>;
  try {
    body = JoinSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();

    let room = await getRoomByCode(pb, body.code);

    // Create the room if it doesn't exist yet.
    if (!room) {
      room = await pb.collection("rooms").create<Room>({
        code: body.code,
        status: "waiting",
        mode: "four",
        ruleset: getPreset(DEFAULT_RULESET_ID),
        joinable: true,
        privacy: "public",
        password_hash: "",
      });
    }

    // Existing rooms: solo rooms are non-joinable; private rooms need the
    // password. These gates cover the rejoin, pairs, and spectator paths below.
    if (room.joinable === false) {
      return NextResponse.json(
        { error: "Room is not joinable" },
        { status: 403 },
      );
    }
    if (room.privacy === "private") {
      if (!body.password) {
        return NextResponse.json(
          { error: "Password required" },
          { status: 403 },
        );
      }
      if (!verifyPassword(body.password, room.password_hash)) {
        return NextResponse.json({ error: "Wrong password" }, { status: 403 });
      }
    }

    // Rejoin: update joined_at and hand back the existing seat.
    try {
      const existing = await pb
        .collection("room_seats")
        .getFirstListItem<RoomSeat>(
          pb.filter("room_id = {:roomId} && username = {:username}", {
            roomId: room.id,
            username: body.username,
          }),
        );
      const updated = await pb
        .collection("room_seats")
        .update<RoomSeat>(existing.id, {
          joined_at: new Date().toISOString(),
        });
      return NextResponse.json(toSession(updated, room));
    } catch {
      // no existing record — fall through to create
    }

    // Pairs mode: a newcomer takes the free partnership (two seats), or
    // spectates when both sides are already taken.
    if (room.mode === "pairs") {
      if (body.wantSpectator) {
        const spectated = await pb.collection("room_seats").create<RoomSeat>({
          room_id: room.id,
          username: body.username,
          seat: "",
          is_spectator: true,
          joined_at: new Date().toISOString(),
        });
        return NextResponse.json(toSession(spectated, room));
      }
      const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
        filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      });
      const seated = seats.filter((s) => !s.is_spectator && s.seat);
      const nsTaken = seated.some((s) => s.seat === "N" || s.seat === "S");
      const ewTaken = seated.some((s) => s.seat === "E" || s.seat === "W");

      if (nsTaken && ewTaken) {
        const spectated = await pb.collection("room_seats").create<RoomSeat>({
          room_id: room.id,
          username: body.username,
          seat: "",
          is_spectator: true,
          joined_at: new Date().toISOString(),
        });
        return NextResponse.json(toSession(spectated, room));
      }

      const take = nsTaken ? (["E", "W"] as Seat[]) : (["N", "S"] as Seat[]);
      let primary: RoomSeat | null = null;
      for (const seat of take) {
        primary = await pb.collection("room_seats").create<RoomSeat>({
          room_id: room.id,
          username: body.username,
          seat,
          is_spectator: false,
          joined_at: new Date().toISOString(),
        });
      }

      // Auto-start as soon as both partnerships are seated.
      const after = await pb.collection("room_seats").getFullList<RoomSeat>({
        filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      });
      if (after.filter((s) => !s.is_spectator && s.seat).length === 4) {
        const players = after.filter((s) => !s.is_spectator && s.seat);
        const hand = await createHand(pb, room, players);
        await pb.collection("rooms").update(room.id, {
          status: "active",
          started_at: new Date().toISOString(),
        });
        await runBotTurns(pb, hand.id);
      }
      return NextResponse.json(toSession(primary!, room));
    }

    let isSpectator = room.status !== "waiting" || body.wantSpectator;
    let assignedSeat: Seat | "" = "";

    if (!isSpectator) {
      const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
        filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      });
      const taken = new Set(
        seats.filter((s) => !s.is_spectator && s.seat).map((s) => s.seat),
      );
      assignedSeat = SEAT_ORDER.find((s) => !taken.has(s)) ?? "";
      isSpectator = assignedSeat === "";
    }

    const created = await pb.collection("room_seats").create<RoomSeat>({
      room_id: room.id,
      username: body.username,
      seat: assignedSeat,
      is_spectator: isSpectator,
      joined_at: new Date().toISOString(),
    });
    return NextResponse.json(toSession(created, room));
  } catch (err) {
    return errorResponse(err);
  }
}

function toSession(seat: RoomSeat, room: Room) {
  return {
    username: seat.username,
    code: room.code,
    roomId: room.id,
    seatId: seat.id,
    seat: seat.seat || null,
    isSpectator: seat.is_spectator,
  };
}

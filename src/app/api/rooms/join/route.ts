import { NextResponse } from "next/server";
import { z } from "zod";

import type { Seat } from "@/lib/game/types";
import { DEFAULT_RULESET_ID, getPreset } from "@/lib/rulesets";
import type { Room, RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { getRoomByCode } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const SEAT_ORDER: Seat[] = ["N", "S", "E", "W"];

const JoinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[A-Z0-9]{4,8}$/.test(v), "Invalid room code"),
  username: z.string().trim().min(1, "Username required").max(40),
  wantSpectator: z.boolean().optional().default(false),
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
        ruleset: getPreset(DEFAULT_RULESET_ID),
      });
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

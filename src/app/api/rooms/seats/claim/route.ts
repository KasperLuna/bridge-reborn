import { NextResponse } from "next/server";
import { z } from "zod";

import type { Seat } from "@/lib/game/types";
import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { getActiveHand, getRoom } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const ClaimSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  seat: z.enum(["N", "S", "E", "W"]).nullable(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof ClaimSchema>;
  try {
    body = ClaimSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();

    // Claiming a seat still requires a valid session (spectators can claim too).
    let seat: RoomSeat;
    try {
      seat = await pb.collection("room_seats").getOne<RoomSeat>(body.seatId);
    } catch {
      return NextResponse.json(
        { error: "Seat record not found" },
        { status: 404 },
      );
    }
    if (seat.room_id !== body.roomId || seat.username !== body.username) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const room = await getRoom(pb, body.roomId);
    if (room.status === "finished") {
      return NextResponse.json({ error: "Room is finished" }, { status: 409 });
    }
    // Pairs games fix each human to a partnership; seats are not claimed singly.
    if (body.seat !== null && room.mode === "pairs") {
      return NextResponse.json(
        { error: "Seats are fixed in 2-player games" },
        { status: 409 },
      );
    }
    // Spectators may claim a seat after the current hand ends, not mid-hand.
    if (room.status === "active") {
      const active = await getActiveHand(pb, body.roomId);
      if (active) {
        return NextResponse.json(
          { error: "Current hand is still in progress" },
          { status: 409 },
        );
      }
    }

    // Become a spectator.
    if (body.seat === null) {
      const wasSeated = !!seat.seat && !seat.is_spectator;
      const updated = await pb
        .collection("room_seats")
        .update<RoomSeat>(body.seatId, {
          seat: "",
          is_spectator: true,
          ready: false,
        });
      // A seated player stepping out frees their slot; send the room back to
      // the lobby so a spectator can take the seat.
      if (wasSeated && room.status === "active") {
        await pb.collection("rooms").update(room.id, {
          status: "waiting",
          started_at: "",
        });
      }
      return NextResponse.json(toSeat(updated));
    }

    // Claim a concrete seat; it must be free.
    const target = body.seat as Seat;
    const taken = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter(
        "room_id = {:roomId} && seat = {:seat} && is_spectator = false && id != {:seatId}",
        { roomId: body.roomId, seat: target, seatId: body.seatId },
      ),
    });
    if (taken.length > 0) {
      return NextResponse.json(
        { error: "Seat already taken" },
        { status: 409 },
      );
    }

    const updated = await pb
      .collection("room_seats")
      .update<RoomSeat>(body.seatId, {
        seat: target,
        is_spectator: false,
        ready: false,
      });
    return NextResponse.json(toSeat(updated));
  } catch (err) {
    return errorResponse(err);
  }
}

function toSeat(seat: RoomSeat) {
  return {
    seatId: seat.id,
    seat: seat.seat || null,
    isSpectator: seat.is_spectator,
    ready: seat.ready,
  };
}

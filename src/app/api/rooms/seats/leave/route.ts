import { NextResponse } from "next/server";
import { z } from "zod";

import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { softRemoveSeats } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const LeaveSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
});

export async function POST(req: Request) {
  let body: z.infer<typeof LeaveSchema>;
  try {
    body = LeaveSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();

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

    // Soft-leave all of the username's seated records so the whole side steps
    // out to spectator and every slot frees. Other tabs sharing this username
    // reference the same records, so keep them rather than deleting.
    await softRemoveSeats(pb, body.roomId, body.username);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

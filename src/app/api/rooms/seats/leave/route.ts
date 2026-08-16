import { NextResponse } from "next/server";
import { z } from "zod";

import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
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

    // In pairs mode a human owns two records (one partnership); in four mode
    // just one. Soft-leave them all so the whole side steps out to spectator
    // and every slot frees. Other tabs sharing this username reference the
    // same records, so keep them rather than deleting.
    const mine = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter(
        "room_id = {:roomId} && username = {:username} && is_spectator = false",
        { roomId: body.roomId, username: body.username },
      ),
    });
    await Promise.all(
      mine.map((s) =>
        pb.collection("room_seats").update(s.id, {
          seat: "",
          is_spectator: true,
          ready: false,
        }),
      ),
    );

    // Send the room back to the lobby unless a concede already finished it.
    const room = await pb
      .collection("rooms")
      .getOne<{ status: string }>(body.roomId);
    if (room.status !== "finished") {
      await pb.collection("rooms").update(body.roomId, { status: "waiting" });
      const remaining = await pb
        .collection("room_seats")
        .getFullList<RoomSeat>({
          filter: pb.filter("room_id = {:roomId} && is_spectator = false", {
            roomId: body.roomId,
          }),
        });
      await Promise.all(
        remaining.map((s) =>
          pb.collection("room_seats").update(s.id, { ready: false }),
        ),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

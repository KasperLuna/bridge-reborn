import { NextResponse } from "next/server";
import { z } from "zod";

import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const ReadySchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  ready: z.boolean(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof ReadySchema>;
  try {
    body = ReadySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const { room } = await requireSeatedPlayer(pb, body);

    if (room.status === "finished") {
      return NextResponse.json(
        { error: "Room already finished" },
        { status: 409 },
      );
    }

    const updated = await pb
      .collection("room_seats")
      .update<RoomSeat>(body.seatId, { ready: body.ready });

    return NextResponse.json({ seatId: updated.id, ready: updated.ready });
  } catch (err) {
    return errorResponse(err);
  }
}

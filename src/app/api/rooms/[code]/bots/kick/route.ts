import { NextResponse } from "next/server";
import { z } from "zod";

import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { kickBotSeat, requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const KickBotSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  targetUsername: z.string().trim().min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof KickBotSchema>;
  try {
    body = KickBotSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const { room, seat } = await requireSeatedPlayer(pb, body);

    if (room.code !== code) {
      return NextResponse.json({ error: "Room code mismatch" }, { status: 400 });
    }
    if (room.mode !== "four") {
      return NextResponse.json(
        { error: "Bots are only available in 4-player games" },
        { status: 400 },
      );
    }
    if (seat.seat !== "N") {
      return NextResponse.json(
        { error: "Only the room leader can kick bots" },
        { status: 403 },
      );
    }
    if (room.status === "finished") {
      return NextResponse.json({ error: "Room is finished" }, { status: 409 });
    }

    const target = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter(
        "room_id = {:roomId} && username = {:username} && is_bot = true && is_spectator = false",
        { roomId: room.id, username: body.targetUsername },
      ),
    });
    if (target.length === 0) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    await kickBotSeat(pb, room.id, body.targetUsername);

    return NextResponse.json({ ok: true, kicked: body.targetUsername });
  } catch (err) {
    return errorResponse(err);
  }
}
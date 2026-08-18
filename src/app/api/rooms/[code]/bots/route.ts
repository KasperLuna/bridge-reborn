import { NextResponse } from "next/server";
import { z } from "zod";

import { BOT_NAMES } from "@/lib/game/bot";
import type { Seat } from "@/lib/game/types";
import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const SEAT_ORDER: Seat[] = ["N", "S", "E", "W"];

const AddBotSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  seat: z.enum(["N", "S", "E", "W"]).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof AddBotSchema>;
  try {
    body = AddBotSchema.parse(await req.json());
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
        { error: "Only the room leader can add bots" },
        { status: 403 },
      );
    }
    if (room.status === "finished") {
      return NextResponse.json({ error: "Room is finished" }, { status: 409 });
    }

    const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
    });
    const taken = new Set(
      seats.filter((s) => !s.is_spectator && s.seat).map((s) => s.seat),
    );
    const target = body.seat ?? SEAT_ORDER.find((s) => !taken.has(s));
    if (!target || taken.has(target)) {
      return NextResponse.json({ error: "No free seat for a bot" }, { status: 409 });
    }

    const bot = await pb.collection("room_seats").create<RoomSeat>({
      room_id: room.id,
      username: BOT_NAMES[target],
      seat: target,
      is_spectator: false,
      is_bot: true,
      ready: true,
      joined_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, seat: bot });
  } catch (err) {
    return errorResponse(err);
  }
}
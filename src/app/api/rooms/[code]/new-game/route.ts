import { NextResponse } from "next/server";
import { z } from "zod";

import type { Hand } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { runBotTurns } from "@/server/bots";
import {
  createHand,
  getSeatedPlayers,
  requireSeatedPlayer,
} from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const NewGameSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof NewGameSchema>;
  try {
    body = NewGameSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const { room } = await requireSeatedPlayer(pb, body);

    if (room.code !== code) {
      return NextResponse.json(
        { error: "Room code mismatch" },
        { status: 400 },
      );
    }
    if (room.status !== "active") {
      return NextResponse.json(
        { error: "Room is not in an active game" },
        { status: 409 },
      );
    }

    // The current hand must be over before starting the next game.
    const hands = await pb.collection("hands").getList<Hand>(1, 1, {
      filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      sort: "-created",
    });
    const hand = hands.items[0];
    if (!hand || !hand.ended_at) {
      return NextResponse.json(
        { error: "Current hand is still in progress" },
        { status: 409 },
      );
    }

    const players = await getSeatedPlayers(pb, room.id);
    if (players.length !== 4) {
      return NextResponse.json(
        { error: "Need 4 seated players" },
        { status: 409 },
      );
    }

    const created = await createHand(pb, room, players);

    // The opener may be a bot (solo quick games); let it act immediately.
    await runBotTurns(pb, created.id);

    return NextResponse.json({ ok: true, handId: created.id });
  } catch (err) {
    return errorResponse(err);
  }
}

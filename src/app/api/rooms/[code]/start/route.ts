import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/server/errors";
import { runBotTurns } from "@/server/bots";
import {
  createHand,
  getSeatedPlayers,
  requireSeatedPlayer,
} from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const StartSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof StartSchema>;
  try {
    body = StartSchema.parse(await req.json());
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
    if (room.status === "finished") {
      return NextResponse.json(
        { error: "Room already finished" },
        { status: 409 },
      );
    }
    // Idempotent: concurrent starts from seat N resolve to a single game.
    if (room.status === "active") {
      return NextResponse.json({ ok: true });
    }

    const players = await getSeatedPlayers(pb, room.id);
    if (players.length !== 4) {
      return NextResponse.json(
        { error: "Need 4 seated players" },
        { status: 409 },
      );
    }

    const hand = await createHand(pb, room, players);

    await pb.collection("rooms").update(room.id, {
      status: "active",
      started_at: new Date().toISOString(),
    });

    // The opener may be a bot (four-mode rooms with fill bots); let it act.
    await runBotTurns(pb, hand.id);

    return NextResponse.json({ ok: true, handId: hand.id });
  } catch (err) {
    return errorResponse(err);
  }
}

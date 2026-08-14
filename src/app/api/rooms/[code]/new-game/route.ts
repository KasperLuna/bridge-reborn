import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveRuleset } from "@/lib/rulesets";
import type { Game, Hand } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import {
  createGameWithHand,
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
    const games = await pb.collection("games").getList<Game>(1, 1, {
      filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      sort: "-game_number",
    });
    const game = games.items[0];
    if (!game) {
      return NextResponse.json(
        { error: "No game in progress" },
        { status: 404 },
      );
    }
    const hands = await pb.collection("hands").getList<Hand>(1, 1, {
      filter: pb.filter("game_id = {:gameId}", { gameId: game.id }),
      sort: "-hand_number",
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

    const ruleset = resolveRuleset(room.ruleset);
    const created = await createGameWithHand(pb, room, players, ruleset);

    return NextResponse.json({
      ok: true,
      gameId: created.game.id,
      handId: created.hand.id,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { opponentsOf, partnershipOf } from "@/lib/game/seats";
import type { Hand } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer, seatOf } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const ConcedeSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  action: z.enum(["concede", "leave"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: handId } = await ctx.params;

  let body: z.infer<typeof ConcedeSchema>;
  try {
    body = ConcedeSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const { seat } = await requireSeatedPlayer(pb, body);

    let hand: Hand;
    try {
      hand = await pb.collection("hands").getOne<Hand>(handId);
    } catch {
      return NextResponse.json({ error: "Hand not found" }, { status: 404 });
    }
    if (hand.ended_at) {
      return NextResponse.json(
        { error: "Hand already ended" },
        { status: 409 },
      );
    }

    if (hand.room_id !== body.roomId) {
      return NextResponse.json({ error: "Room mismatch" }, { status: 400 });
    }

    const side = partnershipOf(seatOf(seat));
    const winnerSide = opponentsOf(side);
    const endedAt = new Date().toISOString();
    // hands.end_reason accepts "conceded" | "left" | "completed" (see pb_schema.json).
    const endReason = body.action === "concede" ? "conceded" : "left";

    await pb.collection("hands").update(hand.id, {
      ended_at: endedAt,
      winner_side: winnerSide,
      end_reason: endReason,
    });
    await pb.collection("rooms").update(body.roomId, {
      status: "finished",
      ended_at: endedAt,
    });

    return NextResponse.json({ ok: true, winnerSide, reason: endReason });
  } catch (err) {
    return errorResponse(err);
  }
}

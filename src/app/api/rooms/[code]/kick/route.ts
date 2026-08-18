import { NextResponse } from "next/server";
import { z } from "zod";

import { KICK_VOTE_WINDOW_MS, isExpired, shouldPass } from "@/lib/kick";
import type { KickVote, RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer, softRemoveSeats } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const KickSchema = z.object({
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

  let body: z.infer<typeof KickSchema>;
  try {
    body = KickSchema.parse(await req.json());
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
    if (room.mode !== "four") {
      return NextResponse.json(
        { error: "Vote kick is only available in 4-player games" },
        { status: 400 },
      );
    }

    const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
    });
    const seatedHumans = seats.filter(
      (s) => !s.is_spectator && s.seat && !s.is_bot,
    );
    const target = seatedHumans.find((s) => s.username === body.targetUsername);
    if (!target) {
      return NextResponse.json(
        { error: "Target player not found" },
        { status: 404 },
      );
    }
    if (body.targetUsername === body.username) {
      return NextResponse.json(
        { error: "You cannot kick yourself" },
        { status: 400 },
      );
    }

    // Clear expired open votes and resolved (passed) votes, then reject while
    // any unexpired open vote remains.
    const [open, passed] = await Promise.all([
      pb.collection("kick_votes").getFullList<KickVote>({
        filter: pb.filter('room_id = {:roomId} && status = "open"', {
          roomId: room.id,
        }),
      }),
      pb.collection("kick_votes").getFullList<KickVote>({
        filter: pb.filter('room_id = {:roomId} && status = "passed"', {
          roomId: room.id,
        }),
      }),
    ]);
    const now = Date.now();
    await Promise.all(
      [...open.filter((v) => isExpired(v.expires_at, now)), ...passed].map(
        (v) => pb.collection("kick_votes").delete(v.id),
      ),
    );
    if (open.some((v) => !isExpired(v.expires_at, now))) {
      return NextResponse.json(
        { error: "A kick vote is already in progress" },
        { status: 409 },
      );
    }

    const vote = await pb.collection("kick_votes").create<KickVote>({
      room_id: room.id,
      target_username: body.targetUsername,
      initiator_username: body.username,
      votes_yes: [body.username],
      votes_no: [],
      status: "open",
      expires_at: new Date(now + KICK_VOTE_WINDOW_MS).toISOString(),
    });

    // Initiation counts as the initiator's yes; if that alone passes the
    // strict-majority threshold (targets can't vote), the kick lands immediately.
    if (shouldPass(vote.votes_yes, seatedHumans.length - 1)) {
      await softRemoveSeats(pb, room.id, body.targetUsername);
      await pb.collection("kick_votes").update(vote.id, { status: "passed" });
      return NextResponse.json({ ok: true, kicked: body.targetUsername });
    }

    return NextResponse.json({ ok: true, vote });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { isExpired, shouldPass } from "@/lib/kick";
import type { KickVote, RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer, softRemoveSeats } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const KickVoteSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  voteId: z.string().min(1),
  yes: z.boolean(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof KickVoteSchema>;
  try {
    body = KickVoteSchema.parse(await req.json());
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

    let vote: KickVote;
    try {
      vote = await pb.collection("kick_votes").getOne<KickVote>(body.voteId);
    } catch {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }
    if (vote.room_id !== room.id) {
      return NextResponse.json(
        { error: "Vote does not belong to this room" },
        { status: 400 },
      );
    }
    if (vote.status !== "open") {
      return NextResponse.json({ error: "Vote not open" }, { status: 400 });
    }

    const now = Date.now();
    if (isExpired(vote.expires_at, now)) {
      await pb.collection("kick_votes").delete(vote.id);
      return NextResponse.json({ error: "Vote expired" }, { status: 409 });
    }

    const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
    });
    const seatedHumans = seats.filter(
      (s) => !s.is_spectator && s.seat && !s.is_bot,
    );
    if (!seatedHumans.some((s) => s.username === body.username)) {
      return NextResponse.json(
        { error: "Spectators cannot vote" },
        { status: 403 },
      );
    }
    if (body.username === vote.target_username) {
      return NextResponse.json(
        { error: "The target cannot vote" },
        { status: 403 },
      );
    }
    if (
      vote.votes_yes.includes(body.username) ||
      (vote.votes_no ?? []).includes(body.username)
    ) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    const votesYes = body.yes
      ? [...vote.votes_yes, body.username]
      : vote.votes_yes;
    const votesNo = body.yes
      ? (vote.votes_no ?? [])
      : [...(vote.votes_no ?? []), body.username];

    const updated = await pb
      .collection("kick_votes")
      .update<KickVote>(vote.id, { votes_yes: votesYes, votes_no: votesNo });

    if (body.yes && shouldPass(updated.votes_yes, seatedHumans.length)) {
      await softRemoveSeats(pb, room.id, vote.target_username);
      await pb.collection("kick_votes").update(vote.id, { status: "passed" });
      return NextResponse.json({ ok: true, kicked: vote.target_username });
    }

    return NextResponse.json({ ok: true, vote: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

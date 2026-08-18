import { NextResponse } from "next/server";
import { z } from "zod";

import { BOT_NAMES } from "@/lib/game/bot";
import { DEFAULT_RULESET_ID, getPreset } from "@/lib/rulesets";
import type { Room, RoomSeat, Session } from "@/lib/types";
import { runBotTurns } from "@/server/bots";
import { errorResponse } from "@/server/errors";
import { createHand } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++)
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

const QuickSchema = z.object({
  mode: z.enum(["solo", "pairs"]),
  username: z.string().trim().min(1, "Username required").max(40),
});

export async function POST(req: Request) {
  let body: z.infer<typeof QuickSchema>;
  try {
    body = QuickSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const room = await pb.collection("rooms").create<Room>({
      code: randomCode(),
      status: body.mode === "solo" ? "active" : "waiting",
      mode: body.mode,
      ruleset: getPreset(DEFAULT_RULESET_ID),
      started_at: body.mode === "solo" ? new Date().toISOString() : "",
      joinable: body.mode === "solo" ? false : true,
      privacy: "public",
      password_hash: "",
    });

    const primarySeat = body.mode === "solo" ? "N" : "N";
    let primary: RoomSeat;
    if (body.mode === "solo") {
      // Human on N, bots on E/S/W, all seated and ready.
      const created = await pb.collection("room_seats").create<RoomSeat>({
        room_id: room.id,
        username: body.username,
        seat: primarySeat,
        is_spectator: false,
        is_bot: false,
        joined_at: new Date().toISOString(),
      });
      primary = created;
      await Promise.all(
        ["S", "E", "W"].map((seat) =>
          pb.collection("room_seats").create<RoomSeat>({
            room_id: room.id,
            username: BOT_NAMES[seat],
            seat,
            is_spectator: false,
            is_bot: true,
            joined_at: new Date().toISOString(),
          }),
        ),
      );
    } else {
      // Pairs: this human owns the whole NS side.
      const seats = await Promise.all(
        ["N", "S"].map((seat) =>
          pb.collection("room_seats").create<RoomSeat>({
            room_id: room.id,
            username: body.username,
            seat,
            is_spectator: false,
            is_bot: false,
            joined_at: new Date().toISOString(),
          }),
        ),
      );
      primary = seats[0]!;
    }

    const session: Session = {
      username: body.username,
      code: room.code,
      roomId: room.id,
      seatId: primary.id,
      seat: (primary.seat || null) as Session["seat"],
      isSpectator: false,
    };

    if (body.mode === "solo") {
      const seated = await pb.collection("room_seats").getFullList<RoomSeat>({
        filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
      });
      const players = seated.filter((s) => !s.is_spectator && s.seat);
      const hand = await createHand(pb, room, players);
      await runBotTurns(pb, hand.id);
    }

    return NextResponse.json(session);
  } catch (err) {
    return errorResponse(err);
  }
}

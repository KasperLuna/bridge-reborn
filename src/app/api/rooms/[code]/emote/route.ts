import { NextResponse } from "next/server";
import { z } from "zod";

import type { RoomSeat } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

/** Minimum time between emotes per seat (spam gate). */
const EMOTE_THROTTLE_MS = 1000;

/** One emoji (allows multi-codepoint: skin tones, ZWJ families), capped at 8 chars. */
const EmojiSchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .refine((s) => /\p{Extended_Pictographic}/u.test(s), {
    message: "Not an emoji",
  });

const EmoteSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  emote: EmojiSchema,
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof EmoteSchema>;
  try {
    body = EmoteSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const pb = await getAdminClient();
    const { room, seat } = await requireSeatedPlayer(pb, body);

    if (room.code !== code) {
      return NextResponse.json(
        { error: "Room code mismatch" },
        { status: 400 },
      );
    }

    if (seat.emote_at) {
      const last = Date.parse(seat.emote_at);
      if (!Number.isNaN(last) && Date.now() - last < EMOTE_THROTTLE_MS) {
        return NextResponse.json(
          { error: "Too many emotes" },
          { status: 429 },
        );
      }
    }

    const updated = await pb.collection("room_seats").update<RoomSeat>(seat.id, {
      last_emote: body.emote,
      emote_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, emote: updated.last_emote });
  } catch (err) {
    return errorResponse(err);
  }
}

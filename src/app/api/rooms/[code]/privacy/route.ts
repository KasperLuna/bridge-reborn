import { NextResponse } from "next/server";
import { z } from "zod";

import type { Room } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";
import { hashPassword } from "@/server/room-password";

const PrivacySchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  privacy: z.enum(["public", "private"]),
  password: z.string().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof PrivacySchema>;
  try {
    body = PrivacySchema.parse(await req.json());
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
    if (room.status !== "waiting") {
      return NextResponse.json(
        { error: "Privacy can only be changed before the game starts" },
        { status: 409 },
      );
    }

    let passwordHash = "";
    if (body.privacy === "private") {
      if (!body.password) {
        return NextResponse.json(
          { error: "Password required" },
          { status: 400 },
        );
      }
      if (body.password.length < 4) {
        return NextResponse.json(
          { error: "Password must be at least 4 characters" },
          { status: 400 },
        );
      }
      passwordHash = hashPassword(body.password);
    }

    const updated = await pb.collection("rooms").update<Room>(room.id, {
      privacy: body.privacy,
      password_hash: passwordHash,
    });

    return NextResponse.json({ ok: true, room: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

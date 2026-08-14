import { NextResponse } from "next/server";
import { z } from "zod";

import { applyOverrides, getPreset } from "@/lib/rulesets";
import type { RulesetOverrides } from "@/lib/rulesets";
import { errorResponse } from "@/server/errors";
import { requireSeatedPlayer } from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const RulesetSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  presetId: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  let body: z.infer<typeof RulesetSchema>;
  try {
    body = RulesetSchema.parse(await req.json());
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
        { error: "Ruleset can only be changed before the game starts" },
        { status: 409 },
      );
    }

    const ruleset = applyOverrides(
      getPreset(body.presetId),
      body.overrides as RulesetOverrides | undefined,
    );

    await pb.collection("rooms").update(room.id, { ruleset });

    return NextResponse.json({ ok: true, ruleset });
  } catch (err) {
    return errorResponse(err);
  }
}

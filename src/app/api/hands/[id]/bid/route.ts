import { NextResponse } from "next/server";
import { z } from "zod";

import type { AuctionEntry } from "@/lib/game/bidding";
import {
  bidValue,
  declarerSeat,
  declarerUsername,
  finalContract,
  isAuctionComplete,
  legalCalls,
  parseAuctionCall,
} from "@/lib/game/bidding";
import {
  partnershipOf,
  rotateFrom,
  seatOfUsername,
  usernameForSeat,
} from "@/lib/game/seats";
import { resolveRuleset } from "@/lib/rulesets";
import type { BidRecord, ContractRecord, Game, Hand } from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { runBotTurns } from "@/server/bots";
import {
  gamePlayers,
  openerSeat,
  requireSeatedPlayer,
  seatOf,
  unreadyRoomPlayers,
} from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const BidSchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  call: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^(P|X|XX|[1-7](NT|[CDHS]))$/.test(v), "Invalid call"),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: handId } = await ctx.params;

  let body: z.infer<typeof BidSchema>;
  try {
    body = BidSchema.parse(await req.json());
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
        { error: "Hand already finished" },
        { status: 409 },
      );
    }

    const game = await pb.collection("games").getOne<Game>(hand.game_id);
    if (game.room_id !== body.roomId) {
      return NextResponse.json({ error: "Room mismatch" }, { status: 400 });
    }

    const room = await pb
      .collection("rooms")
      .getOne<{ ruleset: unknown }>(game.room_id);
    const ruleset = resolveRuleset(room.ruleset);

    const bids = await pb.collection("bids").getFullList<BidRecord>({
      filter: pb.filter("hand_id = {:handId}", { handId }),
      sort: "sequence_position",
    });

    const opener = openerSeat(ruleset, hand);
    if (!opener) {
      return NextResponse.json({ error: "Deal missing 2C" }, { status: 500 });
    }

    // Turn order starts at the opener and rotates per bid.
    const players = gamePlayers(game);
    const expectedSeat = rotateFrom(opener, bids.length);
    const expectedUsername = usernameForSeat(players, expectedSeat);
    if (body.username !== expectedUsername) {
      return NextResponse.json(
        { error: `Not your turn. Expected ${expectedUsername}` },
        { status: 409 },
      );
    }

    const entries: AuctionEntry[] = bids.map((b) => {
      const bSeat = seatOfUsername(players, b.username) ?? expectedSeat;
      return { call: b.call, username: b.username, side: partnershipOf(bSeat) };
    });
    const actorSide = partnershipOf(seatOf(seat));
    const legal = legalCalls(entries, actorSide, ruleset.bidding);
    const call = parseAuctionCall(body.call);

    if (call.kind === "double" && !legal.canDouble) {
      return NextResponse.json(
        { error: "Double not allowed" },
        { status: 409 },
      );
    }
    if (call.kind === "redouble" && !legal.canRedouble) {
      return NextResponse.json(
        { error: "Redouble must follow an opponent double" },
        { status: 409 },
      );
    }
    if (call.kind === "bid") {
      const value = bidValue(call.level, call.strain);
      if (
        !legal.canBid ||
        (legal.minBidValue !== null && value < legal.minBidValue)
      ) {
        return NextResponse.json(
          { error: "Bid must outrank previous bid" },
          { status: 409 },
        );
      }
    }

    await pb.collection("bids").create<BidRecord>({
      hand_id: handId,
      username: body.username,
      sequence_position: bids.length + 1,
      call: body.call,
      hcp_held: 0,
    });

    // Auction may have just ended.
    const nextEntries: AuctionEntry[] = [
      ...entries,
      { call: body.call, username: body.username, side: actorSide },
    ];
    let out: Record<string, unknown> = { ok: true };
    if (isAuctionComplete(nextEntries)) {
      const contract = finalContract(nextEntries);
      if (!contract) {
        // Passed out: no contract, no score. Close the hand and reset ready.
        await pb.collection("hands").update(handId, {
          ended_at: new Date().toISOString(),
        });
        await unreadyRoomPlayers(pb, game.room_id);
        out = { ok: true, passedOut: true };
      } else {
        // Create the contract once (guard against concurrent duplicate).
        const existing = await pb
          .collection("contracts")
          .getList<ContractRecord>(1, 1, {
            filter: pb.filter("hand_id = {:handId}", { handId }),
          });
        if (existing.items.length === 0) {
          const declarer = declarerSeat(nextEntries, opener);
          await pb.collection("contracts").create<ContractRecord>({
            hand_id: handId,
            declarer_username: declarerUsername(nextEntries)!,
            declarer_seat: declarer ?? expectedSeat,
            level: String(contract.level),
            strain: contract.strain,
            doubled: contract.doubled,
            redoubled: contract.redoubled,
          });
        }
      }
    }

    // Drive any bots that are now due (they may continue into the play phase).
    if (!seat.is_bot) await runBotTurns(pb, handId);
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}

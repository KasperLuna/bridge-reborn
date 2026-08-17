import { NextResponse } from "next/server";
import { z } from "zod";

import { cardSuit } from "@/lib/game/cards";
import {
  leftOf,
  partnershipOf,
  rotateFrom,
  seatOfUsername,
  usernameForSeat,
} from "@/lib/game/seats";
import type { Seat } from "@/lib/game/types";
import { isHandOver, trickWinner } from "@/lib/game/trick";
import type { TrickPlay } from "@/lib/game/trick";
import type { Partnership } from "@/lib/game/types";
import { resolveRuleset } from "@/lib/rulesets";
import type {
  ContractRecord,
  Game,
  Hand,
  HandResultRecord,
  PlayRecord,
  TrickRecord,
} from "@/lib/types";
import { errorResponse } from "@/server/errors";
import { runBotTurns } from "@/server/bots";
import {
  gamePlayers,
  requireSeatedPlayer,
  seatOf,
  unreadyRoomPlayers,
} from "@/server/helpers";
import { getAdminClient } from "@/server/pb";

const PlaySchema = z.object({
  roomId: z.string().min(1),
  seatId: z.string().min(1),
  username: z.string().trim().min(1),
  card: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[2-9TJQKA][CDHS]$/.test(v), "Invalid card"),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: handId } = await ctx.params;

  let body: z.infer<typeof PlaySchema>;
  try {
    body = PlaySchema.parse(await req.json());
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

    let contract: ContractRecord;
    try {
      contract = await pb
        .collection("contracts")
        .getFirstListItem<ContractRecord>(
          pb.filter("hand_id = {:handId}", { handId }),
        );
    } catch {
      return NextResponse.json({ error: "No contract yet" }, { status: 409 });
    }

    const players = gamePlayers(game);
    const declarerSeat =
      (contract.declarer_seat as Seat | undefined) ??
      seatOfUsername(players, contract.declarer_username);
    if (!declarerSeat) {
      return NextResponse.json(
        { error: "Cannot map declarer seat" },
        { status: 500 },
      );
    }

    // Find or create the open trick.
    const tricks = await pb.collection("tricks").getFullList<TrickRecord>({
      filter: pb.filter("hand_id = {:handId}", { handId }),
      sort: "trick_number",
    });
    const lastTrick = tricks.at(-1) ?? null;
    let currentTrick: TrickRecord;
    if (lastTrick && !lastTrick.winner_username) {
      currentTrick = lastTrick;
    } else {
      const leaderSeat: Seat =
        (lastTrick?.winner_seat as Seat | undefined) ?? leftOf(declarerSeat);
      currentTrick = await pb.collection("tricks").create<TrickRecord>({
        hand_id: handId,
        trick_number: lastTrick ? lastTrick.trick_number + 1 : 1,
        leader_username: usernameForSeat(players, leaderSeat),
        leader_seat: leaderSeat,
      });
    }

    const trickPlays = await pb.collection("plays").getFullList<PlayRecord>({
      filter: pb.filter("hand_id = {:handId} && trick_id = {:trickId}", {
        handId,
        trickId: currentTrick.id,
      }),
      sort: "play_sequence",
    });
    if (trickPlays.length >= 4) {
      return NextResponse.json(
        { error: "Trick already complete" },
        { status: 409 },
      );
    }

    // Turn check.
    const leaderSeat =
      (currentTrick.leader_seat as Seat | undefined) ??
      seatOfUsername(players, currentTrick.leader_username);
    if (!leaderSeat) {
      return NextResponse.json(
        { error: "Cannot map trick leader" },
        { status: 500 },
      );
    }
    const expectedSeat = rotateFrom(leaderSeat, trickPlays.length);
    const expectedUsername = usernameForSeat(players, expectedSeat);
    if (body.username !== expectedUsername) {
      return NextResponse.json(
        { error: `Not your turn. Expected ${expectedUsername}` },
        { status: 409 },
      );
    }

    const playerSeat = seatOf(seat);

    // Card ownership.
    const playedByMe = await pb.collection("plays").getFullList<PlayRecord>({
      filter: pb.filter("hand_id = {:handId} && username = {:username}", {
        handId,
        username: body.username,
      }),
    });
    const remaining = new Set(hand.deal[playerSeat] ?? []);
    for (const p of playedByMe) remaining.delete(p.card);

    if (!remaining.has(body.card)) {
      return NextResponse.json(
        { error: "Card not in your hand" },
        { status: 409 },
      );
    }

    // Follow suit.
    if (ruleset.play.mustFollowSuit && trickPlays.length > 0) {
      const ledSuit = cardSuit(trickPlays[0]!.card);
      if (cardSuit(body.card) !== ledSuit) {
        const hasLedSuit = [...remaining].some((c) => cardSuit(c) === ledSuit);
        if (hasLedSuit) {
          return NextResponse.json(
            { error: "Must follow suit" },
            { status: 409 },
          );
        }
      }
    }

    await pb.collection("plays").create<PlayRecord>({
      trick_id: currentTrick.id,
      hand_id: handId,
      username: body.username,
      seat: playerSeat,
      play_sequence: trickPlays.length + 1,
      card: body.card,
    });

    // Trick completed?
    if (trickPlays.length + 1 === 4) {
      const allPlays: TrickPlay[] = [
        ...trickPlays.map((p) => {
          const s =
            (p.seat as Seat | undefined) ??
            seatOfUsername(players, p.username)!;
          return { card: p.card, seat: s };
        }),
        { card: body.card, seat: playerSeat },
      ];

      const winner = trickWinner(allPlays, contract.strain);
      await pb.collection("tricks").update(currentTrick.id, {
        winner_username: usernameForSeat(players, winner),
        winner_seat: winner,
      });

      await maybeFinishHand(partnershipOf(declarerSeat));
    }

    // Drive any bots that are now due (new trick, trick win, or hand end).
    if (!seat.is_bot) await runBotTurns(pb, handId);
    return NextResponse.json({ ok: true });

    async function maybeFinishHand(declarerSide: Partnership) {
      const allTricks = await pb.collection("tricks").getFullList<TrickRecord>({
        filter: pb.filter("hand_id = {:handId}", { handId }),
        sort: "trick_number",
      });

      let nsTricks = 0;
      let ewTricks = 0;
      let completed = 0;
      for (const t of allTricks) {
        if (!t.winner_username) continue;
        completed++;
        const ws =
          (t.winner_seat as Seat | undefined) ??
          seatOfUsername(players, t.winner_username);
        if (!ws) continue;
        if (partnershipOf(ws) === "NS") nsTricks++;
        else ewTricks++;
      }

      const tricksRequired = Number(contract.level) + 6;
      const tricksMade = declarerSide === "NS" ? nsTricks : ewTricks;

      const done = isHandOver({
        endHandEarly: ruleset.play.endHandEarly,
        tricksPlayed: completed,
        tricksRequired,
        declarerTricks: tricksMade,
      });
      if (!done) return;

      // Idempotent scoring: unique constraint on hand_results.hand_id.
      const existing = await pb
        .collection("hand_results")
        .getList<HandResultRecord>(1, 1, {
          filter: pb.filter("hand_id = {:handId}", { handId }),
        });
      if (existing.items.length === 0) {
        try {
          await pb.collection("hand_results").create<HandResultRecord>({
            hand_id: handId,
            contract_id: contract.id,
            tricks_made: tricksMade,
            tricks_required: tricksRequired,
            result_delta: tricksMade - tricksRequired,
          });
        } catch (err) {
          // Concurrent finish: unique hand_id clash means another request won.
          const raced = await pb
            .collection("hand_results")
            .getList<HandResultRecord>(1, 1, {
              filter: pb.filter("hand_id = {:handId}", { handId }),
            });
          if (raced.items.length === 0) {
            throw err;
          }
        }
      }

      const fresh = await pb.collection("hands").getOne<Hand>(handId);
      if (!fresh.ended_at) {
        await pb.collection("hands").update(handId, {
          ended_at: new Date().toISOString(),
        });
        // Reset ready flags so players must re-ready before the next hand.
        await unreadyRoomPlayers(pb, game.room_id);
      }
    }
  } catch (err) {
    return errorResponse(err);
  }
}

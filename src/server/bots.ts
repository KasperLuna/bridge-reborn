import type PocketBase from "pocketbase";

import { chooseBid, choosePlay } from "@/lib/game/bot";
import { partnershipOf, seatOfUsername } from "@/lib/game/seats";
import type { Direction, Seat } from "@/lib/game/types";
import { resolveRuleset } from "@/lib/rulesets";
import type {
  BidRecord,
  ContractRecord,
  Hand,
  PlayRecord,
  Room,
  RoomSeat,
  TrickRecord,
} from "@/lib/types";
import { gamePlayers } from "@/server/helpers";
import {
  bidTurnSeat,
  currentTrick,
  legalBidsForMe,
  legalCardsForMe,
  playTurnSeat,
  trickPlaysFor,
} from "@/store/selectors";

const MAX_BOT_TURNS = 24;

/** Random "thinking" delay before each solo-mode bot move, to keep the game
    paced instead of instant. Pairs/four-mode bots stay instant. */
const SOLO_BOT_DELAY_MIN_MS = 650;
const SOLO_BOT_DELAY_MAX_MS = 1500;

async function botThinkDelay(solo: boolean): Promise<void> {
  if (!solo) return;
  const ms =
    SOLO_BOT_DELAY_MIN_MS +
    Math.random() * (SOLO_BOT_DELAY_MAX_MS - SOLO_BOT_DELAY_MIN_MS);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Drives any bot that is due to act on `hand`, chaining until it's a human's
 * turn (or the hand ends). Called after every human action and after game
 * creation. Moves go through the same route handlers as human moves so all
 * validation, turn checks and scoring stay in one place.
 */
export async function runBotTurns(
  pb: PocketBase,
  handId: string,
): Promise<void> {
  for (let i = 0; i < MAX_BOT_TURNS; i++) {
    if (!(await runOneBotTurn(pb, handId))) return;
  }
}

async function runOneBotTurn(pb: PocketBase, handId: string): Promise<boolean> {
  const hand = await pb.collection("hands").getOne<Hand>(handId);
  if (hand.ended_at) return false;

  const room = await pb.collection("rooms").getOne<Room>(hand.room_id);
  const ruleset = resolveRuleset(room.ruleset);
  const players = gamePlayers(hand);

  const [bids, contract, tricks, plays, seats] = await Promise.all([
    pb.collection("bids").getFullList<BidRecord>({
      filter: pb.filter("hand_id = {:handId}", { handId }),
      sort: "sequence_position",
    }),
    pb
      .collection("contracts")
      .getFirstListItem<ContractRecord>(
        pb.filter("hand_id = {:handId}", { handId }),
      )
      .catch(() => null),
    pb.collection("tricks").getFullList<TrickRecord>({
      filter: pb.filter("hand_id = {:handId}", { handId }),
      sort: "trick_number",
    }),
    pb.collection("plays").getFullList<PlayRecord>({
      filter: pb.filter("hand_id = {:handId}", { handId }),
      sort: "play_sequence",
    }),
    pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter("room_id = {:roomId}", { roomId: hand.room_id }),
    }),
  ]);

  const seatRec = (username: string, seat: Seat): RoomSeat | null =>
    seats.find((s) => s.username === username && s.seat === seat) ?? null;

  const solo = room.mode === "solo";

  if (!contract) {
    const actorSeat = bidTurnSeat(bids, hand, ruleset);
    if (!actorSeat) return false;
    const rec = seatRec(players[actorSeat], actorSeat);
    if (!rec || !rec.is_bot) return false;

    const legal = legalBidsForMe(bids, hand, ruleset, actorSeat);
    const call = chooseBid({
      hand: hand.deal[actorSeat] ?? [],
      entries: bids.map((b) => ({
        call: b.call,
        username: b.username,
        side: partnershipOf(seatOfUsername(players, b.username) ?? actorSeat),
      })),
      side: partnershipOf(actorSeat),
      canBid: legal.canBid,
      minBidValue: legal.minBidValue,
    });
    await botThinkDelay(solo);
    return await applyMove(pb, handId, rec, "bid", call);
  }

  const declarerSeat =
    (contract.declarer_seat as Seat | undefined) ??
    seatOfUsername(players, contract.declarer_username);
  const actorSeat = playTurnSeat(tricks, plays, players, declarerSeat);
  if (!actorSeat) return false;
  const rec = seatRec(players[actorSeat], actorSeat);
  if (!rec || !rec.is_bot) return false;

  const legal = legalCardsForMe(
    hand,
    actorSeat,
    players[actorSeat],
    plays,
    tricks,
    ruleset,
  );
  const trick = currentTrick(tricks);
  const trickPlays = trick
    ? trickPlaysFor(trick.id, plays).map((p) => ({
        card: p.card,
        seat:
          (p.seat as Seat | undefined) ??
          seatOfUsername(players, p.username) ??
          actorSeat,
      }))
    : [];
  const card = choosePlay({
    legal,
    trick: trickPlays,
    mySeat: actorSeat,
    trump: contract.strain,
    side: partnershipOf(actorSeat),
    direction: (contract.direction ?? "high") as Direction,
  });
  await botThinkDelay(solo);
  return await applyMove(pb, handId, rec, "play", card);
}

/** Applies a bot move through the real bid/play route handlers. */
async function applyMove(
  pb: PocketBase,
  handId: string,
  rec: RoomSeat,
  kind: "bid" | "play",
  value: string,
): Promise<boolean> {
  const { POST } =
    kind === "bid"
      ? await import("@/app/api/hands/[id]/bid/route")
      : await import("@/app/api/hands/[id]/play/route");
  const req = new Request(`http://localhost/api/hands/${handId}/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roomId: rec.room_id,
      seatId: rec.id,
      username: rec.username,
      [kind === "bid" ? "call" : "card"]: value,
    }),
  });
  const res = await POST(req, { params: Promise.resolve({ id: handId }) });
  if (!res.ok) {
    // Fail-safe: don't spin if a move is rejected (e.g. auction just ended).
    return false;
  }
  return true;
}

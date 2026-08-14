import type PocketBase from "pocketbase";

import { serverEnv } from "@/env";
import type { Deal, GamePlayers, Seat } from "@/lib/game/types";
import { buildShuffledDeal } from "@/lib/game/cards";
import { resolveOpener } from "@/lib/game/bidding";
import { playersFromUsernames } from "@/lib/game/seats";
import type { Ruleset } from "@/lib/rulesets";
import type { Game, Hand, Room, RoomSeat } from "@/lib/types";

import { ApiError } from "./errors";

export function gamePlayers(game: Game): GamePlayers {
  return playersFromUsernames(game);
}

export function seatOf(seat: RoomSeat): Seat {
  return seat.seat as Seat;
}

/** Who opens the auction, per ruleset. */
export function openerSeat(ruleset: Ruleset, hand: Hand): Seat | null {
  return resolveOpener(ruleset.openerRule, hand.deal, hand.dealer);
}

export async function getRoom(pb: PocketBase, roomId: string): Promise<Room> {
  try {
    return await pb.collection("rooms").getOne<Room>(roomId);
  } catch {
    throw new ApiError(404, "Room not found");
  }
}

export async function getRoomByCode(
  pb: PocketBase,
  code: string,
): Promise<Room | null> {
  try {
    return await pb
      .collection("rooms")
      .getFirstListItem<Room>(pb.filter("code = {:code}", { code }));
  } catch {
    return null;
  }
}

/** Validates a session against its seat record; requires a seated (non-spectator) player. */
export async function requireSeatedPlayer(
  pb: PocketBase,
  s: { roomId: string; seatId: string; username: string },
): Promise<{ seat: RoomSeat; room: Room }> {
  const room = await getRoom(pb, s.roomId);
  let seat: RoomSeat;
  try {
    seat = await pb.collection("room_seats").getOne<RoomSeat>(s.seatId);
  } catch {
    throw new ApiError(404, "Seat record not found");
  }
  if (seat.room_id !== s.roomId || seat.username !== s.username) {
    throw new ApiError(403, "Not allowed");
  }
  if (seat.is_spectator || !seat.seat) {
    throw new ApiError(403, "Spectators cannot act");
  }
  return { seat, room };
}

export async function getSeatedPlayers(
  pb: PocketBase,
  roomId: string,
): Promise<RoomSeat[]> {
  const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
    filter: pb.filter("room_id = {:roomId}", { roomId }),
  });
  return seats.filter((s) => !s.is_spectator && s.seat);
}

/** Reset every seated player's ready flag (used when a hand ends). */
export async function unreadyRoomPlayers(
  pb: PocketBase,
  roomId: string,
): Promise<void> {
  const seats = await pb.collection("room_seats").getFullList<RoomSeat>({
    filter: pb.filter("room_id = {:roomId}", { roomId }),
  });
  await Promise.all(
    seats
      .filter((s) => !s.is_spectator && s.seat)
      .map((s) => pb.collection("room_seats").update(s.id, { ready: false })),
  );
}

/** Latest unfinished hand for the room, or null. */
export async function getActiveHand(
  pb: PocketBase,
  roomId: string,
): Promise<Hand | null> {
  try {
    const games = await pb.collection("games").getList<Game>(1, 1, {
      filter: pb.filter("room_id = {:roomId}", { roomId }),
      sort: "-game_number",
    });
    const game = games.items[0];
    if (!game || game.ended_at) return null;
    const hands = await pb.collection("hands").getList<Hand>(1, 1, {
      filter: pb.filter("game_id = {:gameId}", { gameId: game.id }),
      sort: "-hand_number",
    });
    const hand = hands.items[0];
    return hand && !hand.ended_at ? hand : null;
  } catch {
    return null;
  }
}

/** Creates game #n+1 and its first hand. Shared by start and rematch. */
export async function createGameWithHand(
  pb: PocketBase,
  room: Room,
  players: RoomSeat[],
  ruleset: Ruleset,
): Promise<{ game: Game; hand: Hand }> {
  const bySeat = new Map<Seat, RoomSeat>();
  for (const p of players) if (p.seat) bySeat.set(p.seat, p);

  let gameNumber = 1;
  const existing = await pb.collection("games").getList<Game>(1, 1, {
    filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
    sort: "-game_number",
  });
  if (existing.items[0]) gameNumber = existing.items[0].game_number + 1;

  const startedAt = new Date().toISOString();
  const game = await pb.collection("games").create<Game>({
    room_id: room.id,
    game_number: gameNumber,
    north_username: bySeat.get("N")!.username,
    south_username: bySeat.get("S")!.username,
    east_username: bySeat.get("E")!.username,
    west_username: bySeat.get("W")!.username,
    ns_total_score: 0,
    ew_total_score: 0,
    started_at: startedAt,
  });

  const deal = buildShuffledDeal();
  const hand = await pb.collection("hands").create<Hand>({
    game_id: game.id,
    hand_number: 1,
    dealer: "N",
    vulnerability: ruleset.vulnerabilityCycle[0] ?? "none",
    deal,
    started_at: startedAt,
  });

  void solveDoubleDummy(pb, hand, deal);

  return { game, hand };
}

/** Best-effort double-dummy fill; never blocks or fails game creation. */
async function solveDoubleDummy(
  pb: PocketBase,
  hand: Hand,
  deal: Deal,
): Promise<void> {
  const url = serverEnv.DD_SOLVER_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deal }),
    });
    if (!res.ok) return;
    const dd = (await res.json()) as unknown;
    await pb.collection("hands").update(hand.id, { dd_result: dd });
  } catch {
    // best-effort
  }
}

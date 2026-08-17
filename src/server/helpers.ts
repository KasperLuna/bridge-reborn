import type PocketBase from "pocketbase";

import type { GamePlayers, Seat } from "@/lib/game/types";
import { buildShuffledDeal } from "@/lib/game/cards";
import { resolveOpener } from "@/lib/game/bidding";
import { playersFromUsernames } from "@/lib/game/seats";
import type { Ruleset } from "@/lib/rulesets";
import type { Hand, Room, RoomSeat } from "@/lib/types";

import { ApiError } from "./errors";

export function gamePlayers(hand: Hand): GamePlayers {
  return playersFromUsernames(hand);
}

export function seatOf(seat: RoomSeat): Seat {
  return seat.seat as Seat;
}

/** Who opens the auction, per ruleset. Dealer is always N (one hand per game). */
export function openerSeat(ruleset: Ruleset, hand: Hand): Seat | null {
  return resolveOpener(ruleset.openerRule, hand.deal, "N");
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

/** Soft-remove a player: their seated records become spectator records, the
    room drops back to `waiting`, and the remaining seated players unready.
    Shared by leave and vote-kick forced leaves. */
export async function softRemoveSeats(
  pb: PocketBase,
  roomId: string,
  username: string,
): Promise<void> {
  const mine = await pb.collection("room_seats").getFullList<RoomSeat>({
    filter: pb.filter(
      "room_id = {:roomId} && username = {:username} && is_spectator = false",
      { roomId, username },
    ),
  });
  await Promise.all(
    mine.map((s) =>
      pb.collection("room_seats").update(s.id, {
        seat: "",
        is_spectator: true,
        ready: false,
      }),
    ),
  );

  // Send the room back to the lobby unless a concede already finished it.
  const room = await pb.collection("rooms").getOne<{ status: string }>(roomId);
  if (room.status !== "finished") {
    await pb.collection("rooms").update(roomId, { status: "waiting" });
    const remaining = await pb.collection("room_seats").getFullList<RoomSeat>({
      filter: pb.filter("room_id = {:roomId} && is_spectator = false", {
        roomId,
      }),
    });
    await Promise.all(
      remaining.map((s) =>
        pb.collection("room_seats").update(s.id, { ready: false }),
      ),
    );
  }
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
    const hands = await pb.collection("hands").getList<Hand>(1, 1, {
      filter: pb.filter("room_id = {:roomId}", { roomId }),
      sort: "-created",
    });
    const hand = hands.items[0];
    return hand && !hand.ended_at ? hand : null;
  } catch {
    return null;
  }
}

/** Creates a new hand (one per game). Shared by start and rematch. */
export async function createHand(
  pb: PocketBase,
  room: Room,
  players: RoomSeat[],
): Promise<Hand> {
  const bySeat = new Map<Seat, RoomSeat>();
  for (const p of players) if (p.seat) bySeat.set(p.seat, p);

  const startedAt = new Date().toISOString();
  const hand = await pb.collection("hands").create<Hand>({
    room_id: room.id,
    north_username: bySeat.get("N")!.username,
    south_username: bySeat.get("S")!.username,
    east_username: bySeat.get("E")!.username,
    west_username: bySeat.get("W")!.username,
    deal: buildShuffledDeal(),
    started_at: startedAt,
  });

  return hand;
}

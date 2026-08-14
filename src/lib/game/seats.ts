import type { GamePlayers, Partnership, Seat } from "./types";

export const SEATS: Seat[] = ["N", "E", "S", "W"];

export function nextSeat(seat: Seat): Seat {
  const i = (SEATS.indexOf(seat) + 1) % 4;
  return SEATS[i]!;
}

/** The player physically to the left of `seat` (clockwise turn order). */
export const leftOf = nextSeat;

/** `n` seats clockwise from `seat`. */
export function rotateFrom(seat: Seat, n: number): Seat {
  const i = (((SEATS.indexOf(seat) + n) % 4) + 4) % 4;
  return SEATS[i]!;
}

export function partnershipOf(seat: Seat): Partnership {
  return seat === "N" || seat === "S" ? "NS" : "EW";
}

export function opponentsOf(partnership: Partnership): Partnership {
  return partnership === "NS" ? "EW" : "NS";
}

export function usernameForSeat(players: GamePlayers, seat: Seat): string {
  return players[seat];
}

export function seatOfUsername(
  players: GamePlayers,
  username: string,
): Seat | null {
  for (const seat of SEATS) {
    if (players[seat] === username) return seat;
  }
  return null;
}

export type SeatUsernames = {
  north_username: string;
  south_username: string;
  east_username: string;
  west_username: string;
};

/** Builds the seat -> username map from a game-like record. */
export function playersFromUsernames(g: SeatUsernames): GamePlayers {
  return {
    N: g.north_username,
    S: g.south_username,
    E: g.east_username,
    W: g.west_username,
  };
}

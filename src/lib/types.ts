import type {
  Deal,
  Partnership,
  Seat,
  Strain,
  Vulnerability,
} from "@/lib/game/types";

export type RoomStatus = "waiting" | "active" | "finished";

/** `four` = 4 humans, one seat each. `pairs` = 2 humans, one partnership
    each. `solo` = 1 human + 3 bot seats. */
export type RoomMode = "four" | "pairs" | "solo";

export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  mode: RoomMode;
  ruleset: unknown;
  started_at: string;
  ended_at: string;
  privacy: "public" | "private";
  password_hash: string;
  joinable: boolean;
  created: string;
  updated: string;
};

/** One seat record per (room, username). `seat` is `""` for spectators. In
    `pairs` mode a human owns two records (both seats of one partnership). */
export type RoomSeat = {
  id: string;
  room_id: string;
  username: string;
  seat: Seat | "";
  is_spectator: boolean;
  is_bot: boolean;
  ready: boolean;
  joined_at: string;
  created: string;
  updated: string;
};

/** A vote to kick a seated player out of a `four` mode room. */
export type KickVote = {
  id: string;
  room_id: string;
  target_username: string;
  initiator_username: string;
  votes_yes: string[];
  votes_no: string[];
  status: "open" | "passed";
  expires_at: string;
  created: string;
  updated: string;
};

export type Game = {
  id: string;
  room_id: string;
  game_number: number;
  north_username: string;
  south_username: string;
  east_username: string;
  west_username: string;
  started_at: string;
  ended_at: string;
  winner_side: Partnership | "";
  end_reason: string;
  created: string;
  updated: string;
};

export type Hand = {
  id: string;
  game_id: string;
  hand_number: number;
  dealer: Seat;
  vulnerability: Vulnerability;
  deal: Deal;
  dd_result: unknown;
  started_at: string;
  ended_at: string;
  created: string;
  updated: string;
};

export type BidRecord = {
  id: string;
  hand_id: string;
  username: string;
  sequence_position: number;
  call: string;
  hcp_held: number;
  created: string;
  updated: string;
};

export type ContractRecord = {
  id: string;
  hand_id: string;
  declarer_username: string;
  /** The declarer's seat (explicit — usernames can own two seats in pairs mode). */
  declarer_seat: Seat;
  level: string;
  strain: Strain;
  doubled: boolean;
  redoubled: boolean;
  created: string;
  updated: string;
};

export type TrickRecord = {
  id: string;
  hand_id: string;
  trick_number: number;
  leader_username: string;
  /** The seat that led this trick (explicit — usernames own two seats in pairs). */
  leader_seat: Seat;
  winner_username: string;
  /** The seat that won this trick (explicit, so the next leader is exact). */
  winner_seat: Seat;
  created: string;
  updated: string;
};

export type PlayRecord = {
  id: string;
  trick_id: string;
  hand_id: string;
  username: string;
  /** The seat that played (explicit — usernames own two seats in pairs). */
  seat: Seat;
  play_sequence: number;
  card: string;
  created: string;
  updated: string;
};

export type HandResultRecord = {
  id: string;
  hand_id: string;
  contract_id: string;
  tricks_made: number;
  tricks_required: number;
  result_delta: number;
  ns_score: number;
  ew_score: number;
  ns_imp_delta: number;
  ew_imp_delta: number;
  created: string;
  updated: string;
};

export type Session = {
  username: string;
  roomId: string;
  code: string;
  seatId: string;
  seat: Seat | null;
  isSpectator: boolean;
};

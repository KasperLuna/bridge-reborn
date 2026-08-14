import type {
  Deal,
  Partnership,
  Seat,
  Strain,
  Vulnerability,
} from "@/lib/game/types";

export type RoomStatus = "waiting" | "active" | "finished";

export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  ruleset: unknown;
  started_at: string;
  ended_at: string;
  created: string;
  updated: string;
};

/** One seat record per (room, username). `seat` is `""` for spectators. */
export type RoomSeat = {
  id: string;
  room_id: string;
  username: string;
  seat: Seat | "";
  is_spectator: boolean;
  ready: boolean;
  joined_at: string;
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
  ns_total_score: number;
  ew_total_score: number;
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
  winner_username: string;
  created: string;
  updated: string;
};

export type PlayRecord = {
  id: string;
  trick_id: string;
  hand_id: string;
  username: string;
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

export type Suit = "C" | "D" | "H" | "S";

export type Rank =
  "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

/** Playing card encoded as two chars, e.g. `AS`, `TH`, `D2`. */
export type Card = string;

export type Seat = "N" | "E" | "S" | "W";

export type Partnership = "NS" | "EW";

export type Strain = Suit | "NT";

/** Stored per-hand double-dummy solve: declarer side's max tricks on the
    contract's strain. `maxTricks` is with perfect play on both sides. */
export type DdResult = {
  strain: Strain;
  side: Partnership;
  maxTricks: number;
};

export type Vulnerability = "none" | "ns" | "ew" | "both";

export type OpenerRule = "twoClubHolder" | "dealer" | "leftOfDealer";

export type Deal = Record<Seat, Card[]>;

/** Seat -> username, captured on a game at start time. */
export type GamePlayers = Record<Seat, string>;

export type Call =
  | { kind: "pass" }
  | { kind: "bid"; level: number; strain: Strain }
  | { kind: "double" }
  | { kind: "redouble" };

export type Contract = {
  level: number;
  strain: Strain;
  doubled: boolean;
  redoubled: boolean;
};

export type ScoringConfig = {
  minorTrick: number;
  majorTrick: number;
  ntTrick: number;
  ntFirstTrickBonus: number;
  partScoreBonus: number;
  gameBonus: { vuln: number; non: number };
  slamBonus: {
    small: { vuln: number; non: number };
    grand: { vuln: number; non: number };
  };
  insultBonus: { doubled: number; redoubled: number };
  undertrick: {
    undoubled: { vuln: number; non: number };
    doubled: { vuln: number[]; non: number[] };
  };
};

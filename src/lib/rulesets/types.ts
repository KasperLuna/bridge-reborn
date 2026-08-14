import type {
  OpenerRule,
  ScoringConfig,
  Vulnerability,
} from "@/lib/game/types";

export type { OpenerRule };

export type Ruleset = {
  id: string;
  name: string;
  openerRule: OpenerRule;
  bidding: {
    doubleAllowed: boolean;
    redoubleAllowed: boolean;
  };
  dealerRotation: "fixed" | "rotate";
  /** Vulnerability for hand N is cycle[(N-1) % cycle.length]. */
  vulnerabilityCycle: Vulnerability[];
  scoring: ScoringConfig;
  play: {
    mustFollowSuit: boolean;
    endHandEarly: boolean;
  };
};

export type RulesetOverrides = {
  [K in keyof Ruleset]?: Partial<Ruleset[K]>;
};

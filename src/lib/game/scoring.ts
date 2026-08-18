import type {
  Contract,
  Partnership,
  ScoringConfig,
  Vulnerability,
} from "./types";

export function isSideVulnerable(
  side: Partnership,
  vulnerability: Vulnerability,
): boolean {
  return vulnerability === "both" || vulnerability === side.toLowerCase();
}

export type ContractScore = {
  /** Points awarded to the declaring side (negative when down). */
  declaring: number;
  /** Points awarded to the defending side. */
  defending: number;
};

/** Full duplicate scoring per SPEC §8. Downtown flips card ranking (low cards
    win), never the trick target: the bid number is books above six in both
    directions, so scoring is identical. */
export function scoreContract(
  contract: Contract,
  tricksMade: number,
  declarerSide: Partnership,
  vulnerability: Vulnerability,
  cfg: ScoringConfig,
): ContractScore {
  const { level, strain, doubled, redoubled } = contract;
  const required = level + 6;
  const multiplier = redoubled ? 4 : doubled ? 2 : 1;
  const vuln = isSideVulnerable(declarerSide, vulnerability);

  if (tricksMade < required) {
    const undertricks = required - tricksMade;
    let penalty: number;
    if (multiplier === 1) {
      const per = vuln
        ? cfg.undertrick.undoubled.vuln
        : cfg.undertrick.undoubled.non;
      penalty = undertricks * per;
    } else {
      const steps = vuln
        ? cfg.undertrick.doubled.vuln
        : cfg.undertrick.doubled.non;
      let sum = 0;
      for (let i = 0; i < undertricks; i++) {
        sum += steps[Math.min(i, steps.length - 1)]!;
      }
      penalty = sum * (multiplier === 4 ? 2 : 1);
    }
    return { declaring: -penalty, defending: penalty };
  }

  const isMajor = strain === "H" || strain === "S";
  const perTrick =
    strain === "NT" ? cfg.ntTrick : isMajor ? cfg.majorTrick : cfg.minorTrick;
  const firstTrickBonus = strain === "NT" ? cfg.ntFirstTrickBonus : 0;
  const trickScore = (perTrick * level + firstTrickBonus) * multiplier;

  const isGame = trickScore >= 100;
  const gameBonus = isGame
    ? vuln
      ? cfg.gameBonus.vuln
      : cfg.gameBonus.non
    : cfg.partScoreBonus;

  let slamBonus = 0;
  if (level === 7) {
    slamBonus = vuln ? cfg.slamBonus.grand.vuln : cfg.slamBonus.grand.non;
  } else if (level === 6) {
    slamBonus = vuln ? cfg.slamBonus.small.vuln : cfg.slamBonus.small.non;
  }

  const insultBonus = redoubled
    ? cfg.insultBonus.redoubled
    : doubled
      ? cfg.insultBonus.doubled
      : 0;

  const overtricks = tricksMade - required;
  let overtrickScore = 0;
  if (overtricks > 0) {
    if (multiplier === 1) {
      overtrickScore = overtricks * perTrick;
    } else {
      const per = vuln ? 200 : 100;
      overtrickScore = overtricks * per * (multiplier === 4 ? 2 : 1);
    }
  }

  const score =
    trickScore + gameBonus + slamBonus + insultBonus + overtrickScore;
  return { declaring: score, defending: 0 };
}

/** Whether the actual result contradicts the double-dummy verdict for the
    contract (made but DD says it should fail, or set when DD says it makes). */
export function ddOutcome(
  dd: { maxTricks: number } | null,
  tricksMade: number,
  tricksRequired: number,
): { made: boolean; ddMakes: boolean; upset: boolean } | null {
  if (!dd) return null;
  const made = tricksMade >= tricksRequired;
  const ddMakes = dd.maxTricks >= tricksRequired;
  return { made, ddMakes, upset: made !== ddMakes };
}

/** Vote window for a kick vote, in milliseconds. */
export const KICK_VOTE_WINDOW_MS = 60000;

/** Votes required to pass a kick: strict majority of the humans who may vote.
    The target cannot vote, so callers pass the seated-human count minus one. */
export function kickThreshold(votableHumanCount: number): number {
  return Math.floor(votableHumanCount / 2) + 1;
}

/** True once the vote's expires_at timestamp is in the past. */
export function isExpired(expiresAt: string, now: number): boolean {
  return Date.parse(expiresAt) <= now;
}

/** True once the yes-vote count meets the strict-majority threshold. */
export function shouldPass(
  votesYes: string[],
  seatedHumanCount: number,
): boolean {
  return votesYes.length >= kickThreshold(seatedHumanCount);
}

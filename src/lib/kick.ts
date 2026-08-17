/** Vote window for a kick vote, in milliseconds. */
export const KICK_VOTE_WINDOW_MS = 60000;

/** Votes required to pass a kick: strict majority of seated humans. */
export function kickThreshold(seatedHumanCount: number): number {
  return Math.floor(seatedHumanCount / 2) + 1;
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

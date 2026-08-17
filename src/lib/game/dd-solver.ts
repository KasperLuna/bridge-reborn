import type { Deal, Seat, Strain, Suit } from "./types";

const SEATS: Seat[] = ["N", "E", "S", "W"];
const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANK_CHARS = "23456789TJQKA";

const RANK_OF = new Map<string, number>();
for (let i = 0; i < RANK_CHARS.length; i++) RANK_OF.set(RANK_CHARS[i]!, i);

const rankChar = (r: number) => RANK_CHARS[r]!;
const seatIndex = (s: Seat) => SEATS.indexOf(s);
const isNs = (p: number) => p === 0 || p === 2;

type Played = { p: number; s: number; r: number };
type Hands = number[][][];

/** Flag 0 = exact, 1 = lower bound (true value >= v), 2 = upper bound (true <= v). */
type Flag = 0 | 1 | 2;

/** Exact double-dummy solve: max tricks the declarer's side can take on this
    deal and strain with all four hands visible and perfect play on both sides.
    Best-effort: returns null if the search exceeds its node budget. */
export function solveDoubleDummy(
  deal: Deal,
  strain: Strain,
  declarerSeat: Seat,
): number | null {
  const declarer = seatIndex(declarerSeat);
  const maxIsNs = isNs(declarer);
  const trump = strain === "NT" ? -1 : SUITS.indexOf(strain as Suit);

  const hands: Hands = SEATS.map(() => SUITS.map(() => [] as number[]));
  for (let p = 0; p < 4; p++) {
    for (const card of deal[SEATS[p]!]!) {
      const s = SUITS.indexOf(card[1] as Suit);
      const r = RANK_OF.get(card[0]!)!;
      const arr = hands[p]![s]!;
      let i = 0;
      while (i < arr.length && arr[i]! < r) i++;
      arr.splice(i, 0, r);
    }
  }

  const budget = { nodes: 0, max: 2_000_000 };
  const memo = new Map<string, [Flag, number]>();
  try {
    return search(
      hands,
      [],
      (declarer + 1) % 4,
      -1,
      14,
      trump,
      maxIsNs,
      budget,
      memo,
    );
  } catch {
    return null;
  }
}

/** Additional declarer-side tricks from this state, via fail-soft alpha-beta
    with a transposition table. Bounds are stored with the flag derived from
    the window at node entry (canonical fail-soft semantics). */
function search(
  hands: Hands,
  trick: Played[],
  leader: number,
  alpha: number,
  beta: number,
  trump: number,
  maxIsNs: boolean,
  budget: { nodes: number; max: number },
  memo: Map<string, [Flag, number]>,
): number {
  if (trick.length === 4) {
    const w = winningCard(trick, trump);
    const add = isNs(w.p) === maxIsNs ? 1 : 0;
    return add + search(hands, [], w.p, alpha - add, beta - add, trump, maxIsNs, budget, memo);
  }

  const player = trick.length === 0 ? leader : (trick[0]!.p + trick.length) % 4;
  if (++budget.nodes > budget.max) throw new Error("dd budget exceeded");

  const key = hashKey(hands, trick, leader);
  const aOrig = alpha;
  const bOrig = beta;
  const hit = memo.get(key);
  if (hit) {
    const [f, v] = hit;
    if (f === 0) return v;
    if (f === 1) {
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    } else {
      if (v <= alpha) return v;
      if (v < beta) beta = v;
    }
  }

  const maximizing = isNs(player) === maxIsNs;
  const cands = orderCandidates(
    candidates(hands, player, trick, trump),
    trick,
    trump,
    maximizing,
  );
  if (cands.length === 0) return 0;
  let best = maximizing ? -1 : 14;
  for (const c of cands) {
    const arr = hands[c.p]![c.s]!;
    const i = arr.indexOf(c.r);
    arr.splice(i, 1);
    const val = search(
      hands,
      [...trick, c],
      leader,
      maximizing ? Math.max(alpha, best) : alpha,
      maximizing ? beta : Math.min(beta, best),
      trump,
      maxIsNs,
      budget,
      memo,
    );
    arr.splice(i, 0, c.r);
    if (maximizing) {
      if (val > best) best = val;
      if (best >= beta) break;
    } else {
      if (val < best) best = val;
      if (best <= alpha) break;
    }
  }
  if (best >= bOrig) memo.set(key, [1, best]);
  else if (best <= aOrig) memo.set(key, [2, best]);
  else memo.set(key, [0, best]);
  return best;
}

/** Sound candidate pruning: when following suit only the lowest and highest
    card need considering (the highest wins against any later over-take, the
    lowest ducks); when leading only the lowest and highest of each suit. Void
    in the led suit adds the lowest and highest ruffs plus the lowest discard
    of each other suit. */
function candidates(
  hands: Hands,
  player: number,
  trick: Played[],
  trump: number,
): Played[] {
  const mine = hands[player]!;
  const out: Played[] = [];
  const push = (s: number, r: number) => {
    if (out.some((c) => c.s === s && c.r === r)) return;
    out.push({ p: player, s, r });
  };

  if (trick.length === 0) {
    for (let s = 0; s < 4; s++) {
      const arr = mine[s]!;
      if (arr.length === 0) continue;
      push(s, arr[0]!);
      push(s, arr[arr.length - 1]!);
    }
    return out;
  }

  const ls = trick[0]!.s;
  if (mine[ls]!.length > 0) {
    const arr = mine[ls]!;
    push(ls, arr[0]!);
    push(ls, arr[arr.length - 1]!);
    return out;
  }

  if (trump !== -1) {
    const arr = mine[trump]!;
    if (arr.length > 0) {
      push(trump, arr[0]!);
      push(trump, arr[arr.length - 1]!);
    }
  }
  for (let s = 0; s < 4; s++) {
    if (s === ls) continue;
    if (trump !== -1 && s === trump) continue;
    const arr = mine[s]!;
    if (arr.length > 0) push(s, arr[0]!);
  }
  return out;
}

/** Move ordering for alpha-beta: MAX tries winning cards first (cheapest
    winner before others), MIN tries losing cards first. Leads order by rank
    strength relative to the mover. */
function orderCandidates(
  cands: Played[],
  trick: Played[],
  trump: number,
  maximizing: boolean,
): Played[] {
  if (cands.length < 2) return cands;
  const wc = trick.length === 0 ? null : winningCard(trick, trump);
  const score = (c: Played): number => {
    if (wc) {
      const beats =
        c.s === wc.s ? c.r > wc.r : trump !== -1 && c.s === trump;
      return maximizing ? (beats ? 0 : 1) : (beats ? 1 : 0);
    }
    return maximizing ? 12 - c.r : c.r;
  };
  return [...cands].sort((a, b) => score(a) - score(b));
}

function winningCard(trick: Played[], trump: number): Played {
  let best = trick[0]!;
  for (let i = 1; i < trick.length; i++) {
    const c = trick[i]!;
    if (c.s === best.s) {
      if (c.r > best.r) best = c;
    } else if (trump !== -1 && c.s === trump) {
      best = c;
    }
  }
  return best;
}

function hashKey(hands: Hands, trick: Played[], leader: number): string {
  let h = "";
  for (let p = 0; p < 4; p++) {
    for (let s = 0; s < 4; s++) {
      for (const r of hands[p]![s]!) h += rankChar(r);
      h += ";";
    }
  }
  h += `|${leader}|`;
  for (const c of trick) h += `${c.p}:${c.s}:${rankChar(c.r)},`;
  return h;
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

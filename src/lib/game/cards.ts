import type { Card, Deal, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["C", "D", "H", "S"];

export const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
];

const RANK_INDEX = new Map<Rank, number>(RANKS.map((r, i) => [r, i]));

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/** Sort a hand spades-first, hearts, diamonds, clubs; high card first. */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const bySuit = SUIT_ORDER[cardSuit(a)] - SUIT_ORDER[cardSuit(b)];
    if (bySuit !== 0) return bySuit;
    return rankIndex(cardRank(b)) - rankIndex(cardRank(a));
  });
}

/** Sort by rank descending, then by suit. */
export function sortHandByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const byRank = rankIndex(cardRank(b)) - rankIndex(cardRank(a));
    if (byRank !== 0) return byRank;
    return SUIT_ORDER[cardSuit(a)] - SUIT_ORDER[cardSuit(b)];
  });
}

export const isRedSuit = (suit: Suit): boolean => suit === "H" || suit === "D";

export function cardSuit(card: Card): Suit {
  return card[1] as Suit;
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank;
}

/** Human-readable rank: ten is displayed as "10", not "T". */
export function displayRank(rank: Rank): string {
  return rank === "T" ? "10" : rank;
}

export function rankIndex(rank: Rank): number {
  const i = RANK_INDEX.get(rank);
  if (i === undefined) throw new Error(`Unknown rank: ${rank}`);
  return i;
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(`${rank}${suit}`);
  }
  return deck;
}

/** Fisher-Yates shuffle of a fresh deck, dealt 13 cards to each seat. */
export function buildShuffledDeal(rng: () => number = Math.random): Deal {
  const deck = buildDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return {
    N: deck.slice(0, 13),
    E: deck.slice(13, 26),
    S: deck.slice(26, 39),
    W: deck.slice(39, 52),
  };
}

/** True when every seat holds exactly 13 distinct valid cards. */
export function isValidDeal(deal: Deal): boolean {
  const all = Object.values(deal).flat();
  if (all.length !== 52) return false;
  return (
    new Set(all).size === 52 && all.every((c) => /^[2-9TJQKA][CDHS]$/.test(c))
  );
}

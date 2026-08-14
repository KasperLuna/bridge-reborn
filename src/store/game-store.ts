"use client";

import { create } from "zustand";

import * as api from "@/lib/api";
import type {
  BidRecord,
  ContractRecord,
  Game,
  Hand,
  HandResultRecord,
  PlayRecord,
  TrickRecord,
} from "@/lib/types";

import { useSessionStore } from "./session-store";

type GameState = {
  game: Game | null;
  hand: Hand | null;
  bids: BidRecord[];
  contract: ContractRecord | null;
  tricks: TrickRecord[];
  plays: PlayRecord[];
  result: HandResultRecord | null;
  error: string | null;
  pending: boolean;
  setGame: (game: Game | null) => void;
  setHand: (hand: Hand | null) => void;
  setBids: (bids: BidRecord[]) => void;
  setContract: (contract: ContractRecord | null) => void;
  setTricks: (tricks: TrickRecord[]) => void;
  setPlays: (plays: PlayRecord[]) => void;
  setResult: (result: HandResultRecord | null) => void;
  setError: (error: string | null) => void;
  setPending: (pending: boolean) => void;
  reset: () => void;
  bid: (call: string) => Promise<void>;
  play: (card: string) => Promise<void>;
  concede: (action: "concede" | "leave") => Promise<void>;
  startNewGame: () => Promise<void>;
};

function requireSession() {
  const session = useSessionStore.getState().session;
  if (!session) throw new Error("No session");
  return session;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  hand: null,
  bids: [],
  contract: null,
  tricks: [],
  plays: [],
  result: null,
  error: null,
  pending: false,

  setGame: (game) => set({ game }),
  setHand: (hand) => set({ hand }),
  setBids: (bids) => set({ bids }),
  setContract: (contract) => set({ contract }),
  setTricks: (tricks) => set({ tricks }),
  setPlays: (plays) => set({ plays }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  setPending: (pending) => set({ pending }),
  reset: () =>
    set({
      game: null,
      hand: null,
      bids: [],
      contract: null,
      tricks: [],
      plays: [],
      result: null,
      error: null,
      pending: false,
    }),

  bid: async (call) => {
    const session = requireSession();
    const hand = get().hand;
    if (!hand) return;
    set({ pending: true, error: null });
    try {
      await api.submitBid(session, hand.id, call);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Bid failed" });
    } finally {
      set({ pending: false });
    }
  },

  play: async (card) => {
    const session = requireSession();
    const hand = get().hand;
    if (!hand) return;
    set({ pending: true, error: null });
    try {
      await api.playCard(session, hand.id, card);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Play failed" });
    } finally {
      set({ pending: false });
    }
  },

  concede: async (action) => {
    const session = requireSession();
    const hand = get().hand;
    if (!hand) return;
    set({ pending: true, error: null });
    try {
      await api.concede(session, hand.id, action);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to end game" });
    } finally {
      set({ pending: false });
    }
  },

  startNewGame: async () => {
    const session = requireSession();
    set({ pending: true, error: null });
    try {
      await api.newGame(session);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to start new game",
      });
    } finally {
      set({ pending: false });
    }
  },
}));

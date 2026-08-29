"use client";

import { create } from "zustand";

import * as api from "@/lib/api";
import type { Seat } from "@/lib/game/types";
import type { KickVote, Room, RoomSeat } from "@/lib/types";

import { useSessionStore } from "./session-store";

type RoomState = {
  room: Room | null;
  seats: RoomSeat[];
  kickVotes: KickVote[];
  error: string | null;
  setRoom: (room: Room | null) => void;
  setSeats: (seats: RoomSeat[]) => void;
  setKickVotes: (votes: KickVote[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  claim: (seat: Seat | null) => Promise<void>;
  leave: () => Promise<void>;
  ready: (ready: boolean) => Promise<void>;
  changeRuleset: (presetId: string) => Promise<void>;
  changePrivacy: (
    privacy: "public" | "private",
    password?: string,
  ) => Promise<void>;
  start: () => Promise<void>;
  sendEmote: (emote: string) => Promise<void>;
  startKick: (targetUsername: string) => Promise<void>;
  castKickVote: (voteId: string, yes: boolean) => Promise<void>;
  addBot: (seat?: Seat) => Promise<void>;
  kickBot: (targetUsername: string) => Promise<void>;
};

function requireSession() {
  const session = useSessionStore.getState().session;
  if (!session) throw new Error("No session");
  return session;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  seats: [],
  kickVotes: [],
  error: null,

  setRoom: (room) => set({ room }),
  setSeats: (seats) => set({ seats }),
  setKickVotes: (votes) => set({ kickVotes: votes }),
  setError: (error) => set({ error }),
  reset: () =>
    set({ room: null, seats: [], kickVotes: [], error: null }),

  claim: async (seat) => {
    const session = requireSession();
    const result = await api.claimSeat(session, seat);
    useSessionStore.getState().set({
      ...session,
      seat: result.seat,
      isSpectator: result.isSpectator,
    });
  },

  leave: async () => {
    const session = requireSession();
    await api.leaveSeat(session);
    useSessionStore.getState().clear();
  },

  ready: async (ready) => {
    await api.setReady(requireSession(), ready);
  },

  changeRuleset: async (presetId) => {
    await api.setRuleset(requireSession(), presetId);
  },

  changePrivacy: async (privacy, password) => {
    await api.setPrivacy(requireSession(), privacy, password);
  },

  start: async () => {
    await api.startGame(requireSession());
  },

  sendEmote: async (emote) => {
    await api.sendEmote(requireSession(), emote);
  },

  startKick: async (targetUsername) => {
    try {
      await api.startKick(requireSession(), targetUsername);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Kick failed" });
    }
  },

  castKickVote: async (voteId, yes) => {
    try {
      await api.castKickVote(requireSession(), voteId, yes);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Vote failed" });
    }
  },

  addBot: async (seat) => {
    try {
      await api.addBot(requireSession(), seat);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to add bot" });
    }
  },

  kickBot: async (targetUsername) => {
    try {
      await api.kickBot(requireSession(), targetUsername);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to kick bot" });
    }
  },
}));

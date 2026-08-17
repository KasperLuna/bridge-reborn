"use client";

import { create } from "zustand";

import * as api from "@/lib/api";
import { clearSession, loadSession, saveSession } from "@/lib/session";
import type { Session } from "@/lib/types";

type SessionState = {
  session: Session | null;
  loaded: boolean;
  init: () => void;
  set: (session: Session) => void;
  clear: () => void;
  join: (code: string, username: string, password?: string) => Promise<void>;
  quick: (mode: "solo" | "pairs", username: string) => Promise<Session>;
};

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  loaded: false,

  init: () => {
    set({ session: loadSession(), loaded: true });
  },

  set: (session) => {
    saveSession(session);
    set({ session });
  },

  clear: () => {
    clearSession();
    set({ session: null });
  },

  join: async (code, username, password) => {
    const result = await api.joinRoom(code, username, false, password);
    saveSession(result);
    set({ session: result });
  },

  quick: async (mode, username) => {
    const result = await api.quickGame(mode, username);
    saveSession(result);
    set({ session: result });
    return result;
  },
}));

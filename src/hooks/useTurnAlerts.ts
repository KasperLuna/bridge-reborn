"use client";

import { useEffect, useRef } from "react";

import type { Seat } from "@/lib/game/types";

type TurnPhase = "auction" | "play";

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return AC ? new AC() : null;
}

/**
 * Plays a soft two-tone blip and sends a browser Notification when it becomes
 * your turn to bid or play. Both are optional and silent when blocked.
 */
export function useTurnAlerts({
  activeSeat,
  phase,
  mySeats,
  handOver,
  isSpectator,
}: {
  activeSeat: Seat | null;
  phase: TurnPhase;
  mySeats: Seat[];
  handOver: boolean;
  isSpectator: boolean;
}) {
  const prevTurnRef = useRef<Seat | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const permissionAskedRef = useRef(false);
  const focusedRef = useRef(
    typeof document === "undefined" ? true : document.hasFocus(),
  );

  // Track focus: notifications only make sense when the window is unfocused.
  useEffect(() => {
    const onFocus = () => {
      focusedRef.current = true;
    };
    const onBlur = () => {
      focusedRef.current = false;
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Browsers block audio until a user gesture, so unlock the context lazily.
  useEffect(() => {
    const unlock = () => {
      const ctx = audioCtxRef.current ?? createAudioContext();
      audioCtxRef.current = ctx;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    function playBlip(ctx: AudioContext) {
      try {
        const t0 = ctx.currentTime;
        for (const [freq, delay] of [
          [440, 0],
          [660, 0.12],
        ] as const) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const start = t0 + delay;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.05, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.2);
        }
      } catch (e) {
        void e;
      }
    }

    function maybeNotify(seat: Seat) {
      if (
        typeof window === "undefined" ||
        typeof window.Notification === "undefined"
      ) {
        return;
      }
      if (!permissionAskedRef.current) {
        permissionAskedRef.current = true;
        if (window.Notification.permission === "default") {
          void window.Notification.requestPermission();
        }
      }
      if (window.Notification.permission !== "granted") return;
      if (focusedRef.current) return;
      try {
        void new window.Notification("Your turn", {
          body:
            phase === "auction"
              ? `Bid in seat ${seat}`
              : `Play in seat ${seat}`,
          silent: true,
        });
      } catch (e) {
        void e;
      }
    }

    if (handOver || isSpectator) {
      prevTurnRef.current = activeSeat;
      return;
    }
    // Rising edge: only fire when the active seat just flipped to one of mine.
    const becameMine =
      activeSeat !== null &&
      mySeats.includes(activeSeat) &&
      prevTurnRef.current !== activeSeat;
    prevTurnRef.current = activeSeat;
    if (!becameMine) return;

    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "running") playBlip(ctx);
    maybeNotify(activeSeat);
  }, [activeSeat, phase, mySeats, handOver, isSpectator]);
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { Seat } from "@/lib/game/types";
import { useRoomStore } from "@/store/room-store";

interface EmoteOverlayProps {
  positions: Record<Seat, string>;
}

const VISIBLE_MS = 3000;
const TICK_MS = 500;

export const EmoteOverlay = ({ positions }: EmoteOverlayProps) => {
  const seats = useRoomStore((s) => s.seats);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <AnimatePresence>
      {seats.map((s) => {
        if (!s.seat || !s.last_emote || !s.emote_at) return null;
        const elapsed = now - Date.parse(s.emote_at);
        if (Number.isNaN(elapsed) || elapsed >= VISIBLE_MS) return null;
        return (
          <motion.div
            key={`${s.id}-${s.emote_at}`}
            initial={{ opacity: 0, y: 6, scale: 0.6 }}
            animate={{ opacity: 1, y: -24, scale: 1.1 }}
            exit={{ opacity: 0, y: -32, scale: 0.9 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`pointer-events-none absolute z-30 ${positions[s.seat as Seat]}`}
          >
            <span className="block text-3xl drop-shadow-[0_4px_8px_rgb(0_0_0/40%)]">
              {s.last_emote}
            </span>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
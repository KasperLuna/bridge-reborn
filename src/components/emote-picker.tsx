"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Smile } from "lucide-react";

import { useRoomStore } from "@/store/room-store";

export const EMOTES = ["😴", "👏", "🤡", "💀", "🧂", "🔥"] as const;

const COOLDOWN_MS = 1000;

/** Small emote button + popover, anchored above its own seat badge. */
export function EmotePicker() {
  const sendEmote = useRoomStore((s) => s.sendEmote);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);

  function pick(emote: string) {
    setOpen(false);
    if (cooling) return;
    setCooling(true);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
    void sendEmote(emote).catch(() => {});
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Send emote"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="grid h-7 w-7 place-items-center rounded-full border border-cream/15 bg-ink/60 transition-colors hover:border-lime/60"
      >
        <Smile className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2"
            >
              <div className="relative flex items-center gap-1 rounded-full border border-cream/15 bg-felt-deep/95 p-1.5 shadow-xl backdrop-blur">
                {EMOTES.map((em) => (
                  <button
                    key={em}
                    type="button"
                    disabled={cooling}
                    onClick={() => pick(em)}
                    className="grid h-8 w-8 place-items-center rounded-full text-lg transition-transform hover:scale-125 disabled:opacity-50"
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border-r border-b border-cream/15 bg-felt-deep/95" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
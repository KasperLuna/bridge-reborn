"use client";

import { motion } from "motion/react";

import { cardSuit } from "@/lib/game/cards";
import type { Card, Suit } from "@/lib/game/types";

import { PlayingCard } from "./PlayingCard";

export function Hand({
  cards,
  playable = null,
  trumpSuit = null,
  staged = null,
  hiddenCards = [],
  onPlay,
  size = "md",
  compact = false,
}: {
  cards: Card[];
  playable?: Card[] | null;
  trumpSuit?: Suit | null;
  staged?: Card | null;
  hiddenCards?: Card[];
  onPlay?: (card: Card) => void;
  size?: "sm" | "md" | "lg";
  /** Keep the fan at the small-screen height on sm+ (used during auction to
      leave more vertical room for the centered bid panel). */
  compact?: boolean;
}) {
  const n = cards.length;
  const mid = (n - 1) / 2;
  const dense = n > 8;
  const step = dense ? 2.4 : 3.5;
  const offset = dense ? 26 : 38;
  const depth = dense ? 1.4 : 2.4;

  return (
    <div
      className={`relative flex h-36 items-end justify-center ${
        compact ? "" : "sm:h-52"
      }`}
    >
      {cards.map((card, i) => {
        const baseY = Math.pow(i - mid, 2) * depth;
        const angle = (i - mid) * step;
        const inPlay = !!onPlay;
        const clickable = inPlay && (playable ? playable.includes(card) : true);
        const isStaged = staged === card;
        const hidden = hiddenCards.includes(card);
        // Playable cards sit raised; staged card lifts well clear of the fan.
        const lift = clickable ? 14 : 0;
        // Keep the staged-card lift modest so on small screens it stays inside
        // the short hand container instead of rising into the confirm row.
        const y = baseY - lift - (isStaged ? 24 : 0);
        const x = (i - mid) * offset;
        const isTrump = trumpSuit !== null && cardSuit(card) === trumpSuit;

        return (
          <motion.div
            key={card}
            data-hand-card={card}
            className="absolute origin-bottom"
            initial={{ y: 60, opacity: 0 }}
            animate={{
              x,
              y,
              rotate: angle,
              scale: isStaged ? 1.14 : 1,
              opacity: hidden ? 0 : 1,
              zIndex: isStaged ? 70 : i,
            }}
            style={hidden ? { pointerEvents: "none" } : undefined}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 26,
              delay: i * 0.02,
            }}
            whileHover={{ y: y - 26, scale: 1.12, rotate: 0, zIndex: 60 }}
            whileTap={clickable ? { scale: 0.92 } : undefined}
          >
            <div
              className={`rounded-xl transition-shadow ${
                isStaged ? "shadow-[0_0_28px_-4px_rgb(186_255_61/70%)]" : ""
              }`}
            >
              <PlayingCard
                card={card}
                size={size}
                playable={clickable}
                dimmed={inPlay && !clickable}
                trump={isTrump}
                onClick={clickable ? () => onPlay?.(card) : undefined}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

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
}: {
  cards: Card[];
  playable?: Card[] | null;
  trumpSuit?: Suit | null;
  staged?: Card | null;
  hiddenCards?: Card[];
  onPlay?: (card: Card) => void;
}) {
  const [narrow, setNarrow] = useState(false);
  const [wide, setWide] = useState(false);
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mqNarrow = window.matchMedia("(max-width: 639px)");
    const mqWide = window.matchMedia("(min-width: 1280px)");
    const mqHover = window.matchMedia("(hover: hover)");
    const update = () => {
      setNarrow(mqNarrow.matches);
      setWide(mqWide.matches);
      setCanHover(mqHover.matches);
    };
    update();
    mqNarrow.addEventListener("change", update);
    mqWide.addEventListener("change", update);
    mqHover.addEventListener("change", update);
    return () => {
      mqNarrow.removeEventListener("change", update);
      mqWide.removeEventListener("change", update);
      mqHover.removeEventListener("change", update);
    };
  }, []);

  // Cards scale with the viewport: md on phones, lg on small/tablet screens,
  // xl on wide desktop. The fan must fit the aside (lg fits 36rem, xl fits
  // 40rem), so the larger cards only appear once the aside can hold them.
  const eff = narrow ? "md" : wide ? "xl" : "lg";
  const n = cards.length;
  const mid = (n - 1) / 2;
  const dense = n > 8;
  // Narrow screens: tuck the fan together so the spread stays on screen.
  const k = narrow ? 0.85 : 1;
  // Larger cards spread farther apart than md so the wider faces stay readable
  // in the fan.
  const kx = eff === "lg" ? 1.2 : eff === "xl" ? 1.3 : 1;
  const kd = eff === "lg" || eff === "xl" ? 1.05 : 1;
  const step = k * kx * (dense ? 2.2 : 3.2);
  const offset = k * kx * (dense ? 26 : 38);
  const depth = k * kd * (dense ? 1.4 : 2.4);

  return (
    <div
      className={`relative flex items-end justify-center pb-1 sm:pb-0 ${
        eff === "md" ? "h-36 sm:h-52" : eff === "xl" ? "h-72" : "h-64"
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
            className="absolute origin-bottom touch-manipulation"
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
            // Hover-lift only where hover exists. On touch, a lingering hover
            // would leave a raised card covering its neighbors and steal taps.
            whileHover={
              clickable && canHover
                ? { y: y - 26, scale: 1.12, rotate: 0, zIndex: 60 }
                : undefined
            }
            // On touch there's no hover, so lift the tapped card itself to reveal
            // which one is pressed before release fires onClick.
            whileTap={
              clickable ? { y: y - 14, scale: 1.06, zIndex: 60 } : undefined
            }
          >
            <div
              className={`rounded-xl transition-shadow ${
                isStaged ? "shadow-[0_0_28px_-4px_rgb(186_255_61/70%)]" : ""
              }`}
            >
              <PlayingCard
                card={card}
                size={eff}
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

"use client";

import { useEffect, useRef, useState } from "react";

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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Tilt follows the cursor at most once per frame; the layout read + style
  // writes live inside the rAF so pointermoves never force per-event reflow.
  const tiltRaf = useRef(0);
  const tiltTarget = useRef<{ el: HTMLElement; x: number; y: number } | null>(
    null,
  );
  const onTiltMove = (e: React.PointerEvent<HTMLElement>) => {
    tiltTarget.current = { el: e.currentTarget, x: e.clientX, y: e.clientY };
    if (tiltRaf.current) return;
    tiltRaf.current = requestAnimationFrame(() => {
      tiltRaf.current = 0;
      const t = tiltTarget.current;
      if (!t) return;
      const r = t.el.getBoundingClientRect();
      const px = (t.x - r.left) / r.width - 0.5;
      const py = (t.y - r.top) / r.height - 0.5;
      t.el.style.setProperty("--rx", `${-py * 28}deg`);
      t.el.style.setProperty("--ry", `${px * 28}deg`);
    });
  };
  const resetTilt = (e: React.PointerEvent<HTMLElement>) => {
    if (tiltRaf.current) {
      cancelAnimationFrame(tiltRaf.current);
      tiltRaf.current = 0;
    }
    tiltTarget.current = null;
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
    setHoveredIdx(null);
  };
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

  const inPlay = !!onPlay;
  const anyPlayable =
    inPlay &&
    (playable ? cards.some((c) => playable.includes(c)) : cards.length > 0);

  return (
    <div
      className={`relative flex items-end justify-center pb-1 sm:pb-0 ${
        eff === "md" ? "h-36 sm:h-52" : eff === "xl" ? "h-72" : "h-64"
      } ${anyPlayable ? "hand-turn" : ""}`}
    >
      {cards.map((card, i) => {
        const baseY = Math.pow(i - mid, 2) * depth;
        const angle = (i - mid) * step;
        const clickable = inPlay && (playable ? playable.includes(card) : true);
        const isStaged = staged === card;
        const hidden = hiddenCards.includes(card);
        // Hovered card's immediate neighbors slide away from it, Balatro-style.
        const neighbor =
          hoveredIdx !== null && Math.abs(hoveredIdx - i) === 1;
        const nudgeX = neighbor ? (hoveredIdx > i ? -10 : 10) : 0;
        const nudgeY = neighbor ? 6 : 0;
        // Playable cards sit raised; staged card lifts well clear of the fan.
        const lift = clickable ? 14 : 0;
        // Keep the staged-card lift modest so on small screens it stays inside
        // the short hand container instead of rising into the confirm row.
        const y = baseY - lift - (isStaged ? 24 : 0) + nudgeY;
        const x = (i - mid) * offset + nudgeX;
        const isTrump = trumpSuit !== null && cardSuit(card) === trumpSuit;
        const tiltable = clickable && canHover;
        // Cap deal stagger so big hands still land fast instead of trailing out.
        const settleDelay = Math.min(i, 8) * 0.02;
        const dealDelay = Math.min(i, 6) * 0.05;

        return (
          <motion.div
            key={card}
            data-hand-card={card}
            className="absolute origin-bottom touch-manipulation"
            onPointerEnter={tiltable ? () => setHoveredIdx(i) : undefined}
            onPointerMove={tiltable ? onTiltMove : undefined}
            onPointerLeave={tiltable ? resetTilt : undefined}
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
              delay: settleDelay,
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
              className={`relative rounded-xl ${
                tiltable && hoveredIdx === i ? "will-change-transform" : ""
              } ${isStaged ? "card-staged" : isTrump ? "card-trump" : ""}`}
              style={
                tiltable && hoveredIdx === i
                  ? {
                      transform:
                        "perspective(650px) rotateX(var(--rx)) rotateY(var(--ry))",
                      transformOrigin: "center 70%",
                    }
                  : undefined
              }
            >
            <motion.div
              animate={{ y: isStaged ? [0, -5, 0] : 0 }}
              transition={
                isStaged
                  ? {
                      type: "tween",
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: settleDelay,
                    }
                  : { type: "tween", duration: 0.3, delay: settleDelay }
              }
            >
              <motion.div
                aria-hidden="true"
                className={`card-back pointer-events-none absolute inset-0 ${
                  eff === "md" ? "rounded-xl" : "rounded-2xl"
                }`}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: dealDelay }}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: dealDelay }}
              >
                <PlayingCard
                  card={card}
                  size={eff}
                  playable={clickable}
                  dimmed={inPlay && !clickable}
                  trump={isTrump}
                  onClick={clickable ? () => onPlay?.(card) : undefined}
                />
              </motion.div>
            </motion.div>
          </div>
          </motion.div>
        );
      })}
    </div>
  );
}

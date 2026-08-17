"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { cardRank, cardSuit, rankIndex } from "@/lib/game/cards";
import type { Seat, Suit } from "@/lib/game/types";

import { PlayingCard } from "./PlayingCard";

export type TableDir = "top" | "right" | "bottom" | "left";

const DIR_POS: Record<TableDir, string> = {
  top: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/3",
  right: "right-0 top-1/2 -translate-y-1/2 translate-x-1/3",
  bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/3",
  left: "left-0 top-1/2 -translate-y-1/2 -translate-x-1/3",
};

const SEATS: Seat[] = ["N", "E", "S", "W"];

type TrickEff = "sm" | "md" | "lg";

/** Viewport-matched trick card size, shared with the play animation so the
    flying card lands at the same size as the slot it fills. */
export function useTrickCardSize(): TrickEff {
  const [narrow, setNarrow] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mqNarrow = window.matchMedia("(max-width: 639px)");
    const mqWide = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      setNarrow(mqNarrow.matches);
      setWide(mqWide.matches);
    };
    update();
    mqNarrow.addEventListener("change", update);
    mqWide.addEventListener("change", update);
    return () => {
      mqNarrow.removeEventListener("change", update);
      mqWide.removeEventListener("change", update);
    };
  }, []);
  return narrow ? "sm" : wide ? "lg" : "md";
}

const TRICK_EFFS: Record<
  TrickEff,
  {
    card: "sm" | "md" | "lg";
    w: number;
    h: number;
    wrap: string;
    radius: string;
    container: string;
  }
> = {
  sm: {
    card: "sm",
    w: 44,
    h: 64,
    wrap: "h-16 w-11",
    radius: "rounded-lg",
    container: "w-40 sm:w-56",
  },
  md: {
    card: "md",
    w: 64,
    h: 96,
    wrap: "h-24 w-16",
    radius: "rounded-xl",
    container: "w-56 sm:w-80",
  },
  lg: {
    card: "lg",
    w: 88,
    h: 128,
    wrap: "h-32 w-22",
    radius: "rounded-2xl",
    container: "w-80 sm:w-96",
  },
};

/** Center (relative to the container) of each seat's card slot. */
function slotCenter(
  dir: TableDir,
  w: number,
  h: number,
  cw: number,
  ch: number,
): { x: number; y: number } {
  switch (dir) {
    case "top":
      return { x: w / 2, y: -ch / 3 + ch / 2 };
    case "right":
      return { x: w - cw + cw / 3 + cw / 2, y: h / 2 };
    case "bottom":
      return { x: w / 2, y: h - ch + ch / 3 + ch / 2 };
    case "left":
      return { x: -cw / 3 + cw / 2, y: h / 2 };
  }
}

export function TrickArea({
  cards,
  winner,
  positions,
  collecting = false,
  won = false,
  winnerTarget = null,
  onCollected,
  trumpSuit = null,
  size,
}: {
  cards: { card: string; seat: Seat }[];
  winner: Seat | null;
  positions: Record<Seat, TableDir>;
  collecting?: boolean;
  won?: boolean;
  winnerTarget?: { x: number; y: number } | null;
  onCollected?: () => void;
  trumpSuit?: Suit | null;
  /** Override the viewport-derived size (replay wants a tighter layout). */
  size?: TrickEff;
}) {
  const bySeat = new Map(cards.map((c) => [c.seat, c.card]));
  const containerRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef(false);
  const [flyTo, setFlyTo] = useState<Record<
    Seat,
    { x: number; y: number }
  > | null>(null);

  // Cards scale with the viewport like the hand fans: sm on phones, md on
  // small/tablet screens, lg on wide desktop. Slot geometry must match so the
  // collect/fly animation targets stay correct.
  const viewportSize = useTrickCardSize();
  const eff = TRICK_EFFS[size ?? viewportSize];

  // After the countdown (collecting), fly every card (flipping over) under the
  // winner's name badge. Only recompute when the won-state or target changes.
  useEffect(() => {
    if (!won || !winnerTarget || !containerRef.current) {
      setFlyTo(null);
      return;
    }
    collectedRef.current = false;
    const r = containerRef.current.getBoundingClientRect();
    const next = {} as Record<Seat, { x: number; y: number }>;
    for (const s of SEATS) {
      const o = slotCenter(positions[s], r.width, r.height, eff.w, eff.h);
      next[s] = {
        x: winnerTarget.x - (r.left + o.x),
        y: winnerTarget.y - (r.top + o.y),
      };
    }
    setFlyTo(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, winnerTarget]);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square ${eff.container}`}
    >
      {SEATS.map((seat) => {
        const card = bySeat.get(seat);
        const target = flyTo?.[seat];
        // Trump cards played in the trick get a halo that scales with rank —
        // higher trump outshines lower.
        const isTrump =
          !!card && trumpSuit !== null && cardSuit(card) === trumpSuit;
        const tIdx = isTrump ? rankIndex(cardRank(card!)) : 0;
        const halo = isTrump
          ? `0 0 ${14 + tIdx * 2.2}px ${3 + tIdx * 1.2}px rgb(186 255 61 / ${(0.45 + tIdx * 0.03).toFixed(3)})`
          : winner === seat
            ? "0 0 24px -2px rgb(186 255 61 / 0.7)"
            : undefined;
        return (
          <div
            key={seat}
            data-trick-slot={seat}
            className={`absolute ${DIR_POS[positions[seat]]}`}
          >
            {card ? (
              <motion.div
                className={`relative ${eff.wrap} overflow-hidden ${eff.radius}`}
                style={!target && halo ? { boxShadow: halo } : undefined}
                initial={false}
                animate={
                  target
                    ? { x: target.x, y: target.y, scale: 0.6, opacity: 0.4 }
                    : {}
                }
                transition={{ duration: 1.15, ease: "easeInOut" }}
                onAnimationComplete={() => {
                  if (!target || collectedRef.current) return;
                  collectedRef.current = true;
                  onCollected?.();
                }}
              >
                <motion.div
                  className="relative h-full w-full"
                  style={{
                    transformStyle: "preserve-3d",
                    transformPerspective: 900,
                  }}
                  initial={false}
                  animate={target ? { rotateY: 180 } : { rotateY: 0 }}
                  transition={{ duration: 0.85, ease: "easeIn" }}
                >
                  <div className="absolute inset-0 backface-hidden">
                    <PlayingCard card={card} size={eff.card} playable={false} />
                  </div>
                  <div
                    className="absolute inset-0 backface-hidden"
                    style={{ transform: "rotateY(180deg)" }}
                  >
                    <div
                      className={`card-back ${eff.wrap} ${eff.radius} ${
                        winner === seat ? "ring-2 ring-lime/70" : ""
                      }`}
                    />
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <div
                className={`${eff.wrap} ${eff.radius} border border-dashed border-cream/10`}
              />
            )}
          </div>
        );
      })}
      {cards.length === 0 && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xs tracking-[0.3em] text-cream-dim/40 uppercase">
            trick
          </span>
        </div>
      )}
      {collecting && <CountdownRing />}
    </div>
  );
}

/** Ring that runs out over 7s while the won trick's cards are collected. */
function CountdownRing() {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <motion.svg
      className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      width={44}
      height={44}
      viewBox="0 0 44 44"
      aria-label="Clearing cards"
    >
      <circle
        cx={22}
        cy={22}
        r={r}
        fill="rgba(6,10,8,0.65)"
        stroke="rgba(186,255,61,0.25)"
        strokeWidth={3}
      />
      <motion.circle
        cx={22}
        cy={22}
        r={r}
        fill="none"
        stroke="var(--color-lime)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: c }}
        transition={{ duration: 7, ease: "linear" }}
        transform="rotate(-90 22 22)"
      />
    </motion.svg>
  );
}

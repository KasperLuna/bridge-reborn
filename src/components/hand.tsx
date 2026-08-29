"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { motion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";
import { cardSuit } from "@/lib/game/cards";
import type { Card, Suit } from "@/lib/game/types";

import { PlayingCard } from "./playing-card";
import { useHandDrag } from "./use-hand-drag";
import { useHandTilt } from "./use-hand-tilt";
import { useHandViewport, type HandEff } from "./use-hand-viewport";

interface HandProps {
  cards: Card[];
  /** Cards that may be played; null when the hand is just for show. */
  playable?: Card[] | null;
  trumpSuit?: Suit | null;
  staged?: Card | null;
  hiddenCards?: Card[];
  /** Allow cursor tilt/hover even when the cards aren't playable (auction). */
  isHoverable?: boolean;
  onPlay?: (card: Card) => void;
  /** Drop a playable card on the table to confirm it without staging. */
  onPlayConfirm?: (card: Card, from: { x: number; y: number }) => void;
}

const HAND_HEIGHT: Record<HandEff, string> = {
  md: "h-36 sm:h-52",
  lg: "h-52",
  xl: "h-60",
};

const HAND_CORNER: Record<HandEff, string> = {
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-2xl",
};

const SPREAD_X: Record<HandEff, number> = { md: 1, lg: 1.2, xl: 1.3 };
const SPREAD_D: Record<HandEff, number> = { md: 1, lg: 1.05, xl: 1.05 };

export const Hand = ({
  cards,
  playable = null,
  trumpSuit = null,
  staged = null,
  hiddenCards = [],
  isHoverable = false,
  onPlay,
  onPlayConfirm,
}: HandProps) => {
  const { canHover, avail, eff } = useHandViewport();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pressedIdx, setPressedIdx] = useState<number | null>(null);
  const { onPointerMove: onTiltMove, onPointerLeave: onTiltLeave } = useHandTilt(
    setHoveredIdx,
    setPressedIdx,
  );
  const {
    drag,
    returning,
    onPointerDown,
    onPointerMove,
    onPointerEnter,
    onClick,
    onAnimationComplete,
  } = useHandDrag(setHoveredIdx, setPressedIdx, onPlayConfirm);

  const n = cards.length;
  const mid = (n - 1) / 2;
  const dense = n > 8;
  // Wider cards spread farther apart than md so the wider faces stay readable
  // in the fan.
  const kx = SPREAD_X[eff];
  const kd = SPREAD_D[eff];
  // Desktop keeps the tuned fixed fan. Below 640px the small md cards can
  // spread much wider, so fill the container edge-to-edge: tighter as the
  // viewport shrinks, spread way out as it grows.
  const step = kx * (dense ? 2.2 : 3.2);
  const baseDepth = kd * (dense ? 1.4 : 2.4);
  let offset = kx * (dense ? 26 : 38);
  if (eff === "md" && avail > 0) {
    const fit = (avail - (dense ? 124 : 112)) / Math.max(1, n - 1);
    offset = Math.max(dense ? 20 : 32, Math.min(dense ? 48 : 60, fit));
  }
  // The fan arc dips edge cards below the baseline; on the short mobile footer
  // that lands past the viewport. Shift the whole fan up so the edge bottoms
  // sit at the baseline. The staged-card lift is reduced by the same amount,
  // keeping the staged card at its original resting position.
  const narrow = eff === "md";
  const maxEdge = (n - 1) / 2;
  const dipFix = narrow ? Math.min(maxEdge * maxEdge * baseDepth, 38) : 0;

  const inPlay = !!onPlay;
  const anyPlayable =
    inPlay &&
    (playable ? cards.some((c) => playable.includes(c)) : cards.length > 0);

  return (
    <div
      className={cn(
        "relative flex items-end justify-center pb-1 sm:pb-0",
        HAND_HEIGHT[eff],
        anyPlayable && "hand-turn",
      )}
    >
      {cards.map((card, i) => {
        const baseY = Math.pow(i - mid, 2) * baseDepth;
        const angle = (i - mid) * step;
        const clickable = inPlay && (playable ? playable.includes(card) : true);
        const hoverAble = clickable || isHoverable;
        const isStaged = staged === card;
        const hidden = hiddenCards.includes(card);
        const isDragging = drag?.card === card;
        const isReturning = returning === card;
        const interactive = !isDragging && !isReturning;
        const hoverLift = interactive && canHover && hoveredIdx === i;
        const tapLift = interactive && pressedIdx === i;
        // Hovered card's immediate neighbors slide away from it, Balatro-style.
        const neighbor = hoveredIdx !== null && Math.abs(hoveredIdx - i) === 1;
        const nudgeX = neighbor ? (hoveredIdx! > i ? -10 : 10) : 0;
        const nudgeY = neighbor ? 6 : 0;
        // Playable cards sit raised; staged card lifts well clear of the fan.
        const lift = clickable ? 14 : 0;
        // Keep the staged-card lift modest so on small screens it stays inside
        // the short hand container instead of rising into the confirm row.
        const y = baseY - dipFix - lift - (isStaged ? 24 - dipFix : 0) + nudgeY;
        const x = (i - mid) * offset + nudgeX;
        const isTrump = trumpSuit !== null && cardSuit(card) === trumpSuit;
        // Browsable cards (auction) tilt and rise a little, but far less than
        // fully playable ones, so the fan reads as alive without implying a move.
        const tiltable = hoverAble && canHover;
        // Cap deal stagger so big hands still land fast instead of trailing out.
        const settleDelay = Math.min(i, 8) * 0.02;
        const dealDelay = Math.min(i, 6) * 0.05;

        const animate = computeAnimate({
          x,
          y,
          angle,
          isDragging,
          hoverLift,
          tapLift,
          isStaged,
          hidden,
          clickable,
          i,
        });
        const transition = computeTransition({
          isDragging,
          hoverLift,
          tapLift,
          settleDelay,
        });

        return (
          <motion.div
            key={card}
            data-hand-card={card}
            className="absolute origin-bottom touch-manipulation"
            onPointerEnter={onPointerEnter(i, tiltable)}
            onPointerMove={onPointerMove(card, i, tiltable, onTiltMove)}
            onPointerLeave={tiltable ? onTiltLeave : undefined}
            onPointerDown={onPointerDown(card, i, clickable)}
            onClick={onClick(card, clickable, onPlay)}
            initial={{ y: 60, opacity: 0 }}
            animate={animate}
            style={
              hidden || !interactive ? { pointerEvents: "none" } : undefined
            }
            transition={transition}
            onAnimationComplete={onAnimationComplete(card, isReturning)}
          >
            <div
              className={cn(
                "relative rounded-xl",
                tiltable && hoveredIdx === i && "will-change-transform",
                isStaged ? "card-staged" : isTrump ? "card-trump" : "",
              )}
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
                  className={cn(
                    "card-back pointer-events-none absolute inset-0",
                    HAND_CORNER[eff],
                  )}
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
                    isPlayable={clickable}
                    isDimmed={inPlay && !clickable}
                    isTrump={isTrump}
                    onClick={clickable ? () => {} : undefined}
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        );
      })}
      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed top-0 left-0 z-[90]"
            style={{
              transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)`,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0.9 }}
              animate={{ scale: 1.08, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            >
              <PlayingCard card={drag.card} size={eff} isPlayable={false} />
            </motion.div>
          </div>,
          document.body,
        )}
    </div>
  );
};

const computeAnimate = (p: {
  x: number;
  y: number;
  angle: number;
  isDragging: boolean;
  hoverLift: boolean;
  tapLift: boolean;
  isStaged: boolean;
  hidden: boolean;
  clickable: boolean;
  i: number;
}) => {
  if (p.isDragging) {
    return { x: p.x, y: p.y, rotate: p.angle, scale: 1, opacity: 0, zIndex: p.i };
  }
  if (p.hoverLift) {
    return {
      x: p.x,
      y: p.y - (p.clickable ? 26 : 12),
      rotate: 0,
      scale: p.clickable ? 1.12 : 1.05,
      opacity: 1,
      zIndex: p.clickable ? 60 : p.i,
    };
  }
  if (p.tapLift) {
    return { x: p.x, y: p.y - 14, rotate: p.angle, scale: 1.06, opacity: 1, zIndex: p.i };
  }
  if (p.isStaged) {
    return { x: p.x, y: p.y, rotate: p.angle, scale: 1.14, opacity: 1, zIndex: 70 };
  }
  return {
    x: p.x,
    y: p.y,
    rotate: p.angle,
    scale: 1,
    opacity: p.hidden ? 0 : 1,
    zIndex: p.i,
  };
};

const computeTransition = (p: {
  isDragging: boolean;
  hoverLift: boolean;
  tapLift: boolean;
  settleDelay: number;
}): Transition => {
  if (p.isDragging) return { duration: 0 };
  if (p.hoverLift || p.tapLift) {
    return { type: "tween", duration: 0.15, ease: "easeOut", delay: 0 };
  }
  return { type: "tween", duration: 0.2, ease: "easeOut", delay: p.settleDelay };
};

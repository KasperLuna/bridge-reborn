"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  onPlayConfirm,
}: {
  cards: Card[];
  playable?: Card[] | null;
  trumpSuit?: Suit | null;
  staged?: Card | null;
  hiddenCards?: Card[];
  onPlay?: (card: Card) => void;
  /** Drop a playable card on the table to confirm it without staging. */
  onPlayConfirm?: (card: Card, from: { x: number; y: number }) => void;
}) {
  const [narrow, setNarrow] = useState(false);
  const [wide, setWide] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pressedIdx, setPressedIdx] = useState<number | null>(null);
  const dragStart = useRef<{
    card: Card;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  // When a drag ends, pointer-events: none is removed from the returned card
  // under a stationary cursor, which fires a synthetic pointerenter. Timestamp
  // the return-complete moment and ignore enters in the next half-second, so
  // the card doesn't snap up (zIndex 60) over its right neighbors.
  const settleAt = useRef(0);
  const [drag, setDrag] = useState<{
    card: Card;
    x: number;
    y: number;
  } | null>(null);
  // Card settling back into the fan after a drag: keep it out of hover/tap
  // until the spring completes, so releasing over the hand doesn't leave it
  // raised (zIndex 60) on top of the cards to its right.
  const [returning, setReturning] = useState<Card | null>(null);
  const onPlayConfirmRef = useRef(onPlayConfirm);
  onPlayConfirmRef.current = onPlayConfirm;

  // While a card is being dragged it leaves the fan (hidden + pointer-events
  // none), so pointer capture on the card is unreliable. Drive the drag from
  // window listeners instead: they keep firing regardless of what the card
  // does to its own hit-testing. The listeners read the live drag from
  // dragStart, so a release never lands on a stale closure.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragStart.current;
      if (!d?.active) return;
      setDrag({ card: d.card, x: e.clientX, y: e.clientY });
    };
    const onEnd = (e: PointerEvent) => {
      const d = dragStart.current;
      dragStart.current = null;
      setPressedIdx(null);
      if (!d?.active) {
        // Plain click: never started a drag, nothing to clear.
        return;
      }
      e.preventDefault();
      suppressClick.current = true;
      setDrag(null);
      setReturning(d.card);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest("[data-play-drop]"))
        onPlayConfirmRef.current?.(d.card, { x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, []);
  const [avail, setAvail] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth - 24,
  );

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
    setPressedIdx(null);
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
    const onResize = () => setAvail(window.innerWidth - 24);
    window.addEventListener("resize", onResize);
    return () => {
      mqNarrow.removeEventListener("change", update);
      mqWide.removeEventListener("change", update);
      mqHover.removeEventListener("change", update);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Cards scale with the viewport: md on phones, lg on small/tablet screens,
  // xl on wide desktop. The fan must fit the aside (lg fits 36rem, xl fits
  // 40rem), so the larger cards only appear once the aside can hold them.
  const eff = narrow ? "md" : wide ? "xl" : "lg";
  const n = cards.length;
  const mid = (n - 1) / 2;
  const dense = n > 8;
  // Wider cards spread farther apart than md so the wider faces stay readable
  // in the fan.
  const kx = eff === "lg" ? 1.2 : eff === "xl" ? 1.3 : 1;
  const kd = eff === "lg" || eff === "xl" ? 1.05 : 1;
  // Desktop keeps the tuned fixed fan. Below 640px the small md cards can
  // spread much wider, so fill the container edge-to-edge: tighter as the
  // viewport shrinks, spread way out as it grows.
  const step = kx * (dense ? 2.2 : 3.2);
  const baseDepth = kd * (dense ? 1.4 : 2.4);
  let offset = kx * (dense ? 26 : 38);
  if (narrow && avail > 0) {
    const fit = (avail - (dense ? 124 : 112)) / Math.max(1, n - 1);
    offset = Math.max(dense ? 20 : 32, Math.min(dense ? 48 : 60, fit));
  }
  // The fan arc dips edge cards below the baseline; on the short mobile footer
  // that lands past the viewport. Shift the whole fan up so the edge bottoms
  // sit at the baseline. The staged-card lift is reduced by the same amount,
  // keeping the staged card at its original resting position.
  const maxEdge = (n - 1) / 2;
  const dipFix = narrow ? Math.min(maxEdge * maxEdge * baseDepth, 38) : 0;

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
        const baseY = Math.pow(i - mid, 2) * baseDepth;
        const angle = (i - mid) * step;
        const clickable = inPlay && (playable ? playable.includes(card) : true);
        const isStaged = staged === card;
        const hidden = hiddenCards.includes(card);
        const isDragging = drag?.card === card;
        const isReturning = returning === card;
        const interactive = !isDragging && !isReturning;
        const hoverLift = interactive && canHover && hoveredIdx === i;
        const tapLift = interactive && pressedIdx === i;
        // Hovered card's immediate neighbors slide away from it, Balatro-style.
        const neighbor = hoveredIdx !== null && Math.abs(hoveredIdx - i) === 1;
        const nudgeX = neighbor ? (hoveredIdx > i ? -10 : 10) : 0;
        const nudgeY = neighbor ? 6 : 0;
        // Playable cards sit raised; staged card lifts well clear of the fan.
        const lift = clickable ? 14 : 0;
        // Keep the staged-card lift modest so on small screens it stays inside
        // the short hand container instead of rising into the confirm row.
        const y = baseY - dipFix - lift - (isStaged ? 24 - dipFix : 0) + nudgeY;
        const x = (i - mid) * offset + nudgeX;
        const isTrump = trumpSuit !== null && cardSuit(card) === trumpSuit;
        const tiltable = clickable && canHover;
        // Cap deal stagger so big hands still land fast instead of trailing out.
        const settleDelay = Math.min(i, 8) * 0.02;
        const dealDelay = Math.min(i, 6) * 0.05;

        const handlePointerEnter = () => {
          // Synthetic enter fired by removing pointer-events:none under a
          // stationary cursor right after a drag settles. Swallow it so the
          // card doesn't snap up over its right neighbors.
          if (performance.now() - settleAt.current < 500) return;
          if (tiltable) setHoveredIdx(i);
        };
        const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
          if (!clickable) return;
          suppressClick.current = false;
          setPressedIdx(i);
          dragStart.current = {
            card,
            x: e.clientX,
            y: e.clientY,
            active: false,
          };
        };
        const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
          const d = dragStart.current;
          if (d && d.card === card && (e.buttons & 1) !== 0) {
            if (
              !d.active &&
              Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10
            ) {
              d.active = true;
              suppressClick.current = true;
              setHoveredIdx(null);
              setPressedIdx(null);
              setDrag({ card, x: e.clientX, y: e.clientY });
              return;
            }
            if (d.active) return;
          }
          if (tiltable) onTiltMove(e);
        };

        return (
          <motion.div
            key={card}
            data-hand-card={card}
            className="absolute origin-bottom touch-manipulation"
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={tiltable ? resetTilt : undefined}
            onPointerDown={handlePointerDown}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              if (clickable) onPlay?.(card);
            }}
            initial={{ y: 60, opacity: 0 }}
            animate={{
              x,
              y: hoverLift ? y - 26 : tapLift ? y - 14 : y,
              rotate: hoverLift ? 0 : angle,
              scale: hoverLift ? 1.12 : tapLift ? 1.06 : isStaged ? 1.14 : 1,
              opacity: hidden || isDragging ? 0 : 1,
              zIndex: isStaged ? 70 : hoverLift || tapLift ? 60 : i,
            }}
            style={
              hidden || !interactive ? { pointerEvents: "none" } : undefined
            }
            transition={
              isDragging
                ? { duration: 0 }
                : hoverLift || tapLift
                  ? { type: "tween", duration: 0.15, ease: "easeOut", delay: 0 }
                  : {
                      type: "tween",
                      duration: 0.2,
                      ease: "easeOut",
                      delay: settleDelay,
                    }
            }
            onAnimationComplete={
              isReturning
                ? () => {
                    settleAt.current = performance.now();
                    setReturning(null);
                  }
                : undefined
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
              <PlayingCard card={drag.card} size={eff} playable={false} />
            </motion.div>
          </div>,
          document.body,
        )}
    </div>
  );
}

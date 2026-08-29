"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { Card } from "@/lib/game/types";

export type DragState = { card: Card; x: number; y: number };

export type UseHandDrag = {
  drag: DragState | null;
  returning: Card | null;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  setReturning: Dispatch<SetStateAction<Card | null>>;
  onPointerDown: (card: Card, i: number, clickable: boolean) => (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (
    card: Card,
    i: number,
    tiltable: boolean,
    onTiltMove: (e: React.PointerEvent<HTMLElement>) => void,
  ) => (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnter: (i: number, tiltable: boolean) => (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick: (
    card: Card,
    clickable: boolean,
    onPlay?: (card: Card) => void,
  ) => () => void;
  onAnimationComplete: (
    card: Card,
    isReturning: boolean,
  ) => (() => void) | undefined;
};

const DRAG_THRESHOLD = 10;
const SETTLE_GUARD_MS = 500;

export const useHandDrag = (
  setHoveredIdx: Dispatch<SetStateAction<number | null>>,
  setPressedIdx: Dispatch<SetStateAction<number | null>>,
  onPlayConfirm?: (card: Card, from: { x: number; y: number }) => void,
): UseHandDrag => {
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
  const [drag, setDrag] = useState<DragState | null>(null);
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
      document.body.style.cursor = "";
      document.body.classList.remove("hand-dragging");
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
  }, [setPressedIdx]);

  const onPointerDown =
    (card: Card, i: number, clickable: boolean) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
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

  const onPointerMove =
    (
      card: Card,
      _i: number,
      tiltable: boolean,
      onTiltMove: (e: React.PointerEvent<HTMLElement>) => void,
    ) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragStart.current;
      if (d && d.card === card && (e.buttons & 1) !== 0) {
        if (
          !d.active &&
          Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_THRESHOLD
        ) {
          d.active = true;
          suppressClick.current = true;
          document.body.style.cursor = "grabbing";
          document.body.classList.add("hand-dragging");
          setHoveredIdx(null);
          setPressedIdx(null);
          setDrag({ card, x: e.clientX, y: e.clientY });
          return;
        }
        if (d.active) return;
      }
      if (tiltable) onTiltMove(e);
    };

  const onPointerEnter =
    (i: number, tiltable: boolean) =>
    () => {
      // Synthetic enter fired by removing pointer-events:none under a
      // stationary cursor right after a drag settles. Swallow it so the
      // card doesn't snap up over its right neighbors.
      if (performance.now() - settleAt.current < SETTLE_GUARD_MS) return;
      if (tiltable) setHoveredIdx(i);
    };

  const onClick =
    (card: Card, clickable: boolean, onPlay?: (card: Card) => void) =>
    () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      if (clickable) onPlay?.(card);
    };

  const onAnimationComplete = (card: Card, isReturning: boolean) => {
    if (!isReturning) return undefined;
    return () => {
      if (returning === card) {
        settleAt.current = performance.now();
        setReturning(null);
      }
    };
  };

  return {
    drag,
    returning,
    setDrag,
    setReturning,
    onPointerDown,
    onPointerMove,
    onPointerEnter,
    onClick,
    onAnimationComplete,
  };
};

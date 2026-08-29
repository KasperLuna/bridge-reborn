"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";

export type UseHandTilt = {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
};

// Tilt follows the cursor at most once per frame; the layout read + style
// writes live inside the rAF so pointermoves never force per-event reflow.
export const useHandTilt = (
  setHoveredIdx: Dispatch<SetStateAction<number | null>>,
  setPressedIdx: Dispatch<SetStateAction<number | null>>,
): UseHandTilt => {
  const tiltRaf = useRef(0);
  const tiltTarget = useRef<{ el: HTMLElement; x: number; y: number } | null>(
    null,
  );

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
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

  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
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

  return { onPointerMove, onPointerLeave };
};

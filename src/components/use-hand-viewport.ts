"use client";

import { useEffect, useState } from "react";

export type HandEff = "md" | "lg" | "xl";

export type HandViewport = {
  narrow: boolean;
  wide: boolean;
  canHover: boolean;
  /** Window inner width minus 24px side padding; 0 pre-hydration. */
  avail: number;
  eff: HandEff;
};

export const useHandViewport = (): HandViewport => {
  const [narrow, setNarrow] = useState(false);
  const [wide, setWide] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [avail, setAvail] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth - 24,
  );

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
  const eff: HandEff = narrow ? "md" : wide ? "xl" : "lg";

  return { narrow, wide, canHover, avail, eff };
};

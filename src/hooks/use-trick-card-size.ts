"use client";

import { useEffect, useState } from "react";

export type TrickEff = "sm" | "md" | "lg";

export const useTrickCardSize = (): TrickEff => {
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
};

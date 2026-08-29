"use client";

import { motion } from "motion/react";

export const CountdownRing = () => {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <motion.svg
      className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      width={32}
      height={32}
      viewBox="0 0 32 32"
      aria-label="Clearing cards"
    >
      <circle
        cx={16}
        cy={16}
        r={r}
        fill="rgba(6,10,8,0.65)"
        stroke="rgba(186,255,61,0.25)"
        strokeWidth={3}
      />
      <motion.circle
        cx={16}
        cy={16}
        r={r}
        fill="none"
        stroke="var(--color-lime)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: c }}
        transition={{ duration: 7, ease: "linear" }}
        transform="rotate(-90 16 16)"
      />
    </motion.svg>
  );
};

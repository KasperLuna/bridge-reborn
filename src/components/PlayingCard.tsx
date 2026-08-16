"use client";

import { cardRank, cardSuit, displayRank } from "@/lib/game/cards";
import type { Card } from "@/lib/game/types";

const GLYPHS: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const SIZES = {
  xs: "h-9 w-6 rounded-md text-[9px]",
  sm: "h-16 w-11 rounded-lg text-sm",
  md: "h-24 w-16 rounded-xl text-base",
  lg: "h-32 w-22 rounded-2xl text-lg",
} as const;

export function PlayingCard({
  card,
  faceDown = false,
  playable = true,
  dimmed = false,
  trump = false,
  size = "md",
  onClick,
}: {
  card: Card;
  faceDown?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  trump?: boolean;
  size?: keyof typeof SIZES;
  onClick?: () => void;
}) {
  if (faceDown) {
    return <div className={`card-back ${SIZES[size]} shadow-lg select-none`} />;
  }

  const suit = cardSuit(card);
  const rank = displayRank(cardRank(card));
  const red = suit === "H" || suit === "D";
  const color = red ? "text-suit-red" : "text-suit-black";
  const interactive =
    playable && onClick
      ? "cursor-pointer hover:shadow-lime/40 focus-visible:outline-2 focus-visible:outline-lime"
      : "cursor-default";

  if (size === "xs") {
    return (
      <button
        type="button"
        aria-label={card}
        className={`${SIZES.xs} relative bg-cream p-0.5 shadow ${color} cursor-default`}
      >
        <span className="absolute top-0 left-0.5 text-[9px] leading-none font-bold">
          {rank}
        </span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] leading-none">
          {GLYPHS[suit]}
        </span>
      </button>
    );
  }

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!playable || !onClick}
        aria-label={`Play ${card}`}
        className={`${SIZES[size]} relative bg-cream p-0.5 shadow-lg transition-all ${color} ${interactive} ${dimmed ? "brightness-90 saturate-[0.35]" : ""}`}
      >
        <span className="absolute top-0.5 left-1 leading-none font-bold">
          {rank}
        </span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none">
          {GLYPHS[suit]}
        </span>
        {trump && (
          <span
            aria-hidden="true"
            className="card-shimmer pointer-events-none absolute inset-0 rounded-[inherit]"
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!playable || !onClick}
      aria-label={`Play ${card}`}
      className={`${SIZES[size]} relative flex flex-col justify-between bg-cream p-1 shadow-lg transition-all ${color} ${interactive} ${dimmed ? "brightness-90 saturate-[0.35]" : ""}`}
    >
      <span className="flex flex-col items-start pl-0.5 leading-none">
        <span className="font-bold">{rank}</span>
        <span className="text-[0.9em]">{GLYPHS[suit]}</span>
      </span>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[1.6em] leading-none">
        {GLYPHS[suit]}
      </span>
      <span className="flex rotate-180 flex-col items-start pl-0.5 leading-none">
        <span className="font-bold">{rank}</span>
        <span className="text-[0.9em]">{GLYPHS[suit]}</span>
      </span>
      {trump && (
        <span
          aria-hidden="true"
          className="card-shimmer pointer-events-none absolute inset-0 rounded-[inherit]"
        />
      )}
    </button>
  );
}

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { cardRank, cardSuit, displayRank } from "@/lib/game/cards";
import type { Card } from "@/lib/game/types";

const GLYPHS: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const cardSizes = cva("", {
  variants: {
    size: {
      xs: "h-9 w-6 rounded-md text-[9px]",
      sm: "h-16 w-11 rounded-lg text-sm",
      md: "h-24 w-16 rounded-xl text-base",
      lg: "h-32 w-22 rounded-2xl text-lg",
      xl: "h-40 w-28 rounded-2xl text-xl",
    },
  },
  defaultVariants: { size: "md" },
});

interface PlayingCardProps extends VariantProps<typeof cardSizes> {
  card: Card;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  isDimmed?: boolean;
  isTrump?: boolean;
  onClick?: () => void;
}

export const PlayingCard = ({
  card,
  isFaceDown = false,
  isPlayable = true,
  isDimmed = false,
  isTrump = false,
  size = "md",
  onClick,
}: PlayingCardProps) => {
  const sizeClass = cardSizes({ size });

  if (isFaceDown) {
    return (
      <div
        className={`card-back ${sizeClass} shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] select-none`}
      />
    );
  }

  const suit = cardSuit(card);
  const rank = displayRank(cardRank(card));
  const red = suit === "H" || suit === "D";
  const color = red ? "text-suit-red" : "text-suit-black";
  const interactive =
    isPlayable && onClick
      ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-lime"
      : "cursor-default";

  if (size === "xs") {
    return (
      <button
        type="button"
        aria-label={card}
        className={cn(
          sizeClass,
          "relative bg-cream p-0.5 shadow",
          color,
          "cursor-default",
        )}
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
        disabled={!isPlayable || !onClick}
        aria-label={`Play ${card}`}
        className={cn(
          sizeClass,
          "relative overflow-hidden bg-cream p-0.5",
          "shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] transition-all",
          color,
          interactive,
          isDimmed && "brightness-90 saturate-[0.5]",
        )}
      >
        <span className="absolute top-0.5 left-1 flex flex-col items-start leading-none">
          <span className="font-bold">{rank}</span>
          <span className="text-[0.8em]">{GLYPHS[suit]}</span>
        </span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none">
          {GLYPHS[suit]}
        </span>
        {isTrump && (
          <span
            aria-hidden="true"
            className="card-shimmer pointer-events-none absolute top-0 bottom-0 left-[-50%] w-[200%]"
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isPlayable || !onClick}
      aria-label={`Play ${card}`}
      className={cn(
        sizeClass,
        "relative flex flex-col justify-between overflow-hidden bg-cream p-1",
        "shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55)] transition-all",
        color,
        interactive,
        isDimmed && "brightness-90 saturate-[0.5]",
      )}
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
      {isTrump && (
        <span
          aria-hidden="true"
          className="card-shimmer pointer-events-none absolute top-0 bottom-0 left-[-50%] w-[200%]"
        />
      )}
    </button>
  );
};
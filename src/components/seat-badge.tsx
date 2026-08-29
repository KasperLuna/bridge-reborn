import { cva } from "class-variance-authority";
import { Crown } from "lucide-react";

import type { Seat } from "@/lib/game/types";

const seatBadgeStyles = cva(
  "flex items-center gap-1.5 rounded-full border bg-felt-deep/80 px-2.5 py-1 backdrop-blur sm:gap-2 sm:px-3 sm:py-1.5",
  {
    variants: {
      variant: {
        default: "border-cream/15 text-cream-dim",
        active:
          "border-lime/70 text-lime shadow-[0_0_24px_-6px_rgb(186_255_61/45%)] shadow-lime/30",
        winner: "border-lime text-lime",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface SeatBadgeProps {
  seat: Seat;
  username: string | null;
  isMe?: boolean;
  isActive?: boolean;
  isReady?: boolean;
  isWinner?: boolean;
  isCrown?: boolean;
}

export const SeatBadge = ({
  seat,
  username,
  isMe = false,
  isActive = false,
  isReady = false,
  isWinner = false,
  isCrown = false,
}: SeatBadgeProps) => {
  const variant = isWinner ? "winner" : isActive ? "active" : "default";

  return (
    <div className={seatBadgeStyles({ variant })}>
      <span className="relative grid h-7 w-7 place-items-center rounded-full bg-ink/60 font-display text-sm font-bold">
        {seat}
        {isCrown && (
          <Crown
            aria-hidden
            size={10}
            className="absolute -top-1 left-0 -rotate-12 fill-amber-300 text-amber-300"
          />
        )}
      </span>
      <span className="max-w-20 truncate text-sm font-medium sm:max-w-28">
        {username ?? "Open"}
        {isMe && <span className="text-lime/80"> · you</span>}
      </span>
      {isReady && <span className="text-lime">✓</span>}
    </div>
  );
};
"use client";

import type { Seat } from "@/lib/game/types";

export function SeatBadge({
  seat,
  username,
  active = false,
  ready = false,
  isMe = false,
  winner = false,
}: {
  seat: Seat;
  username: string | null;
  active?: boolean;
  ready?: boolean;
  isMe?: boolean;
  winner?: boolean;
}) {
  const ring = winner
    ? "border-lime text-lime"
    : active
      ? "border-lime/70 text-lime shadow-lime/30"
      : "border-cream/15 text-cream-dim";
  const shadow = active ? "shadow-[0_0_24px_-6px_rgb(186_255_61/45%)]" : "";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border bg-felt-deep/80 px-2.5 py-1 backdrop-blur sm:gap-2 sm:px-3 sm:py-1.5 ${ring} ${shadow}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink/60 font-display text-sm font-bold">
        {seat}
      </span>
      <span className="max-w-20 truncate text-sm font-medium sm:max-w-28">
        {username ?? "Open"}
        {isMe && <span className="text-lime/80"> · you</span>}
      </span>
      {ready && <span className="text-lime">✓</span>}
    </div>
  );
}

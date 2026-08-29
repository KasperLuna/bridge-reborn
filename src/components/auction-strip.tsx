"use client";

import { cva } from "class-variance-authority";

import { formatCall } from "@/lib/game/bidding";
import { cn } from "@/lib/utils";

import type { AuctionEntryView } from "@/components/auction-chips";

interface AuctionStripProps {
  entries: AuctionEntryView[];
}

const chipStyles = cva("rounded-md px-2 py-0.5 text-base font-semibold", {
  variants: {
    kind: {
      pass: "bg-cream/5 text-cream-dim",
      double: "bg-danger/15 text-danger",
      bid: "bg-lime/15 text-lime",
    },
  },
});

function chipKind(call: string): "pass" | "double" | "bid" {
  if (call === "P") return "pass";
  if (call === "X" || call === "XX") return "double";
  return "bid";
}

export const AuctionStrip = ({ entries }: AuctionStripProps) => {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-cream/10 bg-felt-deep/70 p-5 text-center backdrop-blur">
        <p className="font-display text-lg text-cream">Auction opens</p>
        <p className="mt-1 text-xs tracking-[0.3em] text-cream-dim/60 uppercase">
          no bids yet
        </p>
      </div>
    );
  }
  return (
    <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-cream/10 bg-felt-deep/70 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {entries.map((e, i) => (
          <span
            key={`${e.side}-${e.call}-${e.username}-${i}`}
            className={cn(chipStyles({ kind: chipKind(e.call) }))}
          >
            {formatCall(e.call)}
            <span className="ml-1 max-w-16 truncate text-[10px] opacity-60">
              {e.username}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

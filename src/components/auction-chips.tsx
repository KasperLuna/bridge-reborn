"use client";

import { cva } from "class-variance-authority";

import { formatCall } from "@/lib/game/bidding";
import { cn } from "@/lib/utils";

export type AuctionEntryView = {
  call: string;
  side: "NS" | "EW";
  username: string;
};

interface AuctionChipsProps {
  entries: AuctionEntryView[];
}

const chipStyles = cva("rounded-md px-2 py-0.5 text-base font-semibold", {
  variants: {
    kind: {
      pass: "bg-cream/5 text-cream-dim",
      double: "bg-danger/15 text-danger",
      bid: "bg-lime/15 text-lime",
    },
    recent: {
      true: "",
      false: "opacity-50",
    },
  },
});

function chipKind(call: string): "pass" | "double" | "bid" {
  if (call === "P") return "pass";
  if (call === "X" || call === "XX") return "double";
  return "bid";
}

export const AuctionChips = ({ entries }: AuctionChipsProps) => {
  const lastEntries = entries.slice(-6);
  if (lastEntries.length === 0) {
    return (
      <span className="text-sm text-cream-dim/50">Auction opens here</span>
    );
  }
  return (
    <>
      {lastEntries.map((e, i) => {
        // Older calls are stale context; the last few carry the current read,
        // so keep only them at full weight and with their usernames.
        const recent = i >= lastEntries.length - 3;
        return (
          <span
            key={`${e.side}-${e.call}-${e.username}-${i}`}
            className={cn(
              chipStyles({
                kind: chipKind(e.call),
                recent,
              }),
            )}
          >
            {formatCall(e.call)}
            {recent && (
              <span className="ml-1 max-w-16 truncate text-[10px] opacity-60">
                {e.username}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
};

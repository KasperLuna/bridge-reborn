"use client";

import type { LegalCalls } from "@/lib/game/bidding";
import { bidValue } from "@/lib/game/bidding";
import type { Strain } from "@/lib/game/types";

import { Button } from "./ui/Button";

const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
const STRAINS: Strain[] = ["C", "D", "H", "S", "NT"];

export function AuctionPanel({
  entries,
  legal,
  myTurn,
  disabled,
  staged = null,
  onCall,
}: {
  entries: { call: string; side: "NS" | "EW"; username: string }[];
  legal: LegalCalls;
  myTurn: boolean;
  disabled: boolean;
  staged?: string | null;
  onCall: (call: string) => void;
}) {
  const selected = (call: string) =>
    staged === call
      ? "border-lime/60 bg-lime/15 text-lime"
      : "border-cream/10 bg-cream/5 text-cream hover:border-lime/60 hover:text-lime";
  const locked = disabled || !myTurn;
  const lastEntries = entries.slice(-6);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col gap-3 overflow-hidden rounded-2xl border border-cream/10 bg-felt-deep/70 p-3 backdrop-blur">
      {/* History */}
      <div className="flex min-h-8 flex-wrap items-center gap-1.5">
        {lastEntries.length === 0 && (
          <span className="text-sm text-cream-dim/50">Auction opens here</span>
        )}
        {lastEntries.map((e, i) => (
          <span
            key={i}
            className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
              e.call === "P"
                ? "bg-cream/5 text-cream-dim"
                : e.call === "X" || e.call === "XX"
                  ? "bg-danger/15 text-danger"
                  : "bg-lime/15 text-lime"
            }`}
          >
            {e.call}
            <span className="ml-1 max-w-16 truncate text-[10px] opacity-60">
              {e.username}
            </span>
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className={`flex-1 ${selected("P")}`}
          disabled={locked || !legal.canPass}
          onClick={() => onCall("P")}
        >
          Pass
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 ${selected("X")}`}
          disabled={locked || !legal.canDouble}
          onClick={() => onCall("X")}
        >
          Double
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 ${selected("XX")}`}
          disabled={locked || !legal.canRedouble}
          onClick={() => onCall("XX")}
        >
          Redouble
        </Button>
      </div>

      {/* Bid grid */}
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(2rem,1fr)] grid-cols-5 gap-1 overflow-y-auto">
        {LEVELS.map((level) =>
          STRAINS.map((strain) => {
            const call = `${level}${strain}`;
            const value = bidValue(level, strain);
            const allowed =
              legal.canBid &&
              (legal.minBidValue === null || value >= legal.minBidValue);
            return (
              <button
                key={call}
                type="button"
                disabled={locked || !allowed}
                onClick={() => onCall(call)}
                className="min-h-8 rounded-lg border border-cream/10 bg-cream/5 text-sm font-semibold text-cream transition-colors hover:border-lime/60 hover:text-lime disabled:cursor-not-allowed disabled:opacity-30"
              >
                {call}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

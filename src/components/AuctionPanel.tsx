"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import type { LegalCalls } from "@/lib/game/bidding";
import { bidValue } from "@/lib/game/bidding";
import type { Strain } from "@/lib/game/types";

import { Button } from "./ui/Button";

const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
const STRAINS: Strain[] = ["C", "D", "H", "S", "NT"];

export type AuctionEntryView = {
  call: string;
  side: "NS" | "EW";
  username: string;
};

/** Read-only chips of recent calls, shared by the live panel and the
    not-my-turn waiting view. */
export function AuctionChips({ entries }: { entries: AuctionEntryView[] }) {
  const lastEntries = entries.slice(-6);
  if (lastEntries.length === 0) {
    return (
      <span className="text-sm text-cream-dim/50">Auction opens here</span>
    );
  }
  return (
    <>
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
    </>
  );
}

/** Confirm-row wording for a staged call. */
function bidLabel(call: string): string {
  if (call === "P") return "Pass?";
  if (call === "X") return "Double?";
  if (call === "XX") return "Redouble?";
  return `Bid ${call}?`;
}

function bidConfirm(call: string): string {
  if (call === "P") return "Pass";
  if (call === "X") return "Double";
  if (call === "XX") return "Redouble";
  return "Bid";
}

export function AuctionPanel({
  entries,
  legal,
  myTurn,
  disabled,
  onCall,
}: {
  entries: AuctionEntryView[];
  legal: LegalCalls;
  myTurn: boolean;
  disabled: boolean;
  onCall: (call: string) => void;
}) {
  const [staged, setStaged] = useState<string | null>(null);
  const [low, setLow] = useState(false);
  const locked = disabled || !myTurn;
  const selected = (call: string) =>
    staged === call
      ? "border-lime/60 bg-lime/15 text-lime"
      : "border-cream/10 bg-cream/5 text-cream hover:border-lime/60 hover:text-lime";

  const toggle = (direction: "high" | "low") => () => {
    setStaged(null);
    setLow(direction === "low");
  };

  return (
    <div className="mx-auto flex h-full max-h-[28rem] min-h-0 w-full max-w-md flex-col gap-3 overflow-hidden rounded-2xl border border-cream/10 bg-felt-deep/70 p-3 backdrop-blur">
      {/* History */}
      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-1.5">
        <AuctionChips entries={entries} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          className={`flex-1 ${selected("P")}`}
          disabled={locked || !legal.canPass}
          onClick={() => setStaged((cur) => (cur === "P" ? null : "P"))}
        >
          Pass
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 ${selected("X")}`}
          disabled={locked || !legal.canDouble}
          onClick={() => setStaged((cur) => (cur === "X" ? null : "X"))}
        >
          Double
        </Button>
        <Button
          variant="ghost"
          className={`flex-1 ${selected("XX")}`}
          disabled={locked || !legal.canRedouble}
          onClick={() => setStaged((cur) => (cur === "XX" ? null : "XX"))}
        >
          Redouble
        </Button>
      </div>

      {/* Direction toggle (uptown = high cards win, downtown = low cards win) */}
      <div className="group relative flex shrink-0 items-center justify-center gap-1.5 self-center">
        <div className="flex items-center gap-1 rounded-full border border-cream/10 bg-ink/40 p-0.5">
          {(["high", "low"] as const).map((d) => {
            const active = (d === "low") === low;
            return (
              <button
                key={d}
                type="button"
                disabled={locked}
                onClick={toggle(d)}
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-40 ${
                  active
                    ? "bg-lime/15 text-lime"
                    : "text-cream-dim/70 hover:text-cream"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="What do High and Low mean?"
          title="Uptown vs downtown rules"
          className="grid h-5 w-5 place-items-center rounded-full text-cream-dim/50 transition-colors hover:text-lime focus:text-lime focus:outline-none"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        <div className="pointer-events-none absolute top-full z-10 mt-1 hidden w-60 rounded-xl border border-cream/10 bg-ink/95 p-2.5 text-xs leading-relaxed text-cream-dim shadow-xl group-hover:block group-focus-within:block">
          <span className="font-semibold text-cream">Uptown (High)</span> — the
          highest card wins each trick. <span className="font-semibold text-cream">Downtown
          (Low)</span> — the lowest card wins, and you lead your smallest card.
          Applies for the whole hand.
        </div>
      </div>

      {/* Bid grid */}
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(2rem,1fr)] grid-cols-5 gap-1 overflow-y-auto">
        {LEVELS.map((level) =>
          STRAINS.map((strain) => {
            const call = `${low ? "L" : ""}${level}${strain}`;
            const value = bidValue(level, strain, low ? "low" : "high");
            const allowed = low
              ? legal.maxBidValue === null || value < legal.maxBidValue
              : legal.canBid &&
                (legal.minBidValue === null || value >= legal.minBidValue);
            return (
              <button
                key={call}
                type="button"
                disabled={locked || !allowed}
                onClick={() => setStaged((cur) => (cur === call ? null : call))}
                className={`min-h-8 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${selected(
                  call,
                )}`}
              >
                {call}
              </button>
            );
          }),
        )}
      </div>

      {/* Confirm row: always reserved so staging never shifts the panel. */}
      <div className="flex h-11 shrink-0 items-center justify-center gap-2">
        {staged && (
          <>
            <span className="text-sm text-cream">{bidLabel(staged)}</span>
            <Button
              disabled={disabled}
              onClick={() => {
                setStaged(null);
                onCall(staged);
              }}
            >
              {bidConfirm(staged)}
            </Button>
            <Button variant="ghost" onClick={() => setStaged(null)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

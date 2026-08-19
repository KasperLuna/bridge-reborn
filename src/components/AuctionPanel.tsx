"use client";

import { useState } from "react";

import type { LegalCalls } from "@/lib/game/bidding";
import {
  bidAllowed,
  formatCall,
  lastBid,
  parseAuctionCall,
  passNeed,
} from "@/lib/game/bidding";
import type { Partnership, Strain } from "@/lib/game/types";

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
          className={`rounded-md px-2 py-0.5 text-base font-semibold ${
            e.call === "P"
              ? "bg-cream/5 text-cream-dim"
              : e.call === "X" || e.call === "XX"
                ? "bg-danger/15 text-danger"
                : "bg-lime/15 text-lime"
          }`}
        >
          {formatCall(e.call)}
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
  return `Bid ${formatCall(call)}?`;
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
  mySide,
  myTurn,
  disabled,
  onCall,
}: {
  entries: AuctionEntryView[];
  legal: LegalCalls;
  mySide: Partnership;
  myTurn: boolean;
  disabled: boolean;
  onCall: (call: string) => void;
}) {
  const [staged, setStaged] = useState<string | null>(null);
  const [low, setLow] = useState(false);
  const stagedCall = staged !== null ? parseAuctionCall(staged) : null;
  const stagedLevel = stagedCall?.kind === "bid" ? stagedCall.level : null;
  const passNeedInfo = staged === "P" ? passNeed(entries, mySide) : null;
  const locked = disabled || !myTurn;
  const selected = (call: string) =>
    staged === call
      ? "border-lime/60 bg-lime/15 text-lime"
      : "border-cream/10 bg-cream/5 text-cream hover:border-lime/60 hover:text-lime";
  // Compact on tiny screens so the action row keeps its height budget; the
  // important prefix beats Button's fixed min-h/px at the base breakpoint.
  const actionTile =
    "flex-1 text-xs !px-2 !py-1 !min-h-9 sm:text-sm sm:!px-4 sm:!py-2 sm:!min-h-11";

  const toggle = (direction: "high" | "low") => () => {
    const toLow = direction === "low";
    setLow(toLow);
    // Keep a staged bid across the flip if it stays legal; a stale staged
    // call would silently encode the wrong direction otherwise.
    if (staged === null) return;
    const sc = parseAuctionCall(staged);
    if (sc.kind === "bid") {
      const call = `${toLow ? "L" : ""}${sc.level}${sc.strain}`;
      if (bidAllowed(legal, sc.level, sc.strain, toLow)) {
        setStaged(call);
        return;
      }
    }
    setStaged(null);
  };

  const allowed = (level: number, strain: Strain) =>
    bidAllowed(legal, level, strain, low);
  const levelAllowed = (level: number) =>
    STRAINS.some((strain) => allowed(level, strain));
  // Default strain on a level tap: reuse the standing bid's strain if legal,
  // else the top-ranking legal one. Lets a jump-bidder go straight to confirm.
  const defaultStrain = (level: number): Strain => {
    const last = lastBid(entries);
    if (last) {
      const c = parseAuctionCall(last.entry.call);
      if (
        c.kind === "bid" &&
        c.direction === (low ? "low" : "high") &&
        allowed(level, c.strain)
      ) {
        return c.strain;
      }
    }
    for (const strain of [...STRAINS].reverse()) {
      if (allowed(level, strain)) return strain;
    }
    return STRAINS[0]!;
  };
  const stageLevel = (level: number) => {
    if (stagedCall?.kind === "bid" && stagedCall.level === level) {
      setStaged(null);
      return;
    }
    setStaged(`${low ? "L" : ""}${level}${defaultStrain(level)}`);
  };

  return (
    <div className="mx-auto flex max-h-[min(28rem,calc(100cqh-4rem))] w-full max-w-md flex-col gap-2 overflow-y-auto rounded-2xl border border-cream/10 bg-felt-deep/70 p-3 backdrop-blur">
      {/* History: chips wrap; panel scrolls as fallback if the wrap inflates
          the vertical budget past the cap. */}
      <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-1.5">
        <AuctionChips entries={entries} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          className={`${actionTile} ${selected("P")}`}
          disabled={locked || !legal.canPass}
          onClick={() => setStaged((cur) => (cur === "P" ? null : "P"))}
        >
          Pass
        </Button>
        <Button
          variant="ghost"
          className={`${actionTile} ${selected("X")}`}
          disabled={locked || !legal.canDouble}
          onClick={() => setStaged((cur) => (cur === "X" ? null : "X"))}
        >
          Double
        </Button>
        <Button
          variant="ghost"
          className={`${actionTile} ${selected("XX")}`}
          disabled={locked || !legal.canRedouble}
          onClick={() => setStaged((cur) => (cur === "XX" ? null : "XX"))}
        >
          Redouble
        </Button>
      </div>

      {/* Direction toggle (uptown = high cards win, downtown = low cards win) */}
      <div className="flex shrink-0 items-center justify-center gap-1.5 self-center">
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
                {d === "high" ? "▲ Uptown" : "▼ Downtown"}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-center text-[11px] text-cream-dim/70">
          {low
            ? "▼ Downtown — low cards win; smaller bid outranks"
            : "▲ Uptown — high cards win; bigger bid outranks"}
        </p>
      </div>

      {/* Bid level, then strain: price first, preference second. Level tap
          stages with a default strain so jump-bidders confirm in one tap.
          This block is the only scrollable part of the panel, so on very
          short screens the history and confirm rows never get clipped. The
          min-h floor keeps the tiles on screen even when the panel's cap
          shrinks the available space to near zero. */}
      <div className="flex min-h-[4.5rem] flex-1 flex-col gap-1.5 overflow-y-auto">
        <div className="grid shrink-0 grid-cols-7 gap-1">
          {LEVELS.map((level) => {
            const active =
              stagedCall?.kind === "bid" && stagedCall.level === level;
            return (
              <button
                key={level}
                type="button"
                disabled={locked || !levelAllowed(level)}
                onClick={() => stageLevel(level)}
                className={`min-h-8 rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                  active
                    ? "border-lime/60 bg-lime/15 text-lime"
                    : "border-cream/10 bg-cream/5 text-cream hover:border-lime/60 hover:text-lime"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
        {/* Strain row reserved (height, not content) so staging never shifts
            the panel; level is already shown above, so bare strains suffice. */}
        <div className="grid min-h-8 shrink-0 grid-cols-5 gap-1">
          {stagedCall?.kind === "bid"
            ? STRAINS.map((strain) => {
                const call = `${low ? "L" : ""}${stagedCall.level}${strain}`;
                return (
                  <button
                    key={strain}
                    type="button"
                    disabled={locked || !allowed(stagedCall.level, strain)}
                    onClick={() => setStaged(call)}
                    className={`min-h-8 rounded-lg border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${selected(
                      call,
                    )}`}
                  >
                    {strain}
                  </button>
                );
              })
            : null}
        </div>
      </div>

      {/* Confirm row: always reserved so staging never shifts the panel. */}
      <div className="flex h-14 shrink-0 flex-col items-center justify-center gap-1">
        {staged && (
          <>
            <div className="flex items-center justify-center gap-2">
              <span className="text-base text-cream">{bidLabel(staged)}</span>
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
            </div>
            {stagedLevel !== null && (
              <p className="text-xs text-cream-dim">
                Need {stagedLevel + 6} · opponents need {8 - stagedLevel}.
              </p>
            )}
            {passNeedInfo && (
              <p className="text-xs text-cream-dim">
                {passNeedInfo.contractIsMine
                  ? `Need ${passNeedInfo.level + 6} · opponents need ${
                      8 - passNeedInfo.level
                    }.`
                  : `Opponents need ${passNeedInfo.level + 6} · you need ${
                      8 - passNeedInfo.level
                    }.`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

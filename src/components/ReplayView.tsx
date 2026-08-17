"use client";

import { useEffect, useMemo, useState } from "react";

import { PlayingCard } from "@/components/PlayingCard";
import { SeatBadge } from "@/components/SeatBadge";
import { TrickArea, type TableDir } from "@/components/TrickArea";
import { Button } from "@/components/ui/Button";
import {
  fetchGameBundle,
  type GameBundle,
  type HandBundle,
} from "@/lib/gameBundle";
import { partnershipOf, seatOfUsername } from "@/lib/game/seats";
import type { Seat } from "@/lib/game/types";
import {
  buildHandEvents,
  countEvents,
  orderedPlays,
  sliceTo,
  visibleTricks,
  type ReplayEvent,
} from "@/lib/replay";
import { badgeClass, SEATS, seatDir } from "@/lib/table-layout";
import {
  auctionEntries,
  contractShorthand,
  myCards,
  players,
  trickPlaysFor,
} from "@/store/selectors";

const PLAY_MS = 1500;

type HandTimeline = {
  handNumber: number;
  start: number;
  count: number;
  events: ReplayEvent[];
  handBundle: HandBundle;
};

/**
 * Whole-game replay. Events across all hands are flattened into one timeline
 * (bids then plays per hand); the scrubber index truncates the current hand's
 * records and feeds the existing selectors to render that moment.
 */
export function ReplayView({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
}) {
  const [bundle, setBundle] = useState<GameBundle | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setBundle(null);
    setIndex(0);
    setPlaying(false);
    fetchGameBundle(roomId)
      .then((b) => {
        if (!disposed) setBundle(b);
      })
      .catch(() => {
        if (!disposed) setBundle(null);
      });
    return () => {
      disposed = true;
    };
  }, [open, roomId]);

  const timeline = useMemo(() => {
    if (!bundle?.game) return [];
    const p = players(bundle.game);
    let start = 0;
    return bundle.hands.map((hb) => {
      const events = buildHandEvents(
        hb.bids,
        hb.plays,
        hb.tricks,
        hb.hand.hand_number,
        (u) => seatOfUsername(p, u),
      );
      const count = countEvents(hb.bids, hb.plays);
      const tl = {
        handNumber: hb.hand.hand_number,
        start,
        count,
        events,
        handBundle: hb,
      };
      start += count;
      return tl;
    });
  }, [bundle]);

  const total = useMemo(
    () => timeline.reduce((s, t) => s + t.count, 0),
    [timeline],
  );

  // Auto-advance one step at a time while playing; stop at the end.
  useEffect(() => {
    if (!open || !playing) return;
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(
      () => setIndex((i) => Math.min(total, i + 1)),
      PLAY_MS,
    );
    return () => clearTimeout(t);
  }, [open, playing, index, total]);

  // The hand whose event range contains the global index. A global index equal
  // to a hand's end stays on that hand (its local index == count → result view).
  const current = useMemo<{ tl: HandTimeline; local: number } | null>(() => {
    const i = Math.max(0, Math.min(index, total));
    for (const t of timeline) {
      if (i <= t.start + t.count) {
        return { tl: t, local: i - t.start };
      }
    }
    const last = timeline[timeline.length - 1];
    return last ? { tl: last, local: last.count } : null;
  }, [index, total, timeline]);

  const lastEvent = useMemo(() => {
    if (index === 0) return null;
    const offset = index - 1;
    for (const t of timeline) {
      if (offset >= t.start && offset < t.start + t.count) {
        return t.events[offset - t.start] ?? null;
      }
    }
    return null;
  }, [index, timeline]);

  const state = useMemo(() => {
    if (!current || !bundle?.game) return null;
    const hb = current.tl.handBundle;
    const game = bundle.game;
    const ordered = orderedPlays(hb.plays, hb.tricks);
    const { bids, plays } = sliceTo(hb.bids, ordered, current.local);
    const auction = auctionEntries(bids, game);
    const auctionDone = hb.bids.length > 0 && bids.length >= hb.bids.length;
    const contract = auctionDone ? hb.contract : null;
    const phase = contract ? "play" : "auction";
    // Completed tricks (for trick tallies) plus the trick the last play is in,
    // which is always the open one regardless of the winner flag (replay shows
    // finished tricks from records that already carry winners).
    const complete = visibleTricks(hb.tricks, plays);
    const openId = plays.at(-1)?.trick_id;
    const openTrick = openId
      ? (hb.tricks.find((t) => t.id === openId) ?? null)
      : null;
    const trickCards = openTrick
      ? trickPlaysFor(openTrick.id, plays).map((pl) => ({
          card: pl.card,
          seat: pl.seat,
        }))
      : [];
    const trumpSuit =
      contract && contract.strain !== "NT" ? contract.strain : null;
    const playedBySeat: Record<Seat, Set<string>> = {
      N: new Set(),
      E: new Set(),
      S: new Set(),
      W: new Set(),
    };
    for (const pl of plays) playedBySeat[pl.seat].add(pl.card);
    const nsTricks = complete.filter(
      (t) => partnershipOf(t.winner_seat) === "NS",
    ).length;
    return {
      usernames: players(game),
      auction,
      phase,
      contractShorthand: contractShorthand(contract),
      trickCards,
      trumpSuit,
      fanCards: SEATS.map((seat) => ({
        seat,
        cards: myCards(hb.hand, seat).filter((c) => !playedBySeat[seat].has(c)),
      })),
      nsTricks,
      ewTricks: complete.length - nsTricks,
      over: current.local >= current.tl.count,
      result: hb.result,
    };
  }, [current, bundle]);

  const dirs = useMemo(
    () =>
      SEATS.reduce(
        (acc, s) => {
          acc[s] = seatDir(s, null);
          return acc;
        },
        {} as Record<Seat, TableDir>,
      ),
    [],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-sm">
      <header className="flex items-center justify-between gap-2 p-3 sm:p-4">
        <div className="text-sm text-cream-dim">
          <span className="mr-2 rounded-lg bg-cream/5 px-2 py-1 font-mono tracking-widest">
            replay
          </span>
          {current ? (
            <span>
              Hand {current.tl.handNumber} of {timeline.length}
            </span>
          ) : (
            <span>Loading…</span>
          )}
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </header>

      {!state ? (
        <div className="grid flex-1 place-items-center text-cream-dim">
          {bundle ? "No game yet" : "Loading replay…"}
        </div>
      ) : (
        <>
          <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 items-center justify-center px-3 sm:px-4">
            <div className="felt relative aspect-square max-h-full w-full rounded-4xl sm:aspect-square sm:h-full sm:w-auto sm:max-w-full">
              {SEATS.map((seat) => (
                <div
                  key={seat}
                  className={`absolute z-20 ${badgeClass(
                    seatDir(seat, null),
                    state.phase === "auction",
                  )}`}
                >
                  <SeatBadge seat={seat} username={state.usernames[seat]} />
                </div>
              ))}

              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4">
                {state.phase === "auction" ? (
                  <AuctionStrip entries={state.auction} />
                ) : (
                  <>
                    <AuctionStrip entries={state.auction} compact />
                    <TrickArea
                      cards={state.trickCards}
                      winner={null}
                      positions={dirs}
                      trumpSuit={state.trumpSuit}
                    />
                  </>
                )}
              </div>

              {state.over && (
                <div className="absolute inset-0 z-30 grid place-items-center p-4">
                  <div className="felt w-full max-w-xs rounded-3xl p-5 text-center">
                    <p className="text-xs tracking-[0.3em] text-lime/70 uppercase">
                      Hand over
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-bold text-cream">
                      {state.result
                        ? `${state.contractShorthand} ${state.result.result_delta >= 0 ? "+" : ""}${state.result.result_delta}`
                        : "Passed out"}
                    </h3>
                    <div className="mt-3 flex justify-center gap-6 text-sm">
                      <span className="text-cream-dim">
                        NS{" "}
                        <span className="font-display text-lg text-cream">
                          {state.result?.ns_score ?? 0}
                        </span>{" "}
                        <span className="text-xs">
                          · {state.nsTricks} tricks
                        </span>
                      </span>
                      <span className="text-cream-dim">
                        EW{" "}
                        <span className="font-display text-lg text-cream">
                          {state.result?.ew_score ?? 0}
                        </span>{" "}
                        <span className="text-xs">
                          · {state.ewTricks} tricks
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-4xl grid-cols-2 gap-2 px-3 sm:mx-auto sm:grid-cols-4">
            {state.fanCards.map(({ seat, cards }) => (
              <div key={seat} className="rounded-xl bg-cream/5 p-2">
                <p className="mb-1 text-center text-xs text-cream-dim">
                  {seat} · {state.usernames[seat]}
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {cards.map((card) => (
                    <PlayingCard
                      key={card}
                      card={card}
                      size="xs"
                      playable={false}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 sm:p-4">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  aria-label="Previous step"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  ‹
                </Button>
                <Button
                  variant={playing ? "ghost" : "primary"}
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? "Pause" : "Play"}
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Next step"
                  onClick={() => setIndex((i) => Math.min(total, i + 1))}
                >
                  ›
                </Button>
                <span className="ml-auto text-sm text-cream-dim">
                  {index} / {total}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={total}
                value={index}
                onChange={(e) => {
                  setPlaying(false);
                  setIndex(Number(e.target.value));
                }}
                className="w-full accent-lime"
              />
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-cream-dim">Last</span>
                <span className="rounded-md bg-cream/5 px-2 py-0.5 text-sm font-semibold text-cream">
                  {lastEvent
                    ? `${lastEvent.seat ? `${lastEvent.seat}: ` : ""}${lastEvent.label}`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact history of the auction so far, styled like the live auction chips. */
function AuctionStrip({
  entries,
  compact = false,
}: {
  entries: { call: string; username: string; side: "NS" | "EW" }[];
  compact?: boolean;
}) {
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
  const shown = compact ? entries.slice(-10) : entries;
  return (
    <div
      className={`max-h-full w-full overflow-y-auto rounded-2xl border border-cream/10 bg-felt-deep/70 p-4 backdrop-blur ${
        compact ? "max-w-xs px-3 py-2" : "max-w-md"
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {shown.map((e, i) => (
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
    </div>
  );
}

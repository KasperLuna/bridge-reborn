"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Settings } from "lucide-react";

import { AuctionChips, AuctionPanel } from "@/components/AuctionPanel";
import { Hand } from "@/components/Hand";
import { KickDialog } from "@/components/KickPanel";
import {
  markOnboardingSeen,
  OnboardingModal,
  onboardingSeen,
} from "@/components/OnboardingModal";
import { PlayingCard } from "@/components/PlayingCard";
import { ReplayView } from "@/components/ReplayView";
import { Scoreboard } from "@/components/Scoreboard";
import { SeatBadge } from "@/components/SeatBadge";
import {
  TrickArea,
  type TableDir,
  type TrickEff,
  useTrickCardSize,
} from "@/components/TrickArea";
import { Button } from "@/components/ui/Button";
import { useGameSync } from "@/hooks/useGameSync";
import { useRoomSync } from "@/hooks/useRoomSync";
import { useTurnAlerts } from "@/hooks/useTurnAlerts";
import { formatCall } from "@/lib/game/bidding";
import { sortHand, sortHandByRank } from "@/lib/game/cards";
import { ddOutcome } from "@/lib/game/scoring";
import { opponentsOf, partnershipOf, seatOfUsername } from "@/lib/game/seats";
import type { Card, DdResult, GamePlayers, Seat } from "@/lib/game/types";
import { resolveRuleset } from "@/lib/rulesets";
import { badgeClass, SEATS, seatDir } from "@/lib/table-layout";
import type { HandResultRecord, PlayRecord, RoomMode } from "@/lib/types";
import { useGameStore } from "@/store/game-store";
import { useRoomStore } from "@/store/room-store";
import { useSessionStore } from "@/store/session-store";
import {
  allFourReady,
  auctionEntries,
  bidTurnSeat,
  contractShorthand,
  currentTrick,
  legalBidsForMe,
  legalCardsForMe,
  myCards,
  players,
  playTurnSeat,
  seatAt,
  trickPlaysFor,
} from "@/store/selectors";

/**
 * The seat a play came from. Plays record their seat explicitly; fall back to
 * the old username→seat mapping for records created before the migration.
 */
function seatOfPlay(pl: PlayRecord, p: GamePlayers): Seat {
  if (pl.seat) return pl.seat;
  return seatOfUsername(p, pl.username) ?? "N";
}

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const session = useSessionStore((s) => s.session);
  const loaded = useSessionStore((s) => s.loaded);
  const init = useSessionStore((s) => s.init);
  const room = useRoomStore((s) => s.room);
  const seats = useRoomStore((s) => s.seats);
  const ready = useRoomStore((s) => s.ready);
  const claim = useRoomStore((s) => s.claim);
  const leave = useRoomStore((s) => s.leave);

  const hand = useGameStore((s) => s.hand);
  const bids = useGameStore((s) => s.bids);
  const contract = useGameStore((s) => s.contract);
  const tricks = useGameStore((s) => s.tricks);
  const plays = useGameStore((s) => s.plays);
  const result = useGameStore((s) => s.result);
  const error = useGameStore((s) => s.error);
  const pending = useGameStore((s) => s.pending);
  const bid = useGameStore((s) => s.bid);
  const play = useGameStore((s) => s.play);
  const concede = useGameStore((s) => s.concede);
  const startNewGame = useGameStore((s) => s.startNewGame);

  const [spectatorVisible, setSpectatorVisible] = useState(false);
  const [handSort, setHandSort] = useState<"suit" | "rank">("suit");
  const [staged, setStaged] = useState<{ card: Card; seat: Seat } | null>(null);
  const [playAnim, setPlayAnim] = useState<{
    card: Card;
    seat: Seat;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [showAuction, setShowAuction] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [kickOpen, setKickOpen] = useState(false);
  const [peekOther, setPeekOther] = useState(false);
  const peekRef = useRef<HTMLDivElement | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [wonAnim, setWonAnim] = useState<{
    trickId: string;
    winnerSeat: Seat;
    winnerName: string;
    phase: "collect" | "fly" | "gone";
  } | null>(null);
  const [winnerTarget, setWinnerTarget] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const seatBadgeRefs = useRef<Partial<Record<Seat, HTMLDivElement | null>>>(
    {},
  );

  useGameSync(session);
  useRoomSync(session);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loaded) return;
    if (!session) {
      router.replace("/");
      return;
    }
    if (room?.status === "waiting") router.replace(`/room/${session.code}`);
  }, [loaded, session, room?.status, router]);

  useEffect(() => {
    if (!onboardingSeen()) setShowOnboarding(true);
  }, []);

  // When a trick is won, drive the winner animation: cards flip & fly under
  // the winner's name, then the middle clears after a 7s countdown.
  const lastWon = useMemo(
    () =>
      [...tricks]
        .filter((t) => t.winner_username)
        .sort((a, b) => b.trick_number - a.trick_number)[0] ?? null,
    [tricks],
  );

  useEffect(() => {
    if (!hand || !lastWon) {
      // Nothing to animate (e.g. a new game just started and tricks cleared).
      setWonAnim(null);
      return;
    }
    const ws =
      (lastWon.winner_seat as Seat | undefined) ??
      seatOfUsername(players(hand), lastWon.winner_username);
    const name = ws ? players(hand)[ws] : null;
    if (!ws || !name) return;
    setWonAnim({
      trickId: lastWon.id,
      winnerSeat: ws,
      winnerName: name,
      phase: "collect",
    });
    // Cards hold on the table through the 7s countdown, then fly to the winner.
    const t = setTimeout(() => {
      setWonAnim((prev) =>
        prev && prev.trickId === lastWon.id ? { ...prev, phase: "fly" } : prev,
      );
    }, 7000);
    return () => clearTimeout(t);
  }, [hand, lastWon]);

  // Point the trick cards at the winner's seat badge so they fly underneath it.
  useEffect(() => {
    if (!wonAnim || wonAnim.phase !== "fly" || !wonAnim.winnerSeat) {
      setWinnerTarget(null);
      return;
    }
    const el = seatBadgeRefs.current[wonAnim.winnerSeat];
    if (!el) {
      setWinnerTarget(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setWinnerTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [wonAnim]);

  // Keep the play overlay until the server records the card, then let the
  // trick slot take over (the card stays out of the hand via playedByMe).
  useEffect(() => {
    if (!inFlight || !playAnim) return;
    const recorded = plays.some(
      (pl) => pl.username === session?.username && pl.card === playAnim.card,
    );
    if (recorded) {
      setInFlight(false);
      setPlayAnim(null);
    }
  }, [plays, inFlight, playAnim, session?.username]);

  // If a play fails, let the card return to the hand.
  useEffect(() => {
    if (!error) return;
    setInFlight(false);
    setPlayAnim(null);
  }, [error]);

  const ruleset = useMemo(() => resolveRuleset(room?.ruleset), [room?.ruleset]);

  // Seats this human controls: one (four/solo) or a whole side (pairs).
  const mySeats: Seat[] = useMemo(
    () =>
      seats
        .filter(
          (s) => !s.is_spectator && s.seat && s.username === session?.username,
        )
        .map((s) => s.seat as Seat),
    [seats, session?.username],
  );
  const primarySeat: Seat | null =
    (session?.seat as Seat) || mySeats[0] || null;

  // Live turn state, computed before the loading guard so the alert hook can
  // run unconditionally. Only alerts seated, non-spectating players.
  const handOver = !!hand?.ended_at;
  const phase = contract ? "play" : "auction";
  const playerMap = hand ? players(hand) : null;
  const declarerSeat: Seat | null = contract
    ? ((contract.declarer_seat as Seat | undefined) ??
      (playerMap
        ? seatOfUsername(playerMap, contract.declarer_username)
        : null))
    : null;
  const bidTurn = ruleset && hand ? bidTurnSeat(bids, hand, ruleset) : null;
  const playTurn = playerMap
    ? playTurnSeat(tricks, plays, playerMap, declarerSeat)
    : null;
  const activeSeat = !handOver
    ? phase === "auction"
      ? bidTurn
      : playTurn
    : null;

  useTurnAlerts({
    activeSeat,
    phase,
    mySeats,
    handOver,
    isSpectator: !!session?.isSpectator,
  });

  // Close the pairs peek popover once it's no longer this side's bid turn.
  useEffect(() => {
    const mine = bidTurn && mySeats.includes(bidTurn as Seat);
    if (!(phase === "auction" && mySeats.length > 1 && mine))
      setPeekOther(false);
  }, [phase, mySeats, bidTurn]);

  // Non-blocking popover: dismiss on any tap outside the popover itself.
  useEffect(() => {
    if (!peekOther) return;
    const onDown = (e: PointerEvent) => {
      if (peekRef.current && !peekRef.current.contains(e.target as Node)) {
        if (!(e.target as Element | null)?.closest?.("[data-peek-trigger]"))
          setPeekOther(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [peekOther]);

  const trickCardSize = useTrickCardSize();

  const [tablet, setTablet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px) and (max-width: 1019px)");
    const update = () => setTablet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 640-1019: the felt is full-width (like mobile), floored at 20rem so it
  // clears the md trick cards. Size the trick cards to md there; elsewhere keep
  // the viewport-derived size, downgrading to sm only when the felt is short.
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableH, setTableH] = useState(0);
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setTableH(el.getBoundingClientRect().height),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const trickEff: TrickEff = tablet
    ? "md"
    : tableH && tableH < 288
      ? "sm"
      : trickCardSize;

  if (!session) return null;
  if (!hand || !ruleset) {
    return (
      <main className="grid min-h-dvh place-items-center text-cream-dim">
        Loading table…
      </main>
    );
  }

  const p = players(hand);
  const myUsername = session.username;

  const auction = auctionEntries(bids, hand);
  const trumpSuit =
    contract && contract.strain !== "NT" ? contract.strain : null;

  // Per-seat view for every seat this human controls.
  const mySeatData = mySeats.map((seat) => {
    const bidInfo = legalBidsForMe(bids, hand, ruleset, seat);
    const sorted =
      handSort === "suit"
        ? sortHand(hand.deal[seat] ?? [])
        : sortHandByRank(hand.deal[seat] ?? []);
    // Cards already played leave the fan (server keeps them in deal, so
    // derive played cards from the plays list instead).
    const played = new Set(
      plays.filter((pl) => pl.username === myUsername).map((pl) => pl.card),
    );
    return {
      seat,
      seatId: seats.find(
        (r) => r.username === myUsername && r.seat === seat && !r.is_spectator,
      )?.id,
      bidInfo,
      isBidTurn: bidInfo.myTurn && !handOver,
      isPlayTurn: !session.isSpectator && seat === playTurn && !handOver,
      legal: legalCardsForMe(hand, seat, myUsername, plays, tricks, ruleset),
      cards: sorted.filter((c) => !played.has(c)),
      hidden: playAnim && playAnim.seat === seat ? [playAnim.card] : [],
    };
  });
  const myBidTurn = mySeatData.some((d) => d.isBidTurn);
  const activeBidSeat = mySeatData.find((d) => d.isBidTurn) ?? null;
  // On lg+ the player's hands move to a side column next to the table; the
  // player's own seat anchors the first hand, the partner hand stacks below.
  const primaryData =
    mySeatData.find((d) => d.seat === primarySeat) ?? mySeatData[0];
  const partnerData =
    mySeats.length > 1 && primaryData
      ? (mySeatData.find((d) => d.seat !== primaryData.seat) ?? null)
      : null;

  // Pairs bidding on mobile: only the bidding hand stays grounded; the partner
  // hand is a popover peek so the bid panel keeps the vertical room.
  const auctionActive =
    phase === "auction" && myBidTurn && mySeats.length > 1 && !!partnerData;

  // The full bid panel sits in the felt center on sm+, but on phones it docks
  // in the footer (below the table) so it can't overlap the seat badges and
  // takes the space the hand would otherwise use. Rendered in both spots, one
  // hidden per breakpoint.
  const auctionPanel =
    myBidTurn && !handOver && activeBidSeat ? (
      <AuctionPanel
        entries={auction}
        legal={activeBidSeat.bidInfo}
        mySide={partnershipOf(activeBidSeat.seat)}
        myTurn
        disabled={pending}
        onCall={(call) => void bid(call, activeBidSeat.seatId)}
      />
    ) : null;

  const seatIdOf = (seat: Seat) =>
    mySeatData.find((d) => d.seat === seat)?.seatId;

  // Show the open trick, or the most recent won trick while it's being
  // collected (flip/fly under the winner) — the middle clears after 7s.
  const openTrick = currentTrick(tricks);
  const displayTrick =
    openTrick ??
    (wonAnim && wonAnim.phase !== "gone"
      ? (tricks.find((t) => t.id === wonAnim.trickId) ?? null)
      : null);
  const trickCards = displayTrick
    ? trickPlaysFor(displayTrick.id, plays).map((pl) => ({
        card: pl.card,
        seat: seatOfPlay(pl, p),
      }))
    : [];
  const winnerSeat = displayTrick?.winner_username
    ? ((displayTrick.winner_seat as Seat | undefined) ??
      seatOfUsername(p, displayTrick.winner_username))
    : null;
  const winnerToast =
    wonAnim &&
    wonAnim.phase !== "gone" &&
    !openTrick &&
    tricks.some((t) => t.id === wonAnim.trickId)
      ? wonAnim.winnerName
      : null;

  // Trick progress for both teams, shown in the header. The declared side
  // needs `level + 6` tricks to make the contract; the other side needs the
  // remaining tricks (plus one) to set it.
  const declarerSide = declarerSeat ? partnershipOf(declarerSeat) : null;

  let nsTricks = 0;
  let ewTricks = 0;
  for (const t of tricks) {
    if (!t.winner_username) continue;
    const ws =
      (t.winner_seat as Seat | undefined) ??
      seatOfUsername(p, t.winner_username);
    if (!ws) continue;
    if (partnershipOf(ws) === "NS") nsTricks++;
    else ewTricks++;
  }

  const tricksToMake = contract ? Number(contract.level) + 6 : null;
  const tricksToSet = contract ? 8 - Number(contract.level) : null;
  const nsNeeded = declarerSide === "NS" ? tricksToMake : tricksToSet;
  const ewNeeded = declarerSide === "EW" ? tricksToMake : tricksToSet;

  // Who won this hand: the declarer side if they made the contract, otherwise
  // the defending side. Downtown flips card ranking only, not the target.
  const resultWinnerSide =
    result && declarerSide
      ? result.result_delta >= 0
        ? declarerSide
        : opponentsOf(declarerSide)
      : null;
  const handWinnerNames: [string, string] | null = resultWinnerSide
    ? resultWinnerSide === "NS"
      ? [p.N, p.S]
      : [p.E, p.W]
    : null;

  // All four hands, for the win dialog's inspect view.
  const inspectHands = SEATS.map((seat) => ({
    seat,
    username: p[seat],
    cards: myCards(hand, seat),
  }));

  const dirs = SEATS.reduce(
    (acc, s) => {
      acc[s] = seatDir(s, primarySeat);
      return acc;
    },
    {} as Record<Seat, TableDir>,
  );

  function handleCardClick(card: Card, seat: Seat) {
    if (playAnim) return;
    if (staged && staged.card === card && staged.seat === seat) {
      setStaged(null);
      return;
    }
    setStaged({ card, seat });
  }

  // One seat's labeled hand + fan. Used by both the mobile footer and the lg+
  // side column, so the pair hands render in exactly one place.
  const renderHand = (d: (typeof mySeatData)[number]) => {
    const active = phase === "auction" ? d.isBidTurn : d.isPlayTurn;
    return (
      <div key={d.seat} className="flex flex-col items-center">
        {mySeats.length > 1 && (
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-[0.25em] text-cream-dim/70 uppercase">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full font-display text-xs font-bold ${
                active ? "bg-lime/15 text-lime" : "bg-ink/60 text-cream-dim"
              }`}
            >
              {d.seat}
            </span>
            {active ? (phase === "auction" ? "to bid" : "to play") : "waiting"}
          </p>
        )}
        <Hand
          cards={d.cards}
          playable={phase === "play" && active ? d.legal : []}
          trumpSuit={trumpSuit}
          staged={staged?.seat === d.seat ? staged.card : null}
          hiddenCards={d.hidden}
          onPlay={
            phase === "play" && active
              ? (c) => handleCardClick(c, d.seat)
              : !active
                ? () => {}
                : undefined
          }
          onPlayConfirm={
            phase === "play" && active
              ? (c, from) => launchPlay(c, d.seat, from)
              : undefined
          }
        />
      </div>
    );
  };

  // Sort row + confirm row + the player's hand(s). Rendered in the footer on
  // phones and in the side column on lg+; the confirm row's height is reserved
  // during play so staging a card never shifts the layout (which would make the
  // play-animation target stale). The mobile footer swaps in the active bidding
  // hand (with a peek toggle) so the bid panel has room in pairs mode.
  const buildHandsStack = ({
    primary = primaryData,
    showPartner = true,
  }: {
    primary?: (typeof mySeatData)[number] | null;
    showPartner?: boolean;
  } = {}) => (
    <div className="flex flex-col items-center gap-3">
      <div className="mb-1 flex items-center justify-center gap-1">
        <span className="mr-1 text-[10px] tracking-[0.25em] text-cream-dim/60 uppercase">
          Sort
        </span>
        <button
          type="button"
          onClick={() => setHandSort("suit")}
          className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
            handSort === "suit"
              ? "bg-lime/15 text-lime"
              : "text-cream-dim hover:text-cream"
          }`}
        >
          Suit
        </button>
        <button
          type="button"
          onClick={() => setHandSort("rank")}
          className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
            handSort === "rank"
              ? "bg-lime/15 text-lime"
              : "text-cream-dim hover:text-cream"
          }`}
        >
          Rank
        </button>
        {phase === "play" && trumpSuit && (
          <span className="ml-2 text-[10px] tracking-[0.2em] text-lime/70 uppercase">
            Trump {trumpSuit}
          </span>
        )}
      </div>
      {phase === "play" && (
        <div className="flex h-11 items-center justify-center gap-2">
          {staged && (
            <>
              <span className="text-sm text-cream">Play {staged.card}?</span>
              <Button onClick={confirmPlay} disabled={!!playAnim}>
                Play
              </Button>
              <Button variant="ghost" onClick={() => setStaged(null)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
      {primary && renderHand(primary)}
      {mySeats.length > 1 &&
        showPartner &&
        partnerData &&
        renderHand(partnerData)}
    </div>
  );
  const handsStack = buildHandsStack();

  function finishPlay(card: Card, seatId?: string) {
    setStaged(null);
    setInFlight(true);
    void play(card, seatId);
  }

  // The hands render twice — side column on lg+, footer on phones — so the
  // plain querySelector can grab the display:none copy (rect reads as 0,0).
  const visibleEl = (sel: string) =>
    [...document.querySelectorAll<HTMLElement>(sel)].find(
      (el) => el.offsetParent !== null,
    ) ?? null;

  function launchPlay(card: Card, seat: Seat, from?: { x: number; y: number }) {
    if (playAnim) return;
    const toEl = visibleEl(`[data-trick-slot="${seat}"]`);
    const to = toEl?.getBoundingClientRect();
    const origin =
      from ??
      (() => {
        const r = visibleEl(
          `[data-hand-card="${card}"]`,
        )?.getBoundingClientRect();
        return r ? { x: r.left, y: r.top } : null;
      })();
    if (origin && to) {
      setPlayAnim({
        card,
        seat,
        from: origin,
        to: { x: to.left, y: to.top },
      });
      setStaged(null);
    } else {
      finishPlay(card, seatIdOf(seat));
    }
  }

  function confirmPlay() {
    if (!staged) return;
    launchPlay(staged.card, staged.seat);
  }

  function handleSpectate() {
    void claim(null).catch((err) =>
      useGameStore
        .getState()
        .setError(err instanceof Error ? err.message : "Failed to spectate"),
    );
  }

  function handleLeave() {
    void leave()
      .then(() => router.replace("/"))
      .catch((err) =>
        useGameStore
          .getState()
          .setError(err instanceof Error ? err.message : "Failed to leave"),
      );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="relative flex items-center justify-between gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="text-sm text-cream-dim">
          <span className="mr-2 rounded-lg bg-cream/5 px-2 py-1 font-mono tracking-widest">
            {params.code}
          </span>
          <span className="hidden sm:inline">· {ruleset.name}</span>
        </div>
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="pointer-events-auto">
            <Scoreboard
              contract={contractShorthand(contract)}
              vulnerability={"none"}
              nsTricks={nsTricks}
              ewTricks={ewTricks}
              nsNeeded={nsNeeded}
              ewNeeded={ewNeeded}
              onContractClick={() => setShowAuction(true)}
            />
          </div>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setMenuOpen((o) => !o)}
            className="px-3 sm:px-4"
            aria-label="Options"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Options</span>
          </Button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute top-full right-0 z-40 mt-2 flex w-44 flex-col gap-1 rounded-2xl border border-cream/10 bg-felt-deep/95 p-2 backdrop-blur">
                <button
                  type="button"
                  disabled={handOver || pending}
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmConcede(true);
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-cream/5 disabled:opacity-40"
                >
                  Concede
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowOnboarding(true);
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm text-cream transition-colors hover:bg-cream/5"
                >
                  How to play
                </button>
                {room?.mode === "four" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setKickOpen(true);
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-cream transition-colors hover:bg-cream/5"
                  >
                    Kick player
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
        <div
          ref={tableRef}
          className="[container-type:size] relative flex min-h-0 w-full flex-1 items-center justify-center px-3 py-3 sm:px-4 sm:py-4"
        >
          <div
            data-play-drop
            className={`felt relative aspect-square rounded-4xl ${
              phase === "auction"
                ? auctionPanel
                  ? "h-full w-full"
                  : "max-h-full w-full"
                : "max-h-full w-full sm:min-h-[21rem]"
            } min-[1020px]:h-auto min-[1020px]:w-[min(100cqw,100cqh)]`}
          >
            {SEATS.map((seat) => {
              const rec = seatAt(seats, seat);
              return (
                <div
                  key={seat}
                  ref={(el) => {
                    seatBadgeRefs.current[seat] = el;
                  }}
                  data-seat-badge={seat}
                  className={`absolute z-20 ${badgeClass(dirs[seat])}`}
                >
                  <SeatBadge
                    seat={seat}
                    username={rec?.username ?? p[seat] ?? null}
                    active={activeSeat === seat}
                    winner={winnerSeat === seat}
                    isMe={mySeats.includes(seat)}
                  />
                </div>
              );
            })}

            {/* The bid panel sits centered in the felt (between the badge strips). One
              overlay across breakpoints so the panel is a single component
              instance — staging state stays in sync while resizing. */}
            {phase === "auction" && auctionPanel && (
              <div className="absolute inset-0 z-10 flex items-center justify-center px-3 py-14">
                {auctionPanel}
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "auction" ? (
                auctionPanel ? null : (
                  <div className="w-full max-w-md rounded-2xl border border-cream/10 bg-felt-deep/70 p-5 text-center backdrop-blur">
                    <div className="flex min-h-8 flex-wrap items-center justify-center gap-1.5">
                      <AuctionChips entries={auction} />
                    </div>
                    <p className="mt-3 font-display text-lg text-cream">
                      {handOver
                        ? "Auction over"
                        : `Waiting on ${p[bidTurn ?? "N"]}`}
                    </p>
                    <p className="mt-1 text-xs tracking-[0.3em] text-cream-dim/60 uppercase">
                      auction
                    </p>
                  </div>
                )
              ) : (
                <TrickArea
                  cards={trickCards}
                  winner={winnerSeat}
                  positions={dirs}
                  size={trickEff}
                  trumpSuit={trumpSuit}
                  collecting={
                    !!(wonAnim && wonAnim.phase === "collect" && !openTrick)
                  }
                  won={!!(wonAnim && wonAnim.phase === "fly" && !openTrick)}
                  winnerTarget={winnerTarget}
                  onCollected={() =>
                    setWonAnim((prev) =>
                      prev && prev.phase === "fly"
                        ? { ...prev, phase: "gone" }
                        : prev,
                    )
                  }
                  toast={
                    winnerToast ? (
                      <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-full bg-lime px-5 py-2 font-semibold whitespace-nowrap text-ink shadow-[0_0_30px_-6px_rgb(186_255_61/60%)]"
                      >
                        {winnerToast} wins the trick
                      </motion.div>
                    ) : null
                  }
                />
              )}
            </div>
          </div>
        </div>

        {!session.isSpectator && (
          <aside className="hidden min-h-0 w-full shrink-0 overflow-y-auto p-3 lg:flex lg:w-[36rem] xl:w-[40rem] 2xl:w-[44rem]">
            <div className="m-auto flex w-full flex-col items-center gap-3 rounded-2xl border border-cream/10 bg-felt-deep/70 px-3 pt-4 pb-20 backdrop-blur">
              {error && (
                <p className="mb-2 text-center text-sm text-danger">{error}</p>
              )}
              {!handOver && handsStack}
            </div>
          </aside>
        )}
      </div>

      <footer
        className={`px-3 pt-2 pb-3 sm:px-4 sm:pb-4 ${
          session.isSpectator ? "" : "lg:hidden"
        }`}
      >
        {error && (
          <p className="mb-2 text-center text-sm text-danger">{error}</p>
        )}

        {session.isSpectator ? (
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => setSpectatorVisible((v) => !v)}
            >
              {spectatorVisible ? "Hide all hands" : "Reveal all hands"}
            </Button>
            <Button variant="ghost" onClick={() => setShowReplay(true)}>
              Replay game
            </Button>
            {spectatorVisible && (
              <div className="grid w-full max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
                {SEATS.map((seat) => (
                  <div key={seat} className="rounded-xl bg-cream/5 p-2">
                    <p className="mb-1 text-center text-xs text-cream-dim">
                      {seat} · {p[seat]}
                    </p>
                    <div className="flex flex-wrap justify-center gap-1">
                      {myCards(hand, seat).map((card) => (
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
            )}
          </div>
        ) : !handOver ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
            {auctionActive && (
              <div className="relative">
                <button
                  type="button"
                  data-peek-trigger
                  onClick={() => setPeekOther((v) => !v)}
                  aria-haspopup="dialog"
                  aria-expanded={peekOther}
                  className="rounded-full border border-cream/10 bg-felt-deep/70 px-3 py-1 text-xs text-cream-dim transition-colors hover:text-cream"
                >
                  Peek at other hand
                </button>
                <AnimatePresence>
                  {peekOther && (
                    <div
                      ref={peekRef}
                      className="absolute bottom-full left-1/2 z-[70] mb-3 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="relative w-full rounded-2xl border border-lime/30 bg-ink/95 p-2 shadow-xl"
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] tracking-[0.25em] text-lime/70 uppercase">
                            Peek at other hand
                          </span>
                          <button
                            type="button"
                            onClick={() => setPeekOther(false)}
                            aria-label="Close peek"
                            className="px-1 text-sm text-cream-dim hover:text-cream"
                          >
                            ×
                          </button>
                        </div>
                        <div className="pointer-events-none absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border-r border-b border-lime/30 bg-ink/95" />
                        <div className="flex flex-wrap justify-center gap-1 pt-1 pb-1">
                          {partnerData!.cards.map((card) => (
                            <PlayingCard
                              key={card}
                              card={card}
                              size="sm"
                              playable={false}
                            />
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {buildHandsStack({
              primary: auctionActive
                ? (activeBidSeat ?? primaryData)
                : primaryData,
              showPartner: !auctionActive,
            })}
          </div>
        ) : null}
      </footer>

      {playAnim && (
        <motion.div
          className="pointer-events-none fixed z-[80]"
          initial={{ left: playAnim.from.x, top: playAnim.from.y }}
          animate={{
            left: playAnim.to.x,
            top: playAnim.to.y,
            scale: [0.7, 1.14, 1],
            rotate: [0, 6, 0],
          }}
          transition={{ duration: 0.4, ease: "easeInOut", times: [0, 0.65, 1] }}
          onAnimationComplete={() => {
            if (!inFlight) finishPlay(playAnim.card, seatIdOf(playAnim.seat));
          }}
        >
          <PlayingCard card={playAnim.card} size={trickEff} />
        </motion.div>
      )}

      {showAuction && (
        <AuctionHistoryModal
          entries={auction}
          onClose={() => setShowAuction(false)}
        />
      )}

      <ReplayView
        open={showReplay}
        onClose={() => setShowReplay(false)}
        roomId={session.roomId}
      />

      {kickOpen && room?.mode === "four" && (
        <KickDialog onClose={() => setKickOpen(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal
          onDone={() => {
            markOnboardingSeen();
            setShowOnboarding(false);
          }}
        />
      )}

      {confirmConcede && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmConcede(false)}
        >
          <div
            className="felt w-full max-w-sm rounded-3xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl font-bold text-cream">
              Concede this game?
            </h3>
            <p className="mt-2 text-sm text-cream-dim">
              This ends the game and awards the win to the opposing side. You
              can&apos;t undo this.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  setConfirmConcede(false);
                  void concede("concede");
                }}
              >
                Concede
              </Button>
              <Button variant="ghost" onClick={() => setConfirmConcede(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {handOver && (
        <HandOverOverlay
          result={result}
          ddResult={hand.dd_result}
          contractShorthand={contractShorthand(contract)}
          nsTricks={nsTricks}
          ewTricks={ewTricks}
          hands={inspectHands}
          winnerSide={hand.winner_side || null}
          winnerNames={
            hand.winner_side === "NS"
              ? [p.N, p.S]
              : hand.winner_side === "EW"
                ? [p.E, p.W]
                : null
          }
          handWinnerNames={handWinnerNames}
          endReason={hand.end_reason || null}
          mode={room?.mode ?? "four"}
          isNorth={mySeats.includes("N")}
          isSeated={!session.isSpectator}
          allReady={allFourReady(seats)}
          myReady={!!seats.find((s) => s.id === session.seatId)?.ready}
          onReady={(v) => void ready(v)}
          onNext={() => void startNewGame()}
          onSpectate={handleSpectate}
          onLeave={handleLeave}
          onReplay={() => setShowReplay(true)}
        />
      )}
    </main>
  );
}

function AuctionHistoryModal({
  entries,
  onClose,
}: {
  entries: { call: string; username: string; side: "NS" | "EW" }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="felt w-full max-w-sm rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl font-bold text-cream">Auction</h3>
        <ul className="mt-4 flex flex-col gap-1.5">
          {entries.length === 0 && (
            <li className="text-sm text-cream-dim">No bids yet.</li>
          )}
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-cream">{e.username}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-base font-semibold ${
                  e.call === "P"
                    ? "bg-cream/5 text-cream-dim"
                    : e.call === "X" || e.call === "XX"
                      ? "bg-danger/15 text-danger"
                      : "bg-lime/15 text-lime"
                }`}
              >
                {formatCall(e.call)}
              </span>
            </li>
          ))}
        </ul>
        <Button className="mt-5 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function HandOverOverlay({
  result,
  ddResult,
  contractShorthand,
  nsTricks,
  ewTricks,
  hands,
  winnerSide,
  winnerNames,
  handWinnerNames,
  endReason,
  mode,
  isNorth,
  isSeated,
  allReady,
  myReady,
  onReady,
  onNext,
  onSpectate,
  onLeave,
  onReplay,
}: {
  result: HandResultRecord | null;
  /** Double-dummy solve for the just-finished hand, if one completed. */
  ddResult: DdResult | null;
  contractShorthand: string;
  /** Tricks won by each partnership in the just-finished hand. */
  nsTricks: number;
  ewTricks: number;
  /** All four hands, shown in the inspect view. */
  hands: { seat: Seat; username: string; cards: Card[] }[];
  winnerSide: string | null;
  /** Players on the winning side (game over), used for the celebratory heading. */
  winnerNames: [string, string] | null;
  /** Players on the side that won the just-finished hand. */
  handWinnerNames: [string, string] | null;
  endReason: string | null;
  mode: RoomMode;
  isNorth: boolean;
  isSeated: boolean;
  allReady: boolean;
  myReady: boolean;
  onReady: (ready: boolean) => void;
  onNext: () => void;
  onSpectate: () => void;
  onLeave: () => void;
  onReplay: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState(false);

  async function act(fn: () => Promise<void> | void) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="felt w-full max-w-sm rounded-3xl p-6 text-center">
        {inspect ? (
          <>
            <p className="text-xs tracking-[0.3em] text-lime/70 uppercase">
              All hands
            </p>
            <div className="mt-4 grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto">
              {hands.map((h) => (
                <div key={h.seat} className="rounded-xl bg-cream/5 p-2">
                  <p className="mb-1 text-center text-xs text-cream-dim">
                    {h.seat} · {h.username}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {h.cards.map((card) => (
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
            <Button
              className="mt-4 w-full"
              variant="ghost"
              onClick={() => setInspect(false)}
            >
              Back
            </Button>
          </>
        ) : (
          <>
            {endReason === "conceded" || endReason === "left" ? (
              <>
                <p className="text-xs tracking-[0.3em] text-lime/70 uppercase">
                  Game over
                </p>
                <h2 className="mt-2 font-display text-4xl font-black text-cream">
                  {winnerNames?.filter(Boolean).join(" & ") ||
                    `${winnerSide} win`}
                </h2>
                <p className="mt-1 text-sm text-cream-dim">
                  {winnerSide} win
                  {endReason === "conceded"
                    ? " · by concession"
                    : endReason === "left"
                      ? " · opponent left"
                      : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs tracking-[0.3em] text-lime/70 uppercase">
                  Hand over
                </p>
                <h2 className="mt-2 font-display text-3xl font-black text-cream">
                  {result
                    ? `${contractShorthand} ${result.result_delta >= 0 ? "+" : ""}${result.result_delta}`
                    : "Passed out"}
                </h2>
                {handWinnerNames?.some(Boolean) && (
                  <p className="mt-2 font-display text-xl font-bold text-lime">
                    {handWinnerNames.filter(Boolean).join(" & ")} win
                  </p>
                )}
                <div className="mt-4 flex justify-center gap-6 text-sm">
                  <span className="text-cream-dim">
                    NS{" "}
                    <span className="font-display text-lg text-cream">
                      {nsTricks}
                    </span>{" "}
                    <span className="text-xs">tricks</span>
                  </span>
                  <span className="text-cream-dim">
                    EW{" "}
                    <span className="font-display text-lg text-cream">
                      {ewTricks}
                    </span>{" "}
                    <span className="text-xs">tricks</span>
                  </span>
                </div>
                {ddResult && result && (
                  <DdVerdictLine
                    maxTricks={ddResult.maxTricks}
                    tricksMade={result.tricks_made}
                    tricksRequired={result.tricks_required}
                  />
                )}
              </>
            )}

            {isSeated &&
              endReason === "completed" &&
              (mode === "four" ? (
                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    variant={myReady ? "primary" : "ghost"}
                    onClick={() => onReady(!myReady)}
                  >
                    {myReady ? "Ready ✓" : "Ready for next"}
                  </Button>
                  {isNorth && (
                    <Button disabled={!allReady} onClick={onNext}>
                      {allReady ? "Deal next hand" : "Waiting for players"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <Button onClick={onNext}>Deal next hand</Button>
                </div>
              ))}

            <div className="mt-4 flex justify-center gap-2">
              {isSeated && !winnerSide && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act(onSpectate)}
                >
                  Spectate
                </Button>
              )}
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void act(onLeave)}
              >
                Leave room
              </Button>
            </div>

            <Button className="mt-2 w-full" variant="ghost" onClick={onReplay}>
              Replay game
            </Button>

            <Button
              className="mt-2 w-full"
              variant="ghost"
              onClick={() => setInspect(true)}
            >
              Inspect hands
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** "Upset!" when the result contradicts double-dummy; otherwise a muted
    double-dummy readout. */
function DdVerdictLine({
  maxTricks,
  tricksMade,
  tricksRequired,
}: {
  maxTricks: number;
  tricksMade: number;
  tricksRequired: number;
}) {
  const outcome = ddOutcome({ maxTricks }, tricksMade, tricksRequired);
  if (!outcome) return null;
  return (
    <p
      className={`mt-3 text-xs tracking-[0.25em] uppercase ${
        outcome.upset ? "font-bold text-danger" : "text-cream-dim/70"
      }`}
      title="Double-dummy result: computed with all four hands visible, assuming perfect play on both sides. It is the maximum tricks the declaring side can take on the contract strain, regardless of how the hand was actually played."
    >
      {outcome.upset ? "Upset! " : ""}
      Double-dummy: {maxTricks} tricks
    </p>
  );
}

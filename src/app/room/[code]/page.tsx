"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

import { SeatBadge } from "@/components/SeatBadge";
import { KickPanel } from "@/components/KickPanel";
import { Button } from "@/components/ui/Button";
import type { Seat } from "@/lib/game/types";
import { pb } from "@/lib/pb";
import { listPresets } from "@/lib/rulesets";
import type { Room, RoomSeat } from "@/lib/types";
import { useRoomStore } from "@/store/room-store";
import { useSessionStore } from "@/store/session-store";
import {
  allFourReady,
  seatAt,
  seatedPlayers,
  spectators,
} from "@/store/selectors";

import { useRoomSync } from "@/hooks/useRoomSync";

const SEATS: Seat[] = ["N", "E", "S", "W"];
const POS: Record<Seat, string> = {
  N: "left-1/2 top-4 -translate-x-1/2",
  E: "right-4 top-1/2 -translate-y-1/2",
  S: "left-1/2 bottom-4 -translate-x-1/2",
  W: "left-4 top-1/2 -translate-y-1/2",
};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();

  const session = useSessionStore((s) => s.session);
  const init = useSessionStore((s) => s.init);
  const join = useSessionStore((s) => s.join);
  const room = useRoomStore((s) => s.room);
  const seats = useRoomStore((s) => s.seats);
  const error = useRoomStore((s) => s.error);
  const claim = useRoomStore((s) => s.claim);
  const leave = useRoomStore((s) => s.leave);
  const ready = useRoomStore((s) => s.ready);
  const addBot = useRoomStore((s) => s.addBot);
  const kickBot = useRoomStore((s) => s.kickBot);
  const changeRuleset = useRoomStore((s) => s.changeRuleset);
  const changePrivacy = useRoomStore((s) => s.changePrivacy);
  const start = useRoomStore((s) => s.start);

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [joinPw, setJoinPw] = useState("");
  const [privacyPw, setPrivacyPw] = useState("");
  const [showPrivacyPw, setShowPrivacyPw] = useState(false);

  useRoomSync(session);

  // No session yet: pre-fill the lobby by fetching the room + seats by code.
  useEffect(() => {
    if (session || !code) return;
    let disposed = false;
    (async () => {
      try {
        const room = await pb
          .collection("rooms")
          .getFirstListItem<Room>(pb.filter("code = {:code}", { code }));
        if (disposed) return;
        useRoomStore.getState().setRoom(room);
        const roomSeats = await pb
          .collection("room_seats")
          .getFullList<RoomSeat>({
            filter: pb.filter("room_id = {:roomId}", { roomId: room.id }),
            sort: "joined_at",
          });
        if (!disposed) useRoomStore.getState().setSeats(roomSeats);
      } catch {
        if (!disposed) useRoomStore.getState().setRoom(null);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [session, code]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session && room?.status === "active") {
      router.replace(`/game/${session.code}`);
    }
  }, [session, room?.status, router]);

  const myRecord = session
    ? (seats.find((s) => s.id === session.seatId) ?? null)
    : null;
  const isSeated = !!myRecord && !myRecord.is_spectator;
  const seated = seatedPlayers(seats);
  const readyCount = seated.filter((s) => s.ready).length;
  const fourReady = allFourReady(seats);
  const isNorth = session?.seat === "N";
  const presets = listPresets();
  const currentPreset = room?.ruleset
    ? ((room.ruleset as { id?: string }).id ?? null)
    : null;

  async function joinRoom(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await join(code, name.trim(), joinPw.trim() || undefined);
    } catch (err) {
      useRoomStore
        .getState()
        .setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      useRoomStore
        .getState()
        .setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-4 py-8">
      <header className="flex w-full max-w-3xl items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.4em] text-lime/70 uppercase">
            Table
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-4xl font-black tracking-widest text-cream">
              {code}
            </h1>
            {room?.privacy === "private" && (
              <span className="rounded-full border border-lime/40 bg-lime/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-lime uppercase">
                🔒 Private
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
          }}
        >
          Copy code
        </Button>
      </header>

      <div className="felt relative aspect-square w-full max-w-lg rounded-[2rem]">
        {SEATS.map((seat) => {
          const rec = seatAt(seats, seat);
          const leaderBotControls = room?.mode === "four" && isNorth;
          return (
            <div key={seat} className={`absolute ${POS[seat]}`}>
              <div className="flex flex-col items-center gap-1">
                {rec ? (
                  <SeatBadge
                    seat={seat}
                    username={rec.username}
                    isMe={session ? rec.id === session.seatId : false}
                    ready={rec.ready}
                  />
                ) : session && room?.mode !== "pairs" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => claim(seat))}
                    className="flex items-center gap-2 rounded-full border border-dashed border-cream/25 px-3 py-1.5 text-sm text-cream-dim transition-colors hover:border-lime/60 hover:text-lime disabled:opacity-40"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink/60 font-display text-sm font-bold">
                      {seat}
                    </span>
                    Sit here
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-dashed border-cream/20 px-3 py-1.5 text-sm text-cream-dim/60">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink/60 font-display text-sm font-bold">
                      {seat}
                    </span>
                    Open
                  </div>
                )}
                {leaderBotControls && rec?.is_bot && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => kickBot(rec.username))}
                    className="rounded-full border border-danger/30 bg-ink/60 px-2 py-0.5 text-xs text-danger transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
                  >
                    Kick bot
                  </button>
                )}
                {leaderBotControls && !rec && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => addBot(seat))}
                    className="rounded-full border border-dashed border-lime/40 bg-ink/60 px-2 py-0.5 text-xs text-lime transition-colors hover:border-lime hover:text-lime disabled:opacity-40"
                  >
                    Add bot
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
          <span className="font-display text-2xl font-bold text-cream">
            {seatedPlayers(seats).length}/4
          </span>
          <span className="max-w-40 text-xs text-cream-dim">
            {room?.status === "waiting"
              ? "Waiting for players"
              : "Game in progress"}
          </span>
        </div>
      </div>

      <section className="flex w-full max-w-lg flex-col gap-4">
        {error && <p className="text-sm text-danger">{error}</p>}

        {!session ? (
          <>
            <div className="rounded-2xl border border-cream/10 bg-felt-deep/70 px-4 py-3 text-center backdrop-blur">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/70 uppercase">
                Join table
              </p>
              <p className="mt-0.5 text-sm text-cream">
                Pick a name to join {code}
              </p>
            </div>

            <form
              className="felt flex flex-col gap-3 rounded-2xl p-4"
              onSubmit={joinRoom}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-cream-dim">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. North Star"
                  maxLength={40}
                  autoFocus
                  className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
                />
              </label>
              {room?.privacy === "private" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-cream-dim">Password</span>
                  <input
                    type="password"
                    value={joinPw}
                    onChange={(e) => setJoinPw(e.target.value)}
                    placeholder="Room password"
                    maxLength={64}
                    className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
                  />
                </label>
              )}
              <Button type="submit" disabled={busy || !name.trim()}>
                Join table
              </Button>
            </form>

            {spectators(seats).length > 0 && (
              <p className="text-center text-xs text-cream-dim">
                <span className="tracking-[0.2em] uppercase">Spectating: </span>
                {spectators(seats)
                  .map((s) => s.username)
                  .join(", ")}
              </p>
            )}
          </>
        ) : (
          <>
            {/* Table status */}
            <div className="flex items-center justify-between rounded-2xl border border-cream/10 bg-felt-deep/70 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/70 uppercase">
                  Table status
                </p>
                <p className="mt-0.5 text-sm text-cream">
                  {room?.status === "waiting"
                    ? "Waiting for players"
                    : "Game in progress"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-black text-cream">
                  {seated.length}
                  <span className="text-cream-dim">/4</span>
                </p>
                <p className="text-xs text-cream-dim">{readyCount} ready</p>
              </div>
            </div>

            {/* Primary action */}
            {room?.status === "waiting" &&
              (room?.mode === "pairs" ? (
                isSeated ? (
                  <div className="rounded-2xl border border-cream/10 bg-felt-deep/70 px-4 py-3 text-center backdrop-blur">
                    <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/70 uppercase">
                      Waiting for opponent
                    </p>
                    <p className="mt-0.5 text-sm text-cream">
                      Share code {code} — they take the opposite side.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-cream/15 px-4 py-3 text-center text-sm text-cream-dim">
                    This is a 2-player table. Joining takes the free side.
                  </p>
                )
              ) : isSeated ? (
                <div className="flex flex-col gap-2">
                  <Button
                    variant={myRecord?.ready ? "ghost" : "primary"}
                    className="w-full text-base"
                    disabled={busy}
                    onClick={() => void run(() => ready(!myRecord?.ready))}
                  >
                    {myRecord?.ready ? "Ready ✓" : "Ready up"}
                  </Button>
                  {isNorth && myRecord?.ready && (
                    <Button
                      className="w-full text-base"
                      disabled={!fourReady || busy}
                      onClick={() => void run(() => start())}
                    >
                      {fourReady
                        ? "Start game"
                        : `Waiting for all ready (${readyCount}/4)`}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-cream/15 px-4 py-3 text-center text-sm text-cream-dim">
                  Tap an empty seat above to join the table.
                </p>
              ))}

            {/* Secondary actions */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isSeated &&
                room?.mode === "four" &&
                room?.status === "waiting" && (
                  <label className="flex items-center gap-2 text-sm text-cream-dim">
                    <span>Ruleset</span>
                    <select
                      value={currentPreset ?? presets[0]?.id}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() => changeRuleset(e.target.value))
                      }
                      className="min-h-11 rounded-xl border border-cream/15 bg-ink/60 px-3 text-cream focus:border-lime/60 focus:outline-none disabled:opacity-40"
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {isSeated &&
                room?.mode === "four" &&
                room?.status === "waiting" && (
                  <label className="flex items-center gap-2 text-sm text-cream-dim">
                    <span>Privacy</span>
                    <select
                      value={room?.privacy ?? "public"}
                      disabled={busy}
                      onChange={(e) => {
                        const value = e.target.value as "public" | "private";
                        if (value === "public") {
                          setShowPrivacyPw(false);
                          void run(() => changePrivacy("public"));
                        } else {
                          setShowPrivacyPw(true);
                        }
                      }}
                      className="min-h-11 rounded-xl border border-cream/15 bg-ink/60 px-3 text-cream focus:border-lime/60 focus:outline-none disabled:opacity-40"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                )}
              {isSeated &&
                room?.mode === "four" &&
                room?.status === "waiting" &&
                showPrivacyPw && (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={privacyPw}
                      onChange={(e) => setPrivacyPw(e.target.value)}
                      placeholder="New password"
                      maxLength={64}
                      className="min-h-11 w-40 rounded-xl border border-cream/15 bg-ink/60 px-3 text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
                    />
                    <Button
                      variant="ghost"
                      className="px-3"
                      disabled={busy || privacyPw.trim().length < 4}
                      onClick={() =>
                        void run(async () => {
                          await changePrivacy("private", privacyPw.trim());
                          setPrivacyPw("");
                          setShowPrivacyPw(false);
                        })
                      }
                    >
                      Set password
                    </Button>
                  </div>
                )}
              {isSeated && room?.mode === "four" && <KickPanel />}
              {isSeated && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(() => claim(null))}
                >
                  Spectate
                </Button>
              )}
            </div>

            {/* Danger zone */}
            <div className="border-t border-cream/10 pt-4">
              <Button
                variant="danger"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await leave();
                    router.replace("/");
                  })
                }
              >
                Leave room
              </Button>
            </div>

            {spectators(seats).length > 0 && (
              <p className="text-center text-xs text-cream-dim">
                <span className="tracking-[0.2em] uppercase">Spectating: </span>
                {spectators(seats)
                  .map((s) => s.username)
                  .join(", ")}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

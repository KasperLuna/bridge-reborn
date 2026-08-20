"use client";

import { useEffect, useMemo, useState } from "react";

import { kickThreshold } from "@/lib/kick";
import { useRoomStore } from "@/store/room-store";
import { useSessionStore } from "@/store/session-store";

import { Button } from "./ui/Button";

/** Modal body for vote kick. Used standalone (game menu) or via KickPanel. */
export function KickDialog({ onClose }: { onClose: () => void }) {
  const room = useRoomStore((s) => s.room);
  const seats = useRoomStore((s) => s.seats);
  const kickVotes = useRoomStore((s) => s.kickVotes);
  const startKick = useRoomStore((s) => s.startKick);
  const castKickVote = useRoomStore((s) => s.castKickVote);
  const kickBot = useRoomStore((s) => s.kickBot);
  const session = useSessionStore((s) => s.session);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const seatedHumans = useMemo(
    () => seats.filter((s) => !s.is_spectator && s.seat && !s.is_bot),
    [seats],
  );

  const bots = useMemo(
    () => seats.filter((s) => !s.is_spectator && s.seat && s.is_bot),
    [seats],
  );

  // Bot management lives in the dialog only mid-game; the lobby uses buttons
  // under the seats instead.
  const showBots =
    room?.mode === "four" &&
    session?.seat === "N" &&
    room.status !== "waiting";

  const openVote = useMemo(
    () => kickVotes.find((v) => v.status === "open") ?? null,
    [kickVotes],
  );

  const currentVote = useMemo(
    () =>
      kickVotes.find((v) => v.status === "open") ?? kickVotes.at(-1) ?? null,
    [kickVotes],
  );

  // Target can't vote, so the bar is majority of the other seated humans.
  const threshold = kickThreshold(Math.max(0, seatedHumans.length - 1));

  const myUsername = session?.username ?? null;
  const alreadyVoted =
    !!myUsername && !!openVote
      ? openVote.votes_yes.includes(myUsername) ||
        (openVote.votes_no ?? []).includes(myUsername)
      : false;
  const canVote =
    !!myUsername &&
    !!openVote &&
    !!seatedHumans.some((s) => s.username === myUsername) &&
    myUsername !== openVote.target_username &&
    !alreadyVoted;

  const remainingMs = openVote
    ? Math.max(0, Date.parse(openVote.expires_at) - now)
    : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="felt w-full max-w-sm rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl font-bold text-cream">
          Vote to kick
        </h3>

        {openVote ? (
          <>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <p className="flex items-center justify-between text-cream">
                <span className="text-cream-dim">Target</span>
                <span className="font-semibold">
                  {openVote.target_username}
                </span>
              </p>
              <p className="flex items-center justify-between text-cream">
                <span className="text-cream-dim">Votes</span>
                <span className="font-semibold text-lime">
                  {openVote.votes_yes.length}
                  <span className="text-cream-dim"> / {threshold}</span>
                </span>
              </p>
              <p className="flex items-center justify-between text-cream">
                <span className="text-cream-dim">Time left</span>
                <span className="font-mono">{countdown}</span>
              </p>
            </div>

            {alreadyVoted ? (
              <p className="mt-4 rounded-xl bg-cream/5 p-3 text-center text-sm text-cream-dim">
                Voted
              </p>
            ) : canVote ? (
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  onClick={() => {
                    void castKickVote(openVote.id, true);
                    onClose();
                  }}
                >
                  Yes, kick
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void castKickVote(openVote.id, false);
                    onClose();
                  }}
                >
                  No, keep
                </Button>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-cream/5 p-3 text-center text-sm text-cream-dim">
                {myUsername === openVote.target_username
                  ? "You are the target of this vote."
                  : "Spectators cannot vote."}
              </p>
            )}
          </>
        ) : (
          <>
            {currentVote?.status === "passed" && (
              <div className="mt-4 rounded-xl bg-cream/5 p-3 text-center text-sm text-cream">
                {currentVote.target_username} was kicked out.
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {seatedHumans
                .filter((s) => s.username !== myUsername)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-cream/5 p-3"
                  >
                    <span className="text-sm text-cream">{s.username}</span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void startKick(s.username);
                        onClose();
                      }}
                    >
                      Kick
                    </Button>
                  </div>
                ))}
            </div>
          </>
        )}

        {showBots && (
          <>
            <div className="mt-4 border-t border-cream/10 pt-3">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/70 uppercase">
                Bots
              </p>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {bots.length === 0 && (
                <p className="rounded-xl bg-cream/5 p-3 text-center text-sm text-cream-dim">
                  No bots seated.
                </p>
              )}
              {bots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-cream/5 p-3"
                >
                  <span className="text-sm text-cream">
                    {s.username}
                    <span className="ml-1 text-xs text-cream-dim">
                      · {s.seat}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void kickBot(s.username);
                      onClose();
                    }}
                  >
                    Kick
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Trigger + dialog, used in the room lobby. */
export function KickPanel() {
  const room = useRoomStore((s) => s.room);
  const [open, setOpen] = useState(false);

  if (room?.mode !== "four") return null;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Kick player
      </Button>
      {open && <KickDialog onClose={() => setOpen(false)} />}
    </>
  );
}

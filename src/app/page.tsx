"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { pb } from "@/lib/pb";
import { rememberName, savedName } from "@/lib/remember-name";
import type { Room } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

export default function Home() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const init = useSessionStore((s) => s.init);
  const join = useSessionStore((s) => s.join);
  const quick = useSessionStore((s) => s.quick);

  const [username, setUsername] = useState(savedName);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<
    "checking" | "public" | "private" | "missing" | null
  >(null);
  // Suppress the resume-session redirect while a quick-game nav is in flight
  // (solo must land on /game, not the lobby).
  const quickNavRef = useRef<"solo" | "pairs" | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session && !quickNavRef.current)
      router.replace(`/room/${session.code}`);
  }, [session, router]);

  async function doJoin(targetCode: string) {
    setError(null);
    if (!username.trim()) {
      setError("Pick a username first");
      return;
    }
    if (roomStatus === "private" && !password.trim()) {
      setError("This room needs a password");
      return;
    }
    setBusy(true);
    try {
      await join(targetCode, username.trim(), password.trim() || undefined);
      rememberName(username.trim());
      router.push(`/room/${targetCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  async function checkRoom() {
    const c = code.trim().toUpperCase();
    if (!c) {
      setRoomStatus(null);
      return;
    }
    setRoomStatus("checking");
    try {
      const room = await pb
        .collection("rooms")
        .getFirstListItem<Room>(pb.filter("code = {:code}", { code: c }));
      setRoomStatus(room.privacy === "private" ? "private" : "public");
    } catch {
      setRoomStatus("missing");
    }
  }

  async function runQuick(mode: "solo" | "pairs") {
    setError(null);
    if (!username.trim()) {
      setError("Pick a username first");
      return;
    }
    setBusy(true);
    try {
      quickNavRef.current = mode;
      const s = await quick(mode, username.trim());
      rememberName(username.trim());
      router.push(mode === "solo" ? `/game/${s.code}` : `/room/${s.code}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start quick game",
      );
    } finally {
      setBusy(false);
      quickNavRef.current = null;
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(45deg,#baff3d_0_1px,transparent_1px_14px)] opacity-[0.04]" />

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.5em] text-lime/70 uppercase">
            Bid · Play · Score
          </p>
          <h1 className="font-display text-7xl font-black tracking-tight text-cream">
            Bridge
          </h1>
          <p className="mt-3 text-cream-dim">
            Real-time Bridge &amp; Bid Whist. No accounts — just a name and a
            table.
          </p>
        </div>

        <form
          className="felt flex flex-col gap-3 rounded-3xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void doJoin(code.trim().toUpperCase() || randomCode());
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-cream-dim">Your name</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. North Star"
              maxLength={40}
              className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
            />
          </label>

          <div className="mt-2">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/70 uppercase">
              Play now
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={busy}
                onClick={() => void runQuick("solo")}
              >
                Solo
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={() => void runQuick("pairs")}
              >
                2-player
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-cream/10" />
            <span className="text-[10px] font-semibold tracking-[0.3em] text-cream-dim/60 uppercase">
              or
            </span>
            <span className="h-px flex-1 bg-cream/10" />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-cream-dim">Room code</span>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setRoomStatus(null);
                }}
                onBlur={() => void checkRoom()}
                placeholder="Leave blank to create"
                maxLength={8}
                className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 font-mono tracking-widest text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
              />
            </label>

            {roomStatus === "checking" && (
              <p className="text-xs text-cream-dim/70">Checking…</p>
            )}
            {roomStatus === "missing" && (
              <p className="text-xs text-cream-dim">
                No room with that code — leave blank to create
              </p>
            )}
            {roomStatus === "private" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-cream-dim">
                  🔒 Room password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  maxLength={64}
                  className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
                />
              </label>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              Join table
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

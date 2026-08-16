"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
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

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  // Suppress the resume-session redirect while a quick-game nav is in flight
  // (solo must land on /game, not the lobby).
  const quickNavRef = useRef<"solo" | "pairs" | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session && !quickNavRef.current) router.replace(`/room/${session.code}`);
  }, [session, router]);

  async function doJoin(targetCode: string) {
    setError(null);
    if (!username.trim()) {
      setError("Pick a username first");
      return;
    }
    setBusy(true);
    try {
      await join(targetCode, username.trim());
      router.push(`/room/${targetCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  async function runQuick(mode: "solo" | "pairs") {
    setError(null);
    setBusy(true);
    try {
      quickNavRef.current = mode;
      const s = await quick(mode, username.trim());
      router.push(mode === "solo" ? `/game/${s.code}` : `/room/${s.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quick game");
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-cream-dim">Room code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Leave blank to create"
              maxLength={8}
              className="min-h-11 rounded-xl border border-cream/15 bg-ink/50 px-4 font-mono tracking-widest text-cream placeholder:text-cream-dim/40 focus:border-lime/60 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy}>
              {code.trim() ? "Join table" : "Create table"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!username.trim()) {
                  setError("Pick a username first");
                  return;
                }
                setQuickOpen(true);
              }}
            >
              Quick game
            </Button>
          </div>
        </form>
      </div>

      {quickOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
          onClick={() => setQuickOpen(false)}
        >
          <div
            className="felt w-full max-w-sm rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl font-bold text-cream">
              Quick game
            </h3>
            <p className="mt-2 text-sm text-cream-dim">
              No waiting for a full table — jump straight in.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button disabled={busy} onClick={() => void runQuick("solo")}>
                Solo · you + 3 bots
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void runQuick("pairs")}
              >
                2-player · NS vs EW
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

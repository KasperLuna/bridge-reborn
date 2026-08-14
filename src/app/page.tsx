"use client";

import { useEffect, useState } from "react";
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

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (session) router.replace(`/room/${session.code}`);
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
              onClick={() => void doJoin(randomCode())}
            >
              Quick game
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

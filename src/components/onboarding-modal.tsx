"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Bell, Volume2 } from "lucide-react";

import { PlayingCard } from "./playing-card";
import { Button } from "./ui/Button";

const SEEN_KEY = "bridge.onboarding.seen";

export function onboardingSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore, e.g. private mode
  }
}

function SeatDot({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold ${
          on ? "bg-lime/15 text-lime" : "bg-cream/10 text-cream-dim"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function TableVisual() {
  return (
    <div className="felt relative mx-auto grid h-48 w-48 place-items-center rounded-full">
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,transparent_55%,rgb(0_0_0/20%))]" />
      <p className="absolute top-2 text-[9px] tracking-[0.25em] text-cream-dim/60 uppercase">
        Your team
      </p>
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-bold text-lime">N + S</span>
          <div className="flex gap-2">
            <SeatDot label="N" on />
            <SeatDot label="S" on />
          </div>
        </div>
        <span className="justify-self-center text-2xl font-black text-cream/25">
          VS
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-bold text-cream">E + W</span>
          <div className="flex gap-2">
            <SeatDot label="E" on={false} />
            <SeatDot label="W" on={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionVisual() {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-between gap-4">
      <div className="flex">
        {["AS", "6H", "10D", "QC"].map((card, i) => (
          <div key={card} style={{ marginLeft: i === 0 ? 0 : -18 }}>
            <PlayingCard card={card} size="sm" isPlayable={false} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-cream/5 px-2.5 py-1 text-xs">
          <span className="text-cream-dim">You</span>
          <span className="font-semibold text-cream">▲1S</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-cream/5 px-2.5 py-1 text-xs">
          <span className="text-cream-dim">West</span>
          <span className="font-semibold text-cream">▼2S</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-lime/15 px-2.5 py-1 text-xs">
          <span className="text-lime/80">Contract</span>
          <span className="font-bold text-lime">▼2S</span>
        </div>
      </div>
    </div>
  );
}

function TrickVisual() {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
      <div className="relative grid grid-cols-2 gap-2">
        <PlayingCard card="7H" size="sm" isPlayable={false} />
        <PlayingCard card="KH" size="sm" isPlayable={false} />
        <PlayingCard card="2H" size="sm" isPlayable={false} />
        <div className="relative">
          <PlayingCard card="AS" size="sm" isPlayable={false} isTrump />
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -right-6 -bottom-2 rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-ink shadow-[0_0_16px_-2px_rgb(186_255_61/60%)]"
          >
            Trump wins
          </motion.span>
        </div>
      </div>
      <p className="text-xs text-cream-dim">
        <span className="font-semibold text-suit-red">♥ led</span>: follow
        suit, or beat with{" "}
        <span className="font-semibold text-suit-black">♠</span>
      </p>
    </div>
  );
}

function ScoreVisual() {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <div className="flex items-center justify-between rounded-xl bg-lime/10 px-3 py-2">
        <span className="text-sm text-cream">
          Make 3NT <span className="text-xs text-lime/70">(+1 overtrick)</span>
        </span>
        <span className="font-display text-xl font-bold text-lime">+400</span>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-danger/10 px-3 py-2">
        <span className="text-sm text-cream">
          Go down <span className="text-xs text-danger/70">(down 2)</span>
        </span>
        <span className="font-display text-xl font-bold text-danger">−100</span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-4 text-cream-dim">
        <span className="flex items-center gap-1.5 text-xs">
          <Volume2 className="h-4 w-4 text-lime/80" /> blip on your turn
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Bell className="h-4 w-4 text-lime/80" /> ping when away
        </span>
      </div>
    </div>
  );
}

const STEPS: {
  title: string;
  body: string;
  visual: () => React.ReactNode;
}[] = [
  {
    title: "The table",
    body: "Partners sit opposite each other: North + South vs East + West. Win tricks and score more points than the other side.",
    visual: TableVisual,
  },
  {
    title: "The auction",
    body: "After the deal, players bid: level plus strain, like “▲ 3 NT” (uptown: high cards win) or “▼ 2 S” (downtown: low cards win). The final bid wins the contract, and that side must make it.",
    visual: AuctionVisual,
  },
  {
    title: "The play",
    body: "Follow the led suit if you can. If not, play anything; a trump card beats the rest. ▲ Uptown: the highest card wins each trick. ▼ Downtown: the lowest card wins instead.",
    visual: TrickVisual,
  },
  {
    title: "Scoring",
    body: "Make your contract and you score; go down and the defenders score. A soft blip tells you it's your turn, and a ping finds you when you're away.",
    visual: ScoreVisual,
  },
];

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  const Visual = current.visual;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div className="felt w-full max-w-sm rounded-3xl p-6 text-center">
        <p className="text-xs tracking-[0.3em] text-lime/70 uppercase">
          How to play
        </p>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          <div className="grid min-h-44 place-items-center rounded-2xl bg-ink/30 px-2">
            <Visual />
          </div>
          <h3 className="mt-4 font-display text-2xl font-bold text-cream">
            {current.title}
          </h3>
          <p className="mt-2 min-h-14 text-sm text-cream-dim">{current.body}</p>
        </motion.div>

        <div className="mt-4 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-1.5 rounded-full transition-colors ${
                i === step ? "w-5 bg-lime" : "w-1.5 bg-cream/20"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onDone}>
            Skip
          </Button>
          <Button
            onClick={() => (last ? onDone() : setStep((s) => s + 1))}
            className="flex-1"
          >
            {last ? "Got it" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

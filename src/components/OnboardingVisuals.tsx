import { motion } from "motion/react";
import { Bell, Volume2 } from "lucide-react";

import { PlayingCard } from "./playing-card";

interface SeatDotProps {
  label: string;
  isOn: boolean;
}

const SeatDot = ({ label, isOn }: SeatDotProps) => (
  <div className="flex flex-col items-center gap-1">
    <span
      className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold ${
        isOn ? "bg-lime/15 text-lime" : "bg-cream/10 text-cream-dim"
      }`}
    >
      {label}
    </span>
  </div>
);

export const TableVisual = () => (
  <div className="felt relative mx-auto grid h-48 w-48 place-items-center rounded-full">
    <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,transparent_55%,rgb(0_0_0/20%))]" />
    <p className="absolute top-2 text-[9px] tracking-[0.25em] text-cream-dim/60 uppercase">
      Your team
    </p>
    <div className="grid grid-cols-3 items-center gap-2">
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs font-bold text-lime">N + S</span>
        <div className="flex gap-2">
          <SeatDot label="N" isOn />
          <SeatDot label="S" isOn />
        </div>
      </div>
      <span className="justify-self-center text-2xl font-black text-cream/25">
        VS
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs font-bold text-cream">E + W</span>
        <div className="flex gap-2">
          <SeatDot label="E" isOn={false} />
          <SeatDot label="W" isOn={false} />
        </div>
      </div>
    </div>
  </div>
);

export const AuctionVisual = () => (
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

export const TrickVisual = () => (
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
      <span className="font-semibold text-suit-red">♥ led</span>: follow suit,
      or beat with{" "}
      <span className="font-semibold text-suit-black">♠</span>
    </p>
  </div>
);

export const ScoreVisual = () => (
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
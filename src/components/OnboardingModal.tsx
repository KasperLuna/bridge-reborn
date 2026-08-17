"use client";

import { useState } from "react";

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
    // ignore — private mode etc.
  }
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "The table",
    body: "Partners sit opposite each other: North + South vs East + West. Your team wins by taking tricks and scoring more points than the other side.",
  },
  {
    title: "The auction",
    body: 'After the deal, players bid — level plus strain, like "3 NT" or "2 Hearts". The highest bid wins the contract, and that side must make it.',
  },
  {
    title: "The play",
    body: "Follow the led suit if you can. If not, play anything — a trump card beats the rest. Highest card of the led suit, or trump, wins the trick.",
  },
  {
    title: "Scoring",
    body: "Make your contract and you score; go down and the defenders score. A quiet blip and a notification let you know when it's your turn.",
  },
];

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

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
        <h3 className="mt-1 font-display text-2xl font-bold text-cream">
          {current.title}
        </h3>
        <p className="mt-3 min-h-20 text-sm text-cream-dim">{current.body}</p>

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

"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-lime text-ink hover:bg-lime-dim focus-visible:outline-lime disabled:opacity-40",
  ghost:
    "border border-cream/20 text-cream hover:border-lime/60 hover:text-lime focus-visible:outline-lime disabled:opacity-40",
  danger:
    "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 focus-visible:outline-danger disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-lime text-ink hover:bg-lime-dim focus-visible:outline-lime disabled:opacity-40",
        ghost:
          "border border-cream/20 text-cream hover:border-lime/60 hover:text-lime focus-visible:outline-lime disabled:opacity-40",
        danger:
          "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 focus-visible:outline-danger disabled:opacity-40",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = ({ className, variant, ...props }: ButtonProps) => (
  <button className={cn(buttonStyles({ variant }), className)} {...props} />
);
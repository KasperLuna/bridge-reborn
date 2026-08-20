import { KasperLunaLogo } from "@/components/KasperLunaLogo";

export function Footer() {
  return (
    <footer className="flex flex-col items-center justify-center gap-2 pb-6 pt-8">
      <a
        href="https://kasperluna.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 text-cream-dim transition-opacity hover:opacity-80"
      >
        <span className="text-xs font-semibold tracking-[0.4em] uppercase">
          by
        </span>
        <KasperLunaLogo className="h-5 w-auto fill-white" />
      </a>
    </footer>
  );
}
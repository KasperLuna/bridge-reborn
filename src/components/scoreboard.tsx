import type { Vulnerability } from "@/lib/game/types";

interface ScoreboardProps {
  contract: string;
  vulnerability: Vulnerability;
  /** Tricks won by each partnership in the current hand. */
  nsTricks?: number | null;
  ewTricks?: number | null;
  /** Tricks each side needs: to make the contract (declarers) or to set it. */
  nsNeeded?: number | null;
  ewNeeded?: number | null;
  onContractClick?: () => void;
}

interface SideChipProps {
  label: string;
  tricks: number;
  needed: number;
  progress: number;
}

const LIME = "186, 255, 61";

const sideStyle = (progress: number) => {
  const p = Math.max(0, Math.min(progress, 1));
  return {
    borderColor: `rgba(${LIME}, ${0.14 + p * 0.55})`,
    boxShadow:
      p > 0.25
        ? `0 0 ${6 + p * 22}px -6px rgba(${LIME}, ${0.35 + p * 0.55})`
        : undefined,
  };
};

const numberColor = (progress: number) => {
  const p = Math.max(0, Math.min(progress, 1));
  return `rgba(${LIME}, ${0.45 + p * 0.55})`;
};

const SideChip = ({ label, tricks, needed, progress }: SideChipProps) => (
  <div
    className="flex items-center gap-1.5 rounded-2xl border bg-felt-deep/70 px-2 py-1 text-xs text-cream transition-all sm:px-3 sm:py-2 sm:text-sm"
    style={sideStyle(progress)}
  >
    <span className="text-cream-dim">{label}</span>
    <span className="font-display" style={{ color: numberColor(progress) }}>
      {tricks}
    </span>
    <span className="text-cream-dim">/{needed}</span>
  </div>
);

export const Scoreboard = ({
  contract,
  vulnerability,
  nsTricks = null,
  ewTricks = null,
  nsNeeded = null,
  ewNeeded = null,
  onContractClick,
}: ScoreboardProps) => {
  const vuln = vulnerability === "none" ? null : vulnerability.toUpperCase();
  const showTally = contract !== "" && nsTricks !== null && nsNeeded !== null;

  const sides = showTally
    ? [
        {
          label: "NS" as const,
          tricks: nsTricks!,
          needed: nsNeeded!,
          progress: nsTricks! / nsNeeded!,
        },
        {
          label: "EW" as const,
          tricks: ewTricks!,
          needed: ewNeeded!,
          progress: ewTricks! / ewNeeded!,
        },
      ].sort((a, b) => b.progress - a.progress)
    : [];
  const leader = sides[0];
  const trailer = sides[1];

  return (
    <div className="flex items-center justify-end gap-1.5 font-semibold sm:gap-2">
      {leader && trailer && (
        <SideChip
          label={leader.label}
          tricks={leader.tricks}
          needed={leader.needed}
          progress={leader.progress}
        />
      )}
      {contract && (
        <button
          type="button"
          onClick={onContractClick}
          className="rounded-2xl border border-lime/30 bg-lime/10 px-2 py-1 font-display text-sm text-lime transition-colors hover:bg-lime/20 sm:px-3 sm:py-2 sm:text-base"
        >
          {contract}
        </button>
      )}
      {leader && trailer && (
        <SideChip
          label={trailer.label}
          tricks={trailer.tricks}
          needed={trailer.needed}
          progress={trailer.progress}
        />
      )}
      {vuln && (
        <div className="rounded-2xl border border-cream/10 bg-felt-deep/70 px-2 py-1 text-[10px] text-cream-dim sm:px-3 sm:py-2 sm:text-xs">
          {vuln}
        </div>
      )}
    </div>
  );
};
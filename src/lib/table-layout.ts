import type { TableDir } from "@/components/TrickArea";
import type { Seat } from "@/lib/game/types";

export const SEATS: Seat[] = ["N", "E", "S", "W"];

/**
 * Seat badge placement. E/W normally sit at the mid-sides, right next to their
 * trick-card slots. During the auction the centered bid panel occupies the felt
 * (it's near table-sized on smaller viewports), so they tuck into the top
 * corners on every breakpoint to stay clear of it.
 */
export function badgeClass(dir: TableDir, auction: boolean): string {
  switch (dir) {
    case "top":
      return "left-1/2 top-2 -translate-x-1/2";
    case "bottom":
      return "bottom-2 left-1/2 -translate-x-1/2";
    case "right":
      return auction ? "top-2 right-2" : "right-2 top-1/2 -translate-y-1/2";
    case "left":
      return auction ? "top-2 left-2" : "left-2 top-1/2 -translate-y-1/2";
    default:
      return "";
  }
}

/** Maps a seat to a screen direction so the player's own seat sits at the bottom. */
export function seatDir(seat: Seat, mySeat: Seat | null): TableDir {
  if (!mySeat) {
    const base: Record<Seat, TableDir> = {
      N: "top",
      E: "right",
      S: "bottom",
      W: "left",
    };
    return base[seat];
  }
  const dir = (SEATS.indexOf(seat) - SEATS.indexOf(mySeat) + 4) % 4;
  return dir === 0
    ? "bottom"
    : dir === 1
      ? "left"
      : dir === 2
        ? "top"
        : "right";
}

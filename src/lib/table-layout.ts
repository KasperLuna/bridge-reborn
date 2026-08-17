import type { TableDir } from "@/components/TrickArea";
import type { Seat } from "@/lib/game/types";

export const SEATS: Seat[] = ["N", "E", "S", "W"];

/**
 * Seat badge placement. E/W always sit in the top corners; the mid-sides are
 * reserved for the trick-card slots, which sit at the same height as the
 * mid-side badges used to and got overlapped by them on short/landscape
 * viewports.
 */
export function badgeClass(dir: TableDir): string {
  switch (dir) {
    case "top":
      return "left-1/2 top-2 -translate-x-1/2";
    case "bottom":
      return "bottom-2 left-1/2 -translate-x-1/2";
    case "right":
      return "top-2 right-2";
    case "left":
      return "top-2 left-2";
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

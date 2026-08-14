import type { Ruleset, RulesetOverrides } from "./types";
import bidWhistDefault from "./presets/bid-whist-default.json";
import standardBridge from "./presets/standard-bridge.json";

export type { Ruleset, RulesetOverrides } from "./types";

export const DEFAULT_RULESET_ID = "bid-whist-default";

const presets: Record<string, Ruleset> = {
  [bidWhistDefault.id]: bidWhistDefault as Ruleset,
  [standardBridge.id]: standardBridge as Ruleset,
};

export function listPresets(): Ruleset[] {
  return Object.values(presets);
}

export function getPreset(id: string | null | undefined): Ruleset {
  if (id && presets[id]) return presets[id];
  return presets[DEFAULT_RULESET_ID]!;
}

/** Shallow-merge per top-level key so a room snapshot can override part of a preset. */
export function applyOverrides(
  base: Ruleset,
  overrides?: RulesetOverrides | null,
): Ruleset {
  if (!overrides) return base;
  const out: Ruleset = { ...base };
  for (const key of Object.keys(overrides) as (keyof Ruleset)[]) {
    const value = overrides[key];
    if (value === undefined) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = { ...(base[key] as object), ...value } as never;
    } else {
      out[key] = value as never;
    }
  }
  return out;
}

/**
 * Resolve a room's stored `ruleset` json. Snapshots are merged over the
 * current preset for the same id so new preset fields backfill old rooms.
 */
export function resolveRuleset(stored: unknown): Ruleset {
  if (stored && typeof stored === "object" && "scoring" in stored) {
    const snapshot = stored as Ruleset;
    return applyOverrides(getPreset(snapshot.id), snapshot);
  }
  return getPreset(DEFAULT_RULESET_ID);
}

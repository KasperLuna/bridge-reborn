import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULESET_ID,
  getPreset,
  listPresets,
  resolveRuleset,
} from "./index";

describe("rulesets", () => {
  it("ships two presets with bid whist as default", () => {
    expect(listPresets()).toHaveLength(2);
    expect(getPreset(DEFAULT_RULESET_ID).play.endHandEarly).toBe(true);
    expect(getPreset("standard-bridge").play.endHandEarly).toBe(false);
  });

  it("falls back to default for unknown ids", () => {
    expect(getPreset("nope")).toBe(getPreset(DEFAULT_RULESET_ID));
  });

  it("backfills preset fields missing from old snapshots", () => {
    const snapshot = { id: "standard-bridge", scoring: { minorTrick: 20 } };
    const resolved = resolveRuleset(snapshot);
    expect(resolved.play.endHandEarly).toBe(false);
    expect(resolved.scoring.minorTrick).toBe(20);
    expect(resolved.scoring.majorTrick).toBe(30);
  });

  it("defaults when stored value is null", () => {
    expect(resolveRuleset(null).id).toBe(DEFAULT_RULESET_ID);
  });
});

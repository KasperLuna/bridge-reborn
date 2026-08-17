import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./room-password";

describe("room-password", () => {
  it("roundtrips: the stored hash verifies the original password", () => {
    const stored = hashPassword("hunter2-secret");
    expect(verifyPassword("hunter2-secret", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("hunter2-secret");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", () => {
    expect(hashPassword("hunter2-secret")).not.toBe(
      hashPassword("hunter2-secret"),
    );
  });

  it("returns false for null, undefined, and empty stored values", () => {
    expect(verifyPassword("hunter2-secret", null)).toBe(false);
    expect(verifyPassword("hunter2-secret", undefined)).toBe(false);
    expect(verifyPassword("hunter2-secret", "")).toBe(false);
  });

  it("returns false for malformed stored values", () => {
    expect(verifyPassword("hunter2-secret", "no-salt-and-hash")).toBe(false);
    expect(verifyPassword("hunter2-secret", "tooshort.digest")).toBe(false);
  });
});

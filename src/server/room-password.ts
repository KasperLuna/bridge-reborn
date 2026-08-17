import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// PocketBase caps `rooms.password_hash` at 64 chars, so the full sha256 hex
// (64) can't fit alongside a 16-byte salt. We use an 8-byte hex salt (16
// chars) plus the full sha256 digest in base64 (44 chars): 16 + 1 + 44 = 61.
const SALT_HEX_LEN = 16;
const HASH_B64_LEN = 44;

/** Hashes a password for storage as `${salt}.${hash}` (salted sha256). */
export function hashPassword(password: string): string {
  const salt = randomBytes(8).toString("hex");
  const hash = createHash("sha256")
    .update(salt + password)
    .digest("base64");
  return `${salt}.${hash}`;
}

/** Timing-safe check; returns false for malformed or empty stored values. */
export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (typeof stored !== "string" || stored.length === 0) return false;
  const dot = stored.indexOf(".");
  if (dot !== SALT_HEX_LEN || stored.length - dot - 1 !== HASH_B64_LEN) {
    return false;
  }
  const salt = stored.slice(0, dot);
  const expectedB64 = stored.slice(dot + 1);
  const actual = createHash("sha256")
    .update(salt + password)
    .digest();
  const expected = Buffer.from(expectedB64, "base64");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

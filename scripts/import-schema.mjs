// Aligns pb_schema.json with a running PocketBase instance (admin API).
// Uses the bulk import endpoint: creates missing + updates existing collections.
// Usage: node scripts/import-schema.mjs
import fs from "fs";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8091";
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@bridge.local";
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "adminadmin";

async function main() {
  const collections = JSON.parse(
    fs.readFileSync(new URL("../pb_schema.json", import.meta.url), "utf8"),
  );

  const auth = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
    },
  ).then((r) => r.json());
  if (!auth.token) {
    throw new Error("Superuser auth failed: " + JSON.stringify(auth));
  }

  const res = await fetch(`${PB_URL}/api/collections/import`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: auth.token,
    },
    body: JSON.stringify({ collections, deleteMissing: false }),
  });
  if (!res.ok) {
    throw new Error("Schema import failed: " + res.status + " " + (await res.text()));
  }
  console.log("schema aligned:", collections.length, "collections");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// Imports pb_schema.json into a running PocketBase instance (admin API).
// Usage: node scripts/import-schema.mjs
import fs from "fs";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8091";
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@bridge.local";
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "adminadmin";

// Dependency order matters: relation fields require their target collection to exist.
const ORDER = [
  "rooms",
  "room_seats",
  "kick_votes",
  "games",
  "hands",
  "bids",
  "contracts",
  "tricks",
  "plays",
  "hand_results",
];

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

  for (const name of ORDER) {
    const collection = collections.find((c) => c.name === name);
    const res = await fetch(`${PB_URL}/api/collections`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: auth.token,
      },
      body: JSON.stringify(collection),
    });
    if (res.status === 200) {
      console.log("created", name);
    } else {
      const body = await res.text();
      console.log("skip", name, res.status, body.slice(0, 80));
    }
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

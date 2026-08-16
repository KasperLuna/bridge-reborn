// Adds quick-game fields to an existing PocketBase install (idempotent).
// The schema import script only creates new collections, so existing dev DBs
// need the `rooms.mode` + `room_seats.is_bot` fields patched by hand.
// Usage: node scripts/migrate-quick-mode.mjs
const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8091";
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@bridge.local";
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "adminadmin";

const FIELD_DEFS = {
  rooms: [
    {
      help: "",
      hidden: false,
      id: "select100000002",
      maxSelect: 1,
      name: "mode",
      presentable: false,
      required: true,
      system: false,
      type: "select",
      values: ["four", "pairs", "solo"],
    },
  ],
  room_seats: [
    {
      hidden: false,
      id: "bool1000000002",
      name: "is_bot",
      presentable: false,
      required: false,
      system: false,
      type: "bool",
    },
  ],
  // Usernames can own two seats (pairs mode), so plays/tricks/contracts carry
  // their own seat to keep trick rendering, turn order and winners exact.
  plays: [
    {
      hidden: false,
      id: "select1000000009",
      maxSelect: 1,
      name: "seat",
      presentable: false,
      required: false,
      system: false,
      type: "select",
      values: ["N", "S", "E", "W"],
    },
  ],
  tricks: [
    {
      hidden: false,
      id: "select1000000008",
      maxSelect: 1,
      name: "leader_seat",
      presentable: false,
      required: false,
      system: false,
      type: "select",
      values: ["N", "S", "E", "W"],
    },
    {
      hidden: false,
      id: "select1000000009",
      maxSelect: 1,
      name: "winner_seat",
      presentable: false,
      required: false,
      system: false,
      type: "select",
      values: ["N", "S", "E", "W"],
    },
  ],
  contracts: [
    {
      hidden: false,
      id: "select1000000007",
      maxSelect: 1,
      name: "declarer_seat",
      presentable: false,
      required: false,
      system: false,
      type: "select",
      values: ["N", "S", "E", "W"],
    },
  ],
};

async function main() {
  const auth = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
    },
  ).then((r) => r.json());
  if (!auth.token) throw new Error("Superuser auth failed: " + JSON.stringify(auth));

  for (const [collection, fields] of Object.entries(FIELD_DEFS)) {
    const res = await fetch(`${PB_URL}/api/collections/${collection}`, {
      headers: { authorization: auth.token },
    });
    const coll = await res.json();
    const missing = fields.filter(
      (f) => !coll.fields.some((e) => e.name === f.name),
    );
    if (missing.length === 0) {
      console.log("skip", collection, "(fields present)");
      continue;
    }
    const body = { ...coll, fields: [...coll.fields, ...missing] };
    const upd = await fetch(`${PB_URL}/api/collections/${collection}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: auth.token,
      },
      body: JSON.stringify(body),
    });
    if (upd.status === 200) {
      console.log("patched", collection, missing.map((f) => f.name).join(","));
    } else {
      console.log("fail", collection, upd.status, (await upd.text()).slice(0, 120));
    }
  }

  // rooms.mode is required, so rooms created before this migration have an
  // empty mode and every subsequent update fails validation. Backfill them.
  const rooms = await fetch(
    `${PB_URL}/api/collections/rooms/records?filter=${encodeURIComponent(
      'mode = ""',
    )}&perPage=200`,
    { headers: { authorization: auth.token } },
  ).then((r) => r.json());
  for (const room of rooms.items ?? []) {
    const upd = await fetch(`${PB_URL}/api/collections/rooms/records/${room.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: auth.token,
      },
      body: JSON.stringify({ mode: "four" }),
    });
    console.log("backfill", room.code, upd.status);
  }
  if ((rooms.items ?? []).length === 0) {
    console.log("backfill rooms: none missing mode");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
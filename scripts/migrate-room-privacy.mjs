// Adds rooms.privacy (select), rooms.password_hash (text), rooms.joinable (bool)
// to an existing PocketBase instance.
// Usage: node scripts/migrate-room-privacy.mjs
const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8091";
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@bridge.local";
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "adminadmin";

async function main() {
  const auth = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
    },
  ).then((r) => r.json());
  if (!auth.token)
    throw new Error("Superuser auth failed: " + JSON.stringify(auth));

  const coll = await fetch(`${PB_URL}/api/collections/rooms`, {
    headers: { authorization: auth.token },
  }).then((r) => r.json());

  const has = (name) => coll.fields.some((f) => f.name === name);
  if (has("privacy") && has("password_hash") && has("joinable")) {
    console.log("skip: rooms already has privacy fields");
    return;
  }

  const fields = [...coll.fields];
  if (!has("privacy")) {
    fields.push({
      hidden: false,
      id: "select700000001",
      maxSelect: 1,
      name: "privacy",
      presentable: false,
      required: true,
      system: false,
      type: "select",
      values: ["public", "private"],
    });
  }
  if (!has("password_hash")) {
    fields.push({
      autogeneratePattern: "",
      help: "",
      hidden: false,
      id: "text700000001",
      max: 64,
      min: 0,
      name: "password_hash",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text",
    });
  }
  if (!has("joinable")) {
    fields.push({
      help: "",
      hidden: false,
      id: "bool700000001",
      name: "joinable",
      presentable: false,
      required: false,
      system: false,
      type: "bool",
    });
  }

  const body = { ...coll, fields };
  const upd = await fetch(`${PB_URL}/api/collections/rooms`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: auth.token },
    body: JSON.stringify(body),
  });
  if (upd.status === 200) {
    console.log("patched rooms: privacy + password_hash + joinable");
  } else {
    console.log("fail", upd.status, (await upd.text()).slice(0, 120));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
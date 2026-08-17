// Makes kick_votes.votes_no optional. PocketBase rejects `[]` as blank for
// required JSON fields, so every fresh kick vote's empty no-votes array failed.
// Usage: node scripts/migrate-kick-votes.mjs
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

  const coll = await fetch(`${PB_URL}/api/collections/kick_votes`, {
    headers: { authorization: auth.token },
  }).then((r) => r.json());

  const field = coll.fields.find((f) => f.name === "votes_no");
  if (!field) {
    console.log("fail: kick_votes.votes_no field not found");
    process.exit(1);
  }
  if (field.required === false) {
    console.log("skip: votes_no already optional");
    return;
  }

  const body = {
    ...coll,
    fields: coll.fields.map((f) =>
      f.name === "votes_no" ? { ...f, required: false } : f,
    ),
  };
  const upd = await fetch(`${PB_URL}/api/collections/kick_votes`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: auth.token },
    body: JSON.stringify(body),
  });
  if (upd.status === 200) {
    console.log("patched kick_votes.votes_no (required -> false)");
  } else {
    console.log("fail", upd.status, (await upd.text()).slice(0, 120));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
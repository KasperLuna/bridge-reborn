// Fixes hand_results.result_delta so a contract made exactly (delta 0) can be
// scored. PocketBase treats `0` as blank for required number fields, so the
// required flag made every exact-make hand fail to end.
// Usage: node scripts/migrate-result-delta.mjs
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

  const coll = await fetch(`${PB_URL}/api/collections/hand_results`, {
    headers: { authorization: auth.token },
  }).then((r) => r.json());

  const field = coll.fields.find((f) => f.name === "result_delta");
  if (!field) {
    console.log("fail: result_delta field not found");
    process.exit(1);
  }
  if (field.required === false) {
    console.log("skip: result_delta already optional");
    return;
  }

  const body = {
    ...coll,
    fields: coll.fields.map((f) =>
      f.name === "result_delta" ? { ...f, required: false } : f,
    ),
  };
  const upd = await fetch(`${PB_URL}/api/collections/hand_results`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: auth.token,
    },
    body: JSON.stringify(body),
  });
  if (upd.status === 200) {
    console.log("patched hand_results.result_delta (required -> false)");
  } else {
    console.log("fail", upd.status, (await upd.text()).slice(0, 120));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

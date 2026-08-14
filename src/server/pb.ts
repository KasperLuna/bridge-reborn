import PocketBase from "pocketbase";

import { serverEnv } from "@/env";

let clientPromise: Promise<PocketBase> | null = null;

async function createClient(): Promise<PocketBase> {
  const pb = new PocketBase(serverEnv.POCKETBASE_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(
      serverEnv.POCKETBASE_ADMIN_EMAIL,
      serverEnv.POCKETBASE_ADMIN_PASSWORD,
    );
  return pb;
}

/** Shared admin client for server-side writes. Re-auths when the token expires. */
export async function getAdminClient(): Promise<PocketBase> {
  if (!clientPromise) clientPromise = createClient();
  const pb = await clientPromise;
  if (!pb.authStore.isValid) {
    await pb
      .collection("_superusers")
      .authWithPassword(
        serverEnv.POCKETBASE_ADMIN_EMAIL,
        serverEnv.POCKETBASE_ADMIN_PASSWORD,
      );
  }
  return pb;
}

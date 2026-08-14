import PocketBase from "pocketbase";

import { clientEnv } from "@/env";

/** Browser PocketBase client. Read-only: all mutations go through API routes. */
export const pb = new PocketBase(clientEnv.NEXT_PUBLIC_POCKETBASE_URL);
pb.autoCancellation(false);

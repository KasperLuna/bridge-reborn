import { z } from "zod";

const url = z.string().url();

/** Values safe to embed in the browser bundle. */
const clientSchema = z.object({
  NEXT_PUBLIC_POCKETBASE_URL: url.default("http://127.0.0.1:8090"),
});

/** Values used only on the server. */
const serverSchema = z.object({
  POCKETBASE_URL: url.default("http://127.0.0.1:8090"),
  POCKETBASE_ADMIN_EMAIL: z.string().default("admin@bridge.local"),
  POCKETBASE_ADMIN_PASSWORD: z.string().default("adminadmin"),
  DD_SOLVER_URL: url.optional(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
});

export const serverEnv = serverSchema.parse({
  POCKETBASE_URL: process.env.POCKETBASE_URL,
  POCKETBASE_ADMIN_EMAIL: process.env.POCKETBASE_ADMIN_EMAIL,
  POCKETBASE_ADMIN_PASSWORD: process.env.POCKETBASE_ADMIN_PASSWORD,
  DD_SOLVER_URL: process.env.DD_SOLVER_URL,
});

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

export function createDb(url = env.DATABASE_URL) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

/** Shared app-level DB client (lazy singleton). */
export function getDb(): Db {
  if (!cached) {
    cached = createDb();
  }
  return cached;
}

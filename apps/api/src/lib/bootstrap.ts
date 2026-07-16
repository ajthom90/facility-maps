import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { env } from "./env.js";
import { hashPassword } from "./passwords.js";

/**
 * Create the first admin from env when the table is empty.
 * No-op if any user exists, or if either bootstrap env var is empty.
 */
export async function bootstrapAdmin(db: Db): Promise<void> {
  const username = env.ADMIN_BOOTSTRAP_USERNAME.trim();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    return;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminUsers);
  if ((row?.count ?? 0) > 0) {
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.insert(adminUsers).values({
    username,
    passwordHash,
  });
}

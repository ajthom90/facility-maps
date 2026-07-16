import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { readSession } from "../lib/session.js";

export type AdminUser = {
  id: string;
  username: string;
  disabled: boolean;
};

export type AdminVariables = {
  adminUser: AdminUser;
};

/**
 * Require a valid session cookie for a non-disabled admin user.
 * Sets `adminUser` on the context when successful.
 */
export function requireAdmin(getDb: () => Db): MiddlewareHandler {
  return async (c, next) => {
    const session = readSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [user] = await getDb()
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        disabled: adminUsers.disabled,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, session.userId))
      .limit(1);

    if (!user || user.disabled) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("adminUser", user);
    await next();
  };
}

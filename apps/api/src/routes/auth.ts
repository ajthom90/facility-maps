import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { verifyPassword } from "../lib/passwords.js";
import { clearSessionCookie, readSession, setSessionCookie } from "../lib/session.js";
import { rateLimitLogin } from "../middleware/rate-limit-login.js";

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const INVALID_CREDS = { error: "Invalid username or password" } as const;

function publicUser(user: { id: string; username: string }) {
  return { id: user.id, username: user.username };
}

export function authRoutes(getDb: () => Db) {
  const app = new Hono();

  app.post("/login", rateLimitLogin(), async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(INVALID_CREDS, 401);
    }

    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(INVALID_CREDS, 401);
    }

    const { username, password } = parsed.data;
    const [user] = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (!user || user.disabled) {
      return c.json(INVALID_CREDS, 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return c.json(INVALID_CREDS, 401);
    }

    setSessionCookie(c, { userId: user.id, username: user.username });
    return c.json({ user: publicUser(user) });
  });

  app.post("/logout", (c) => {
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
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

    return c.json({ user: publicUser(user) });
  });

  return app;
}

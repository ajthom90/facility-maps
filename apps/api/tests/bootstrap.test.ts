/**
 * Bootstrap admin creation tests.
 *
 * Uses a temp SQLite file (no external DB).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { adminUsers } from "../src/db/schema.js";
import { bootstrapAdmin } from "../src/lib/bootstrap.js";
import { env } from "../src/lib/env.js";
import { verifyPassword } from "../src/lib/passwords.js";
import { makeTestSqlitePath } from "./test-db.js";

const SQLITE_PATH = makeTestSqlitePath("bootstrap");

describe("bootstrapAdmin", () => {
  let db: Db;
  let previousUsername: string;
  let previousPassword: string;
  let savedUsers: Array<{
    id: string;
    username: string;
    passwordHash: string;
    disabled: boolean;
    createdAt: Date;
  }>;

  beforeAll(async () => {
    runMigrations(SQLITE_PATH);
    db = createDb(SQLITE_PATH);
    previousUsername = env.ADMIN_BOOTSTRAP_USERNAME;
    previousPassword = env.ADMIN_BOOTSTRAP_PASSWORD;
    // Snapshot existing admins so we can restore after destructive tests
    savedUsers = await db.select().from(adminUsers);
  });

  afterAll(async () => {
    env.ADMIN_BOOTSTRAP_USERNAME = previousUsername;
    env.ADMIN_BOOTSTRAP_PASSWORD = previousPassword;
    await db.delete(adminUsers);
    if (savedUsers.length > 0) {
      await db.insert(adminUsers).values(
        savedUsers.map((u) => ({
          id: u.id,
          username: u.username,
          passwordHash: u.passwordHash,
          disabled: u.disabled,
          createdAt: u.createdAt,
        }))
      );
    }
  });

  it("creates one admin when users empty and both env vars set; second call is no-op", async () => {
    await db.delete(adminUsers);
    env.ADMIN_BOOTSTRAP_USERNAME = "bootstrap-admin";
    env.ADMIN_BOOTSTRAP_PASSWORD = "bootstrap-pass-123";

    await bootstrapAdmin(db);
    const first = await db.select().from(adminUsers);
    expect(first).toHaveLength(1);
    expect(first[0].username).toBe("bootstrap-admin");
    expect(await verifyPassword("bootstrap-pass-123", first[0].passwordHash)).toBe(true);

    await bootstrapAdmin(db);
    const second = await db.select().from(adminUsers);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
  });

  it("does nothing when env vars are empty", async () => {
    await db.delete(adminUsers);
    env.ADMIN_BOOTSTRAP_USERNAME = "";
    env.ADMIN_BOOTSTRAP_PASSWORD = "";

    await bootstrapAdmin(db);
    const users = await db.select().from(adminUsers);
    expect(users).toHaveLength(0);
  });

  it("does nothing when users already exist even with env set", async () => {
    await db.delete(adminUsers);
    await db.insert(adminUsers).values({
      username: "existing-admin",
      passwordHash: "not-a-real-hash",
    });

    env.ADMIN_BOOTSTRAP_USERNAME = "should-not-create";
    env.ADMIN_BOOTSTRAP_PASSWORD = "whatever";

    await bootstrapAdmin(db);
    const users = await db.select().from(adminUsers);
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("existing-admin");

    const bootstrapped = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, "should-not-create"));
    expect(bootstrapped).toHaveLength(0);
  });
});

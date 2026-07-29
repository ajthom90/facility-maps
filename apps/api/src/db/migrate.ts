import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../lib/env.js";
import { openSqlite } from "./client.js";
import { ensureSchemaCompat } from "./ensure-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Apply committed SQL migrations from apps/api/drizzle, then compat upgrades. */
export function runMigrations(sqlitePath = env.SQLITE_PATH): void {
  const sqlite = openSqlite(sqlitePath);
  const db = drizzle(sqlite);
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");
  migrate(db, { migrationsFolder });
  // Idempotent upgrades for DBs that applied an older 0000_init before hierarchy modes.
  ensureSchemaCompat(sqlite);
  sqlite.close();
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    runMigrations();
    console.log("Migrations applied");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed", err);
    process.exit(1);
  }
}

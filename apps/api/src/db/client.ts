import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

export type SqliteDatabase = Database.Database;

export function openSqlite(sqlitePath = env.SQLITE_PATH): SqliteDatabase {
  const resolved = path.resolve(sqlitePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const sqlite = new Database(resolved);
  // Enforce FKs (off by default in SQLite).
  sqlite.pragma("foreign_keys = ON");
  // WAL: better concurrent reads; backup must include -wal/-shm or checkpoint first.
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export function createDb(sqlitePath = env.SQLITE_PATH) {
  const sqlite = openSqlite(sqlitePath);
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;
let cachedPath: string | undefined;

/** Shared app-level DB client (lazy singleton). */
export function getDb(): Db {
  if (!cached || cachedPath !== env.SQLITE_PATH) {
    cached = createDb();
    cachedPath = env.SQLITE_PATH;
  }
  return cached;
}

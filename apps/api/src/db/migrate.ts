import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../lib/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Apply committed SQL migrations from apps/api/drizzle. */
export async function runMigrations(url = env.DATABASE_URL): Promise<void> {
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");
  await migrate(db, { migrationsFolder });
  await client.end({ timeout: 5 });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runMigrations()
    .then(() => {
      console.log("Migrations applied");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed", err);
      process.exit(1);
    });
}

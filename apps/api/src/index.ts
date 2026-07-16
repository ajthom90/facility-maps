import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { bootstrapAdmin } from "./lib/bootstrap.js";
import { assertProductionSessionSecret, env } from "./lib/env.js";

async function main() {
  assertProductionSessionSecret();

  await runMigrations();
  const db = createDb();
  await seed(db);
  await bootstrapAdmin(db);

  const app = createApp();
  serve({ fetch: app.fetch, port: env.PORT }, () => {
    console.log(`API listening on ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});

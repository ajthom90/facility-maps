import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { bootstrapAdmin } from "./lib/bootstrap.js";
import { assertProductionSessionSecret, env } from "./lib/env.js";
import { APP_VERSION } from "./lib/version.js";

async function main() {
  assertProductionSessionSecret();

  console.log(`Facility Safety Maps ${APP_VERSION} starting…`);

  // Every container start / image update re-applies migrations and refreshes
  // system layer presets so catalog expansions land without manual seed.
  console.log("Applying database migrations…");
  await runMigrations();

  const db = createDb();
  console.log("Refreshing system layer presets (seed)…");
  await seed(db);

  console.log("Bootstrapping admin (if needed)…");
  await bootstrapAdmin(db);

  const app = createApp();
  serve({ fetch: app.fetch, port: env.PORT }, () => {
    console.log(`API listening on ${env.PORT} (version ${APP_VERSION})`);
  });
}

main().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});

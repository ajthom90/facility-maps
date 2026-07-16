import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();
serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API listening on ${env.PORT}`);
});

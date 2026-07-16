import { Hono } from "hono";
import { healthRoutes } from "./routes/health.js";

export function createApp() {
  const app = new Hono();
  app.route("/api/health", healthRoutes);
  // TODO: serve static web from apps/web/dist (later task)
  return app;
}

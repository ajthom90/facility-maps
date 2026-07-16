import { Hono } from "hono";
import { getDb, type Db } from "./db/client.js";
import { env } from "./lib/env.js";
import type { AdminVariables } from "./middleware/require-admin.js";
import { authRoutes } from "./routes/auth.js";
import { campusesRoutes } from "./routes/campuses.js";
import { floorsRoutes } from "./routes/floors.js";
import { healthRoutes } from "./routes/health.js";
import { presetsRoutes } from "./routes/presets.js";
import { uploadsRoutes } from "./routes/uploads.js";

export type CreateAppOptions = {
  /** Injected DB (tests). Defaults to lazy getDb() singleton per request. */
  db?: Db;
  /** Override upload root (tests). Defaults to env.UPLOAD_DIR. */
  uploadDir?: string;
};

export function createApp(options: CreateAppOptions = {}) {
  const resolveDb = (): Db => options.db ?? getDb();
  const uploadDir = options.uploadDir ?? env.UPLOAD_DIR;

  const app = new Hono<{ Variables: AdminVariables }>();
  app.route("/api/health", healthRoutes);
  app.route("/api/auth", authRoutes(resolveDb));
  app.route("/api/campuses", campusesRoutes(resolveDb));
  app.route("/api/floors", floorsRoutes(resolveDb));
  app.route("/api/presets", presetsRoutes(resolveDb));
  app.route("/api/uploads", uploadsRoutes(uploadDir));
  // TODO: serve static web from apps/web/dist (later task)
  return app;
}

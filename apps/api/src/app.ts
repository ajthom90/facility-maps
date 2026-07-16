import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getDb, type Db } from "./db/client.js";
import { env } from "./lib/env.js";
import type { AdminVariables } from "./middleware/require-admin.js";
import { adminBuildingsRoutes } from "./routes/admin/buildings.js";
import { adminCampusesRoutes } from "./routes/admin/campuses.js";
import { adminFeaturesRoutes } from "./routes/admin/features.js";
import { adminFloorsRoutes } from "./routes/admin/floors.js";
import { adminPlansRoutes } from "./routes/admin/plans.js";
import { adminPresetsRoutes } from "./routes/admin/presets.js";
import { adminUsersRoutes } from "./routes/admin/users.js";
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
  /** Override static web root (tests). Defaults to env.WEB_DIST. */
  webDist?: string;
};

export function createApp(options: CreateAppOptions = {}) {
  const resolveDb = (): Db => options.db ?? getDb();
  const uploadDir = options.uploadDir ?? env.UPLOAD_DIR;
  const webDist = options.webDist ?? env.WEB_DIST;

  const app = new Hono<{ Variables: AdminVariables }>();
  app.route("/api/health", healthRoutes);
  app.route("/api/auth", authRoutes(resolveDb));
  app.route("/api/campuses", campusesRoutes(resolveDb));
  app.route("/api/floors", floorsRoutes(resolveDb));
  app.route("/api/presets", presetsRoutes(resolveDb));
  app.route("/api/uploads", uploadsRoutes(uploadDir));
  app.route("/api/admin/campuses", adminCampusesRoutes(resolveDb));
  app.route("/api/admin/buildings", adminBuildingsRoutes(resolveDb));
  app.route("/api/admin/floors", adminFloorsRoutes(resolveDb));
  app.route("/api/admin/floors", adminPlansRoutes(resolveDb, uploadDir));
  app.route("/api/admin/features", adminFeaturesRoutes(resolveDb));
  app.route("/api/admin/users", adminUsersRoutes(resolveDb));
  app.route("/api/admin/presets", adminPresetsRoutes(resolveDb));

  // Static SPA after all API routes. WEB_DIST is relative to process cwd.
  // Match only exact `/api` or `/api/...` so paths like `/api-campus` fall through to SPA.
  const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/");
  if (webDist) {
    const root = webDist.replace(/\\/g, "/").replace(/\/+$/, "");
    app.use("*", async (c, next) => {
      if (isApiPath(c.req.path)) {
        return next();
      }
      return serveStatic({ root })(c, next);
    });
    app.get("*", async (c, next) => {
      if (isApiPath(c.req.path)) {
        return c.json({ error: "Not found" }, 404);
      }
      return serveStatic({ root, path: "index.html" })(c, next);
    });
  }

  return app;
}

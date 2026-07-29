import { Hono } from "hono";
import { APP_VERSION } from "../lib/version.js";

export const healthRoutes = new Hono();
healthRoutes.get("/", (c) =>
  c.json({
    status: "ok",
    version: APP_VERSION,
  })
);

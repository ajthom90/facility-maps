import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import { floorPlans, floors } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const ALLOWED_MIME = new Set(["image/svg+xml", "image/png", "image/jpeg"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

const MIME_BY_EXT: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function adminPlansRoutes(getDb: () => Db, uploadDir: string) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  app.post("/:id/plan", async (c) => {
    const floorId = c.req.param("id");
    const db = getDb();

    const [floor] = await db
      .select({ id: floors.id })
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);
    if (!floor) {
      return c.json({ error: "Floor not found" }, 404);
    }

    const contentLength = c.req.header("content-length");
    if (contentLength) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > env.MAX_UPLOAD_BYTES) {
        return c.json({ error: "File too large" }, 413);
      }
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.json({ error: "Invalid multipart body" }, 400);
    }

    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ error: "Missing multipart field 'file'" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > env.MAX_UPLOAD_BYTES) {
      return c.json({ error: "File too large" }, 413);
    }
    if (buffer.byteLength === 0) {
      return c.json({ error: "Empty file" }, 400);
    }

    const mimeType = resolveMimeType(file);
    if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
      return c.json(
        { error: "Unsupported file type; allowed: image/svg+xml, image/png, image/jpeg" },
        400
      );
    }

    const ext = EXT_BY_MIME[mimeType] ?? ".bin";
    const filename = `${randomUUID()}${ext}`;
    // Store relative path with forward slashes for URL serving
    const relativePath = `${floorId}/${filename}`;
    const absoluteDir = path.join(uploadDir, floorId);
    const absolutePath = path.join(absoluteDir, filename);

    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const [existing] = await db
      .select()
      .from(floorPlans)
      .where(eq(floorPlans.floorId, floorId))
      .limit(1);

    let plan;
    if (existing) {
      const oldAbs = path.join(uploadDir, ...existing.filePath.split("/"));
      if (oldAbs !== absolutePath) {
        await fs.unlink(oldAbs).catch(() => undefined);
      }
      const [updated] = await db
        .update(floorPlans)
        .set({
          filePath: relativePath,
          mimeType,
          width: null,
          height: null,
          uploadedAt: new Date(),
        })
        .where(eq(floorPlans.floorId, floorId))
        .returning();
      plan = updated;
    } else {
      const [inserted] = await db
        .insert(floorPlans)
        .values({
          floorId,
          filePath: relativePath,
          mimeType,
        })
        .returning();
      plan = inserted;
    }

    return c.json(
      {
        id: plan.id,
        floorId: plan.floorId,
        filePath: plan.filePath,
        mimeType: plan.mimeType,
        width: plan.width,
        height: plan.height,
        uploadedAt: plan.uploadedAt,
        url: planUrl(plan.filePath),
      },
      201
    );
  });

  return app;
}

function resolveMimeType(file: File): string | null {
  const type = (file.type || "").toLowerCase().trim();
  if (ALLOWED_MIME.has(type)) return type;

  // Fallback: extension when browser omits type
  const name = file.name || "";
  const ext = path.extname(name).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}

/** Public URL for a stored plan path (path segments encoded). */
export function planUrl(filePath: string): string {
  const encoded = filePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/api/uploads/${encoded}`;
}

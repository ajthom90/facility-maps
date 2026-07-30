import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import { featureMedia, features } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { planFileUrl } from "../../lib/floor-payload.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export function adminFeatureMediaRoutes(getDb: () => Db, uploadDir: string) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  app.post("/:id/media", async (c) => {
    const featureId = c.req.param("id");
    const db = getDb();

    const [feature] = await db
      .select({ id: features.id })
      .from(features)
      .where(eq(features.id, featureId))
      .limit(1);
    if (!feature) {
      return c.json({ error: "Feature not found" }, 404);
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
        {
          error:
            "Unsupported file type; allowed: image/png, image/jpeg, image/webp, video/mp4, video/webm, video/quicktime",
        },
        400,
      );
    }

    const ext = EXT_BY_MIME[mimeType] ?? ".bin";
    const filename = `${randomUUID()}${ext}`;
    // Store relative path with forward slashes for URL serving
    const relativePath = `features/${featureId}/${filename}`;
    const absoluteDir = path.join(uploadDir, "features", featureId);
    const absolutePath = path.join(absoluteDir, filename);

    // Write file first so a failed DB insert never leaves a row without a file.
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    let row;
    try {
      const [inserted] = await db
        .insert(featureMedia)
        .values({
          featureId,
          filePath: relativePath,
          mimeType,
          sizeBytes: buffer.byteLength,
        })
        .returning();
      row = inserted;
    } catch (err) {
      await fs.unlink(absolutePath).catch(() => undefined);
      throw err;
    }

    return c.json(
      {
        id: row.id,
        featureId: row.featureId,
        url: planFileUrl(row.filePath),
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
      },
      201,
    );
  });

  app.delete("/:id/media/:mediaId", async (c) => {
    const featureId = c.req.param("id");
    const mediaId = c.req.param("mediaId");
    const db = getDb();

    const [row] = await db
      .select()
      .from(featureMedia)
      .where(and(eq(featureMedia.id, mediaId), eq(featureMedia.featureId, featureId)))
      .limit(1);
    if (!row) {
      return c.json({ error: "Media not found" }, 404);
    }

    await db.delete(featureMedia).where(eq(featureMedia.id, mediaId));

    const absolutePath = path.join(uploadDir, ...row.filePath.split("/"));
    await fs.unlink(absolutePath).catch(() => undefined);

    return c.json({ ok: true, id: mediaId });
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

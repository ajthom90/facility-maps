import fs from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Resolve a request path under uploadDir; returns null if traversal or empty. */
export function resolveUploadPath(uploadDir: string, relativePath: string): string | null {
  if (!relativePath || relativePath.includes("\0")) return null;

  const root = path.resolve(uploadDir);
  const resolved = path.resolve(root, relativePath);

  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  return resolved;
}

export function uploadsRoutes(uploadDir: string) {
  const app = new Hono();

  app.get("/*", async (c) => {
    const url = new URL(c.req.url);
    // Path may be full (/api/uploads/...) or relative when mounted
    const marker = "/api/uploads/";
    let relative: string;
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) {
      relative = decodeURIComponent(url.pathname.slice(idx + marker.length));
    } else {
      // Sub-app: pathname is typically /plans/foo.png when mounted
      relative = decodeURIComponent(url.pathname.replace(/^\//, ""));
    }

    // Normalize URL-style separators; reject absolute / empty
    relative = relative.replace(/^\/+/, "");
    if (!relative) {
      return c.json({ error: "Not found" }, 404);
    }

    const absolute = resolveUploadPath(uploadDir, relative);
    if (!absolute) {
      return c.json({ error: "Not found" }, 404);
    }

    try {
      const data = await fs.readFile(absolute);
      return c.body(data, 200, {
        "Content-Type": contentTypeFor(absolute),
      });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });

  return app;
}

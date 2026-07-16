/**
 * Upload path security: traversal and malformed encoding rejected (no DB required).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { resolveUploadPath } from "../src/routes/uploads.js";

describe("upload security", () => {
  let uploadDir: string;
  let app: ReturnType<typeof createApp>;
  let safeRelative: string;

  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "fm-upload-sec-"));
    safeRelative = "plans/safe.png";
    const abs = path.join(uploadDir, safeRelative);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    app = createApp({ uploadDir });
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  it("serves files inside the upload root", async () => {
    const res = await app.request(`/api/uploads/${safeRelative}`);
    expect(res.status).toBe(200);
  });

  it("rejects path traversal on uploads (../../etc/passwd)", async () => {
    const res = await app.request("/api/uploads/../../etc/passwd");
    expect([400, 403, 404]).toContain(res.status);
  });

  it("rejects encoded path traversal (%2e%2e%2f)", async () => {
    const res = await app.request("/api/uploads/%2e%2e/%2e%2e/etc/passwd");
    expect([400, 403, 404]).toContain(res.status);
  });

  it("rejects encoded-slash traversal that stays under /api/uploads (..%2f)", async () => {
    // URL parser does not collapse ..%2f the way it collapses ../
    const res = await app.request("/api/uploads/..%2f..%2fetc%2fpasswd");
    expect([400, 403, 404]).toContain(res.status);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toMatch(/json/i);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("rejects absolute-looking segments", async () => {
    const res = await app.request("/api/uploads//etc/passwd");
    expect([400, 403, 404]).toContain(res.status);
  });

  it("rejects malformed percent-encoding", async () => {
    const res = await app.request("/api/uploads/%E0%A4%A");
    expect([400, 403, 404]).toContain(res.status);
  });

  it("resolveUploadPath returns null for traversal", () => {
    expect(resolveUploadPath(uploadDir, "../../etc/passwd")).toBeNull();
    expect(resolveUploadPath(uploadDir, "plans/../../../etc/passwd")).toBeNull();
    expect(resolveUploadPath(uploadDir, "")).toBeNull();
    expect(resolveUploadPath(uploadDir, "plans\0evil.png")).toBeNull();
  });

  it("resolveUploadPath allows nested paths under root", () => {
    const resolved = resolveUploadPath(uploadDir, safeRelative);
    expect(resolved).toBe(path.resolve(uploadDir, safeRelative));
  });
});

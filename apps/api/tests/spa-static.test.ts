/**
 * SPA static serve + fallback path matching (no DB required).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("SPA static fallback path matching", () => {
  const webDist = mkdtempSync(join(tmpdir(), "facility-maps-web-dist-"));
  writeFileSync(
    join(webDist, "index.html"),
    "<!doctype html><html><head><title>SPA</title></head><body>spa-shell</body></html>\n",
  );

  afterAll(() => {
    rmSync(webDist, { recursive: true, force: true });
  });

  it("serves SPA for /api-demo (not treated as API prefix)", async () => {
    const app = createApp({ webDist });
    const res = await app.request("/api-demo");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("spa-shell");
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).not.toMatch(/application\/json/i);
  });

  it("returns JSON 404 for unknown /api/* paths", async () => {
    const app = createApp({ webDist });
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});

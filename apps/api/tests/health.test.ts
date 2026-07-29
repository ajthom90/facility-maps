import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns status ok and version", async () => {
    vi.stubEnv("APP_VERSION", "1.2.3-test");
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      version: "1.2.3-test",
    });
  });
});

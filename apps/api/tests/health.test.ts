import { describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

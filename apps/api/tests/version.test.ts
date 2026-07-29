import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveAppVersion", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses APP_VERSION when set", async () => {
    vi.stubEnv("APP_VERSION", "  2.0.1  ");
    const { resolveAppVersion } = await import("../src/lib/version.js");
    expect(resolveAppVersion()).toBe("2.0.1");
  });

  it("falls back to 0.0.0-dev when unset", async () => {
    vi.stubEnv("APP_VERSION", "");
    const { resolveAppVersion } = await import("../src/lib/version.js");
    expect(resolveAppVersion(undefined)).toBe("0.0.0-dev");
  });
});

/**
 * Env helpers: COOKIE_SECURE parsing and weak SESSION_SECRET detection.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertProductionSessionSecret,
  isWeakSessionSecret,
  parseCookieSecureFlag,
} from "../src/lib/env.js";

describe("parseCookieSecureFlag", () => {
  it('returns true only for "true"', () => {
    expect(parseCookieSecureFlag("true")).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(parseCookieSecureFlag("false")).toBe(false);
  });

  it("defaults to false when unset or other values", () => {
    expect(parseCookieSecureFlag(undefined)).toBe(false);
    expect(parseCookieSecureFlag("")).toBe(false);
    expect(parseCookieSecureFlag("1")).toBe(false);
    expect(parseCookieSecureFlag("yes")).toBe(false);
    expect(parseCookieSecureFlag("TRUE")).toBe(false);
  });
});

describe("isWeakSessionSecret", () => {
  it("flags empty, short, and known defaults", () => {
    expect(isWeakSessionSecret("")).toBe(true);
    expect(isWeakSessionSecret("   ")).toBe(true);
    expect(isWeakSessionSecret("short")).toBe(true);
    expect(isWeakSessionSecret("123456789012345")).toBe(true); // 15 chars
    expect(isWeakSessionSecret("change-me-in-production")).toBe(true);
    expect(isWeakSessionSecret("dev-only-change-me")).toBe(true);
    expect(isWeakSessionSecret("generate-a-long-random-string")).toBe(true);
  });

  it("accepts a long non-default secret", () => {
    expect(isWeakSessionSecret("a-sufficiently-long-secret")).toBe(false);
    expect(isWeakSessionSecret("1234567890123456")).toBe(false); // 16 chars
  });
});

describe("assertProductionSessionSecret", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a no-op outside production", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    assertProductionSessionSecret("dev-only-change-me", "development");
    assertProductionSessionSecret("dev-only-change-me", undefined);
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits in production with a weak secret", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    assertProductionSessionSecret("change-me-in-production", "production");
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalled();
  });

  it("does not exit in production with a strong secret", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    assertProductionSessionSecret("a-sufficiently-long-secret", "production");
    expect(exit).not.toHaveBeenCalled();
  });
});

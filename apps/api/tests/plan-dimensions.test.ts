import { describe, expect, it } from "vitest";
import { readPlanDimensions } from "../src/lib/plan-dimensions.js";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("readPlanDimensions", () => {
  it("reads SVG viewBox", () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="792pt" height="612pt" viewBox="0 0 792 612"></svg>`,
    );
    expect(readPlanDimensions(svg, "image/svg+xml")).toEqual({
      width: 792,
      height: 612,
    });
  });

  it("falls back to SVG width/height attributes", () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400px" height="300px"></svg>`,
    );
    expect(readPlanDimensions(svg, "image/svg+xml")).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("reads a 1×1 PNG IHDR", () => {
    expect(readPlanDimensions(TINY_PNG, "image/png")).toEqual({
      width: 1,
      height: 1,
    });
  });

  it("returns null for unknown types", () => {
    expect(readPlanDimensions(Buffer.from("nope"), "application/pdf")).toBeNull();
  });
});

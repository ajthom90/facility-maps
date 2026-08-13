import { describe, it, expect } from "vitest";
import { parseGeometry } from "../src/lib/geometry.js";

describe("parseGeometry", () => {
  it("accepts a normalized point", () => {
    expect(parseGeometry({ type: "point", x: 0.5, y: 0.25 })).toEqual({
      type: "point",
      x: 0.5,
      y: 0.25,
    });
  });

  it("rejects out-of-range point", () => {
    expect(() => parseGeometry({ type: "point", x: 1.2, y: 0.5 })).toThrow();
  });

  it("accepts a polygon with >= 3 points", () => {
    const g = parseGeometry({
      type: "polygon",
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    });
    expect(g.type).toBe("polygon");
  });

  it("accepts a circle with radius in range", () => {
    expect(parseGeometry({ type: "circle", x: 0.4, y: 0.5, r: 0.08 })).toEqual({
      type: "circle",
      x: 0.4,
      y: 0.5,
      r: 0.08,
    });
  });

  it("rejects a circle with too-small radius", () => {
    expect(() => parseGeometry({ type: "circle", x: 0.4, y: 0.5, r: 0.001 })).toThrow();
  });

  it("rejects polygon with fewer than 3 points", () => {
    expect(() =>
      parseGeometry({
        type: "polygon",
        points: [
          [0, 0],
          [1, 0],
        ],
      })
    ).toThrow();
  });
});

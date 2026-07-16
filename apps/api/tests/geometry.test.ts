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

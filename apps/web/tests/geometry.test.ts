import { describe, expect, it } from "vitest";
import { rectanglePoints } from "../src/lib/geometry";

describe("rectanglePoints", () => {
  it("returns 4 corners TL, TR, BR, BL for top-left then bottom-right", () => {
    const result = rectanglePoints([0.1, 0.2], [0.5, 0.6]);
    expect(result).toEqual([
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ]);
  });

  it("normalizes corner order so opposite clicks yield the same points", () => {
    const expected = [
      [0.1, 0.2],
      [0.5, 0.2],
      [0.5, 0.6],
      [0.1, 0.6],
    ];
    // bottom-right then top-left
    expect(rectanglePoints([0.5, 0.6], [0.1, 0.2])).toEqual(expected);
    // top-right then bottom-left
    expect(rectanglePoints([0.5, 0.2], [0.1, 0.6])).toEqual(expected);
    // bottom-left then top-right
    expect(rectanglePoints([0.1, 0.6], [0.5, 0.2])).toEqual(expected);
  });

  it("returns null for degenerate (zero-width/height or same-point) rectangles", () => {
    // same point
    expect(rectanglePoints([0.3, 0.3], [0.3, 0.3])).toBeNull();
    // zero width (|ax - bx| < 0.005)
    expect(rectanglePoints([0.1, 0.2], [0.104, 0.6])).toBeNull();
    // zero height (|ay - by| < 0.005)
    expect(rectanglePoints([0.1, 0.2], [0.5, 0.204])).toBeNull();
    // just at the threshold still null
    expect(rectanglePoints([0.0, 0.0], [0.0049, 0.5])).toBeNull();
    expect(rectanglePoints([0.0, 0.0], [0.5, 0.0049])).toBeNull();
  });
});

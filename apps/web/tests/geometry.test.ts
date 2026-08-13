import { describe, expect, it } from "vitest";
import { containPlanBox, rectanglePoints } from "../src/lib/geometry";

describe("containPlanBox", () => {
  it("fits a landscape plan inside a wider viewport by height", () => {
    // 792×612 plan in a 1200×640 viewport: height-limited
    const box = containPlanBox(1200, 640, 792, 612);
    expect(box.height).toBeCloseTo(640);
    expect(box.width).toBeCloseTo((792 / 612) * 640);
    expect(box.width).toBeLessThan(1200);
  });

  it("fits a landscape plan inside a tall viewport by width", () => {
    const box = containPlanBox(800, 900, 792, 612);
    expect(box.width).toBeCloseTo(800);
    expect(box.height).toBeCloseTo((612 / 792) * 800);
  });

  it("returns 0×0 when layout or plan size is unknown", () => {
    expect(containPlanBox(0, 640, 792, 612)).toEqual({ width: 0, height: 0 });
    expect(containPlanBox(800, 600, 0, 612)).toEqual({ width: 0, height: 0 });
  });
});

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

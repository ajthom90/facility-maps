import { describe, expect, it } from "vitest";
import {
  screenSpaceMarkerTransform,
  screenSpacePlanUnits,
  screenSpaceScale,
} from "../src/lib/screenSpace";

describe("screenSpaceScale", () => {
  it("returns the inverse of the view scale so chrome stays constant on screen", () => {
    expect(screenSpaceScale(1)).toBe(1);
    expect(screenSpaceScale(2)).toBe(0.5);
    expect(screenSpaceScale(4)).toBe(0.25);
  });

  it("treats non-positive scale as 1", () => {
    expect(screenSpaceScale(0)).toBe(1);
    expect(screenSpaceScale(-2)).toBe(1);
  });
});

describe("screenSpaceMarkerTransform", () => {
  it("centers the marker and counters the view zoom", () => {
    expect(screenSpaceMarkerTransform(2)).toBe("translate(-50%, -50%) scale(0.5)");
  });
});

describe("screenSpacePlanUnits", () => {
  it("shrinks viewBox units as zoom grows so strokes stay the same screen size", () => {
    expect(screenSpacePlanUnits(0.008, 2)).toBeCloseTo(0.004);
    expect(screenSpacePlanUnits(0.012, 4)).toBeCloseTo(0.003);
  });
});

import { describe, expect, it } from "vitest";
import {
  HIERARCHY_MODES,
  isHierarchyMode,
  parseHierarchyMode,
  SINGLE_MAP_FLOOR_SLUG,
} from "../src/lib/hierarchy-mode.js";

describe("hierarchy-mode", () => {
  it("lists three modes", () => {
    expect(HIERARCHY_MODES).toEqual(["full", "no_buildings", "single_map"]);
  });

  it("validates modes", () => {
    expect(isHierarchyMode("full")).toBe(true);
    expect(isHierarchyMode("no_buildings")).toBe(true);
    expect(isHierarchyMode("single_map")).toBe(true);
    expect(isHierarchyMode("other")).toBe(false);
  });

  it("parses with fallback", () => {
    expect(parseHierarchyMode("no_buildings")).toBe("no_buildings");
    expect(parseHierarchyMode(undefined)).toBe("full");
    expect(parseHierarchyMode("nope")).toBe("full");
  });

  it("uses stable single-map floor slug", () => {
    expect(SINGLE_MAP_FLOOR_SLUG).toBe("map");
  });
});

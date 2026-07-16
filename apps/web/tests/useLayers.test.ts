import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLayers } from "../src/hooks/useLayers";
import type { LayerPreset } from "../src/types";

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
const FEATURE_TYPES = [
  "exit",
  "fire_extinguisher",
  "co_detector",
  "hazard",
  "chemical_storage",
  "first_aid",
  "water_shutoff",
  "gas_shutoff",
  "electrical_panel",
  "roof_access",
  "safe_haven",
  "high_pressure",
  "flammable_storage",
] as const;

const presets: LayerPreset[] = [
  {
    id: "1",
    slug: "all",
    featureTypes: [...FEATURE_TYPES],
    sortOrder: 0,
  },
  {
    id: "2",
    slug: "evacuation",
    featureTypes: ["exit", "first_aid", "safe_haven"],
    sortOrder: 1,
  },
  {
    id: "3",
    slug: "fire_response",
    featureTypes: [
      "exit",
      "fire_extinguisher",
      "electrical_panel",
      "gas_shutoff",
      "flammable_storage",
      "hazard",
    ],
    sortOrder: 2,
  },
];

describe("useLayers", () => {
  it("applies evacuation preset types", () => {
    const { result } = renderHook(() => useLayers(presets, FEATURE_TYPES));
    act(() => result.current.applyPreset("evacuation"));
    expect([...result.current.activeTypes].sort()).toEqual(
      ["exit", "first_aid", "safe_haven"].sort(),
    );
    expect(result.current.activePresetSlug).toBe("evacuation");
  });

  it("defaults to all types via all preset", () => {
    const { result } = renderHook(() => useLayers(presets, FEATURE_TYPES));
    expect(result.current.activePresetSlug).toBe("all");
    expect(result.current.activeTypes.size).toBe(FEATURE_TYPES.length);
  });

  it("toggles a type off and clears matching preset", () => {
    const { result } = renderHook(() => useLayers(presets, FEATURE_TYPES));
    act(() => result.current.applyPreset("evacuation"));
    act(() => result.current.toggleType("exit"));
    expect(result.current.activeTypes.has("exit")).toBe(false);
    expect(result.current.activeTypes.has("first_aid")).toBe(true);
    expect(result.current.activePresetSlug).toBeNull();
  });

  it("toggles a type on when inactive", () => {
    const { result } = renderHook(() => useLayers(presets, FEATURE_TYPES));
    act(() => result.current.applyPreset("evacuation"));
    act(() => result.current.toggleType("hazard"));
    expect(result.current.activeTypes.has("hazard")).toBe(true);
    expect(result.current.activePresetSlug).toBeNull();
  });
});

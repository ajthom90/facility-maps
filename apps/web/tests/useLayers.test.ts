import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLayers } from "../src/hooks/useLayers";
import type { LayerPreset } from "../src/types";

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
const FEATURE_TYPES = [
  "exit",
  "assembly_point",
  "safe_haven",
  "fire_extinguisher",
  "fire_alarm_pull",
  "aed",
  "first_aid",
  "eye_wash",
  "safety_shower",
  "spill_kit",
  "emergency_phone",
  "water_shutoff",
  "gas_shutoff",
  "electrical_panel",
  "loto_isolation",
  "roof_access",
  "hvac",
  "hazard",
  "chemical_storage",
  "flammable_storage",
  "high_pressure",
  "co_detector",
  "smoke_detector",
  "confined_space",
  "sds_station",
  "room_label",
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
    featureTypes: [
      "exit",
      "assembly_point",
      "safe_haven",
      "emergency_phone",
      "first_aid",
      "aed",
    ],
    sortOrder: 1,
  },
  {
    id: "3",
    slug: "fire_response",
    featureTypes: [
      "exit",
      "fire_extinguisher",
      "fire_alarm_pull",
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
      [
        "exit",
        "assembly_point",
        "safe_haven",
        "emergency_phone",
        "first_aid",
        "aed",
      ].sort(),
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

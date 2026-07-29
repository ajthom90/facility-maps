/** Per-campus navigation / map attachment mode. */
export const HIERARCHY_MODES = ["full", "no_buildings", "single_map"] as const;

export type HierarchyMode = (typeof HIERARCHY_MODES)[number];

export const DEFAULT_HIERARCHY_MODE: HierarchyMode = "full";

/** Auto-created floor slug for single_map campuses. */
export const SINGLE_MAP_FLOOR_SLUG = "map";

export function isHierarchyMode(value: unknown): value is HierarchyMode {
  return (
    typeof value === "string" &&
    (HIERARCHY_MODES as readonly string[]).includes(value)
  );
}

export function parseHierarchyMode(
  value: unknown,
  fallback: HierarchyMode = DEFAULT_HIERARCHY_MODE,
): HierarchyMode {
  return isHierarchyMode(value) ? value : fallback;
}

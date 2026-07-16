/** Stable colors for feature types (public map + legend). */
export const FEATURE_TYPE_COLORS: Record<string, string> = {
  exit: "#16a34a",
  fire_extinguisher: "#dc2626",
  co_detector: "#ca8a04",
  hazard: "#ea580c",
  chemical_storage: "#9333ea",
  first_aid: "#e11d48",
  water_shutoff: "#0284c7",
  gas_shutoff: "#b45309",
  electrical_panel: "#eab308",
  roof_access: "#0d9488",
  safe_haven: "#2563eb",
  high_pressure: "#c026d3",
  flammable_storage: "#f97316",
};

export function colorForType(type: string): string {
  return FEATURE_TYPE_COLORS[type] ?? "#64748b";
}

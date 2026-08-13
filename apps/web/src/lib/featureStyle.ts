/** Stable colors for feature types (public map + legend). */
export const FEATURE_TYPE_COLORS: Record<string, string> = {
  exit: "#16a34a",
  assembly_point: "#15803d",
  safe_haven: "#2563eb",
  fire_extinguisher: "#dc2626",
  fire_alarm_pull: "#b91c1c",
  aed: "#be123c",
  first_aid: "#e11d48",
  eye_wash: "#0891b2",
  safety_shower: "#0e7490",
  spill_kit: "#7c3aed",
  emergency_phone: "#4f46e5",
  water_shutoff: "#0284c7",
  gas_shutoff: "#b45309",
  electrical_panel: "#eab308",
  loto_isolation: "#a16207",
  roof_access: "#0d9488",
  hvac: "#075985",
  hazard: "#ea580c",
  chemical_storage: "#9333ea",
  flammable_storage: "#f97316",
  high_pressure: "#c026d3",
  co_detector: "#ca8a04",
  smoke_detector: "#57534e",
  confined_space: "#9a3412",
  sds_station: "#6d28d9",
  room_label: "#64748b",
};

export function colorForType(type: string): string {
  return FEATURE_TYPE_COLORS[type] ?? "#64748b";
}

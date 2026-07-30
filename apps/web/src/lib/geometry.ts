import type { FeatureGeometry, MapFeature, PointGeometry, PolygonGeometry } from "../types";

export function isPointGeometry(g: unknown): g is PointGeometry {
  return (
    typeof g === "object" &&
    g !== null &&
    (g as PointGeometry).type === "point" &&
    typeof (g as PointGeometry).x === "number" &&
    typeof (g as PointGeometry).y === "number"
  );
}

export function isPolygonGeometry(g: unknown): g is PolygonGeometry {
  return (
    typeof g === "object" &&
    g !== null &&
    (g as PolygonGeometry).type === "polygon" &&
    Array.isArray((g as PolygonGeometry).points)
  );
}

export function asFeatureGeometry(g: unknown): FeatureGeometry | null {
  if (isPointGeometry(g)) return g;
  if (isPolygonGeometry(g)) return g;
  return null;
}

export function featureIsVisible(feature: MapFeature, visibleTypes: Set<string>): boolean {
  return visibleTypes.has(feature.type);
}

/** Axis-aligned rectangle from two opposite corners (normalized 0–1). Returns null if degenerate. */
export function rectanglePoints(
  a: [number, number],
  b: [number, number],
): [number, number][] | null {
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  if (maxX - minX < 0.005 || maxY - minY < 0.005) return null;
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
}

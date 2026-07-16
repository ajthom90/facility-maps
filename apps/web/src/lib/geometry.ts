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

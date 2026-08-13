import type {
  CircleGeometry,
  FeatureGeometry,
  MapFeature,
  PointGeometry,
  PolygonGeometry,
} from "../types";

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

export function isCircleGeometry(g: unknown): g is CircleGeometry {
  return (
    typeof g === "object" &&
    g !== null &&
    (g as CircleGeometry).type === "circle" &&
    typeof (g as CircleGeometry).x === "number" &&
    typeof (g as CircleGeometry).y === "number" &&
    typeof (g as CircleGeometry).r === "number"
  );
}

export function asFeatureGeometry(g: unknown): FeatureGeometry | null {
  if (isPointGeometry(g)) return g;
  if (isPolygonGeometry(g)) return g;
  if (isCircleGeometry(g)) return g;
  return null;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function translatePolygon(
  points: [number, number][],
  dx: number,
  dy: number,
): [number, number][] {
  return points.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)]);
}

/**
 * Visual-circle radii in viewBox 0–1 space. `r` is a fraction of plan width.
 * `aspect` is planWidth / planHeight.
 */
export function circleRadii(r: number, aspect: number): { rx: number; ry: number } {
  const a = aspect > 0 ? aspect : 1;
  return { rx: r, ry: r * a };
}

/** Distance from center to a point, in plan-width units (matches circle.r). */
export function radiusFromCenter(
  cx: number,
  cy: number,
  x: number,
  y: number,
  aspect: number,
): number {
  const a = aspect > 0 ? aspect : 1;
  const dist = Math.hypot(x - cx, (y - cy) / a);
  return Math.min(0.5, Math.max(0.008, dist));
}

export function featureIsVisible(feature: MapFeature, visibleTypes: Set<string>): boolean {
  return visibleTypes.has(feature.type);
}

/**
 * Largest box of plan aspect (pw × ph) that fits inside the viewport.
 * Returns 0×0 when any input is non-positive so callers can wait for layout.
 */
export function containPlanBox(
  viewportW: number,
  viewportH: number,
  planW: number,
  planH: number,
): { width: number; height: number } {
  if (viewportW <= 0 || viewportH <= 0 || planW <= 0 || planH <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(viewportW / planW, viewportH / planH);
  return { width: planW * scale, height: planH * scale };
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

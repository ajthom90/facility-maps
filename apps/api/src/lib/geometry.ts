import { z } from "zod";

const unit = z.number().min(0).max(1);

export const pointGeometrySchema = z.object({
  type: z.literal("point"),
  x: unit,
  y: unit,
});

export const polygonGeometrySchema = z.object({
  type: z.literal("polygon"),
  points: z.array(z.tuple([unit, unit])).min(3),
});

/** r is radius as a fraction of plan width (same units as x). */
export const circleGeometrySchema = z.object({
  type: z.literal("circle"),
  x: unit,
  y: unit,
  r: z.number().min(0.005).max(0.5),
});

export const featureGeometrySchema = z.discriminatedUnion("type", [
  pointGeometrySchema,
  polygonGeometrySchema,
  circleGeometrySchema,
]);

export type PointGeometry = z.infer<typeof pointGeometrySchema>;
export type PolygonGeometry = z.infer<typeof polygonGeometrySchema>;
export type CircleGeometry = z.infer<typeof circleGeometrySchema>;
export type FeatureGeometry = z.infer<typeof featureGeometrySchema>;

export function parseGeometry(input: unknown): FeatureGeometry {
  return featureGeometrySchema.parse(input);
}

export function isValidNormalized(n: number): boolean {
  return n >= 0 && n <= 1;
}

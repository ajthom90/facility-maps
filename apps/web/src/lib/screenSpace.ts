/** Inverse of the canvas zoom so pins/handles/labels stay a constant screen size. */
export function screenSpaceScale(viewScale: number): number {
  return viewScale > 0 ? 1 / viewScale : 1;
}

/** CSS transform that parks a marker on a plan point without growing as the plan zooms. */
export function screenSpaceMarkerTransform(viewScale: number): string {
  return `translate(-50%, -50%) scale(${screenSpaceScale(viewScale)})`;
}

/** Shrink viewBox 0–1 units (stroke, draft vertex radius) so they stay the same on screen. */
export function screenSpacePlanUnits(planUnits: number, viewScale: number): number {
  return planUnits * screenSpaceScale(viewScale);
}

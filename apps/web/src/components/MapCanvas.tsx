import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { FeatureGeometry, MapFeature } from "../types";
import {
  asFeatureGeometry,
  circleRadii,
  clamp01,
  containPlanBox,
  isCircleGeometry,
  isPointGeometry,
  isPolygonGeometry,
  radiusFromCenter,
  translatePolygon,
} from "../lib/geometry";
import { colorForType } from "../lib/featureStyle";
import { screenSpaceMarkerTransform, screenSpacePlanUnits } from "../lib/screenSpace";

export type MapCanvasProps = {
  planUrl: string | null;
  mimeType: string | null;
  /** Plan pixel width when known; used for aspect-ratio of the plan box. */
  planWidth?: number | null;
  /** Plan pixel height when known; used for aspect-ratio of the plan box. */
  planHeight?: number | null;
  features: MapFeature[];
  visibleTypes: Set<string>;
  onSelectFeature: (feature: MapFeature | null) => void;
  selectedFeatureId?: string | null;
  /**
   * Called when the user clicks the plan (not a pan, not a feature marker).
   * Coordinates are normalized 0–1 relative to the plan box (origin top-left).
   */
  onPlanClick?: (coords: { x: number; y: number }) => void;
  /** Optional in-progress polygon vertices (normalized) for editor draft overlay. */
  draftPolygonPoints?: [number, number][];
  /** Optional in-progress circle for the circle tool. */
  draftCircle?: { x: number; y: number; r: number } | null;
  /** Override viewport cursor (e.g. crosshair for pin/polygon tools). */
  cursor?: string;
  /** When true, selected features can be dragged and reshaped. */
  editable?: boolean;
  onGeometryChange?: (featureId: string, geometry: FeatureGeometry) => void;
  onGeometryCommit?: (featureId: string, geometry: FeatureGeometry) => void;
};

type ViewState = {
  scale: number;
  x: number;
  y: number;
};

type PointerSample = {
  id: number;
  x: number;
  y: number;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

function distanceBetween(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PointerSample, b: PointerSample): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function MapCanvas({
  planUrl,
  mimeType: _mimeType,
  planWidth = null,
  planHeight = null,
  features,
  visibleTypes,
  onSelectFeature,
  selectedFeatureId = null,
  onPlanClick,
  draftPolygonPoints,
  draftCircle = null,
  cursor = "grab",
  editable = false,
  onGeometryChange,
  onGeometryCommit,
}: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planBoxRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const onPlanClickRef = useRef(onPlanClick);
  onPlanClickRef.current = onPlanClick;
  const onGeometryChangeRef = useRef(onGeometryChange);
  onGeometryChangeRef.current = onGeometryChange;
  const onGeometryCommitRef = useRef(onGeometryCommit);
  onGeometryCommitRef.current = onGeometryCommit;
  type GeomDrag =
    | {
        kind: "point" | "polygon" | "circle" | "radius";
        featureId: string;
        pointerId: number;
        startX: number;
        startY: number;
        origin: FeatureGeometry;
      }
    | {
        kind: "vertex";
        featureId: string;
        pointerId: number;
        startX: number;
        startY: number;
        origin: FeatureGeometry;
        vertexIndex: number;
      };
  const geomDragRef = useRef<GeomDrag | null>(null);

  /** Active pointers by id — multi-pointer tracking for pan vs pinch. */
  const pointersRef = useRef<Map<number, PointerSample>>(new Map());
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    midX: number;
    midY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  useEffect(() => {
    setIntrinsic(null);
  }, [planUrl]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewportSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolvedPlanW =
    planWidth != null && planWidth > 0 ? planWidth : (intrinsic?.w ?? 4);
  const resolvedPlanH =
    planHeight != null && planHeight > 0 ? planHeight : (intrinsic?.h ?? 3);
  const planBox = containPlanBox(
    viewportSize.w,
    viewportSize.h,
    resolvedPlanW,
    resolvedPlanH,
  );
  const planAspect = resolvedPlanW / resolvedPlanH;

  const clientToPlan = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const box = planBoxRef.current;
      if (!box) return null;
      const rect = box.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    [],
  );

  const applyGeomDrag = useCallback(
    (clientX: number, clientY: number): FeatureGeometry | null => {
      const drag = geomDragRef.current;
      if (!drag) return null;
      const now = clientToPlan(clientX, clientY);
      if (!now) return null;
      const orig = drag.origin;
      let next: FeatureGeometry | null = null;

      if (drag.kind === "point" && orig.type === "point") {
        next = { type: "point", x: clamp01(now.x), y: clamp01(now.y) };
      } else if (drag.kind === "polygon" && orig.type === "polygon") {
        next = {
          type: "polygon",
          points: translatePolygon(orig.points, now.x - drag.startX, now.y - drag.startY),
        };
      } else if (drag.kind === "vertex" && orig.type === "polygon") {
        const points = orig.points.map((pt, i) =>
          i === drag.vertexIndex ? ([clamp01(now.x), clamp01(now.y)] as [number, number]) : pt,
        );
        next = { type: "polygon", points };
      } else if (drag.kind === "circle" && orig.type === "circle") {
        next = {
          type: "circle",
          x: clamp01(now.x),
          y: clamp01(now.y),
          r: orig.r,
        };
      } else if (drag.kind === "radius" && orig.type === "circle") {
        next = {
          type: "circle",
          x: orig.x,
          y: orig.y,
          r: radiusFromCenter(orig.x, orig.y, now.x, now.y, planAspect),
        };
      }

      if (next) onGeometryChangeRef.current?.(drag.featureId, next);
      return next;
    },
    [clientToPlan, planAspect],
  );

  const beginGeomDrag = useCallback(
    (
      ev: ReactPointerEvent,
      feature: MapFeature,
      kind: GeomDrag["kind"],
      extra?: { vertexIndex?: number },
    ) => {
      if (!editable) return;
      const geom = asFeatureGeometry(feature.geometry);
      if (!geom) return;
      ev.stopPropagation();
      ev.preventDefault();
      const start = clientToPlan(ev.clientX, ev.clientY);
      if (!start) return;
      geomDragRef.current = {
        kind,
        featureId: feature.id,
        pointerId: ev.pointerId,
        startX: start.x,
        startY: start.y,
        origin: geom,
        ...(kind === "vertex" ? { vertexIndex: extra?.vertexIndex ?? 0 } : {}),
      } as GeomDrag;
      onSelectFeature(feature);
      viewportRef.current?.setPointerCapture(ev.pointerId);
    },
    [editable, clientToPlan, onSelectFeature],
  );

  const seedPinch = useCallback((a: PointerSample, b: PointerSample) => {
    const mid = midpoint(a, b);
    const el = viewportRef.current;
    const rect = el?.getBoundingClientRect();
    const v = viewRef.current;
    pinchRef.current = {
      distance: distanceBetween(a, b),
      scale: v.scale,
      midX: rect ? mid.x - rect.left : mid.x,
      midY: rect ? mid.y - rect.top : mid.y,
      originX: v.x,
      originY: v.y,
    };
  }, []);

  const onWheel = useCallback((e: ReactWheelEvent) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 1 / 1.1;

    setView((prev) => {
      const nextScale = clampScale(prev.scale * factor);
      const ratio = nextScale / prev.scale;
      // Zoom toward cursor
      const nextX = mx - (mx - prev.x) * ratio;
      const nextY = my - (my - prev.y) * ratio;
      return { scale: nextScale, x: nextX, y: nextY };
    });
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const sample: PointerSample = { id: e.pointerId, x: e.clientX, y: e.clientY };
      pointersRef.current.set(e.pointerId, sample);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const pointers = [...pointersRef.current.values()];

      if (pointers.length >= 2) {
        // Multi-touch: cancel pan, start/continue pinch
        dragRef.current = null;
        seedPinch(pointers[0], pointers[1]);
        return;
      }

      // Single pointer: start pan
      pinchRef.current = null;
      const v = viewRef.current;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: v.x,
        originY: v.y,
        moved: false,
      };
    },
    [seedPinch],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (geomDragRef.current && geomDragRef.current.pointerId === e.pointerId) {
        applyGeomDrag(e.clientX, e.clientY);
        return;
      }
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });

      const pointers = [...pointersRef.current.values()];

      // Two or more pointers: pinch only, never pan
      if (pointers.length >= 2) {
        dragRef.current = null;
        const [a, b] = pointers;
        const d = distanceBetween(a, b);
        if (!pinchRef.current || pinchRef.current.distance <= 0) {
          seedPinch(a, b);
          return;
        }

        const ratio = d / pinchRef.current.distance;
        const nextScale = clampScale(pinchRef.current.scale * ratio);
        const scaleRatio = nextScale / pinchRef.current.scale;
        const mx = pinchRef.current.midX;
        const my = pinchRef.current.midY;
        // Zoom toward initial pinch midpoint
        const nextX = mx - (mx - pinchRef.current.originX) * scaleRatio;
        const nextY = my - (my - pinchRef.current.originY) * scaleRatio;
        setView({ scale: nextScale, x: nextX, y: nextY });
        return;
      }

      // Single pointer pan
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.moved = true;
      }
      setView((prev) => ({
        ...prev,
        x: drag.originX + dx,
        y: drag.originY + dy,
      }));
    },
    [seedPinch, applyGeomDrag],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent) => {
      const geomDrag = geomDragRef.current;
      if (geomDrag && geomDrag.pointerId === e.pointerId) {
        const next = applyGeomDrag(e.clientX, e.clientY);
        if (next) onGeometryCommitRef.current?.(geomDrag.featureId, next);
        geomDragRef.current = null;
        pointersRef.current.delete(e.pointerId);
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        return;
      }

      const hadDrag = dragRef.current;
      const wasPanPointer = hadDrag && hadDrag.pointerId === e.pointerId;
      const moved = wasPanPointer ? hadDrag.moved : true;

      pointersRef.current.delete(e.pointerId);

      const remaining = [...pointersRef.current.values()];

      if (remaining.length >= 2) {
        // Still multi-touch: re-seed pinch baseline from current view
        dragRef.current = null;
        seedPinch(remaining[0], remaining[1]);
      } else if (remaining.length === 1) {
        // Dropped out of pinch into single finger: start a fresh pan
        pinchRef.current = null;
        const p = remaining[0];
        const v = viewRef.current;
        dragRef.current = {
          pointerId: p.id,
          startX: p.x,
          startY: p.y,
          originX: v.x,
          originY: v.y,
          moved: true, // don't treat as click after pinch
        };
      } else {
        // No pointers left
        pinchRef.current = null;
        if (wasPanPointer && !moved) {
          const planClick = onPlanClickRef.current;
          const planBox = planBoxRef.current;
          if (planClick && planBox) {
            const rect = planBox.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              // Only treat as a plan click when the pointer is inside the plan box.
              // Clamping alone would map margin/letterbox clicks onto edges and create features.
              const inside =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;
              if (inside) {
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                planClick({ x, y });
              } else {
                // Outside plan box: clear selection (same as empty-canvas / select-mode behavior)
                onSelectFeature(null);
              }
            }
          } else {
            onSelectFeature(null);
          }
        }
        dragRef.current = null;
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [onSelectFeature, seedPinch, applyGeomDrag],
  );

  const visibleFeatures = [...features]
    .filter((f) => visibleTypes.has(f.type))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt));

  const selectedFeature = visibleFeatures.find((f) => f.id === selectedFeatureId) ?? null;
  const selectedGeom = selectedFeature ? asFeatureGeometry(selectedFeature.geometry) : null;
  const markerTransform = screenSpaceMarkerTransform(view.scale);
  const stroke = screenSpacePlanUnits(0.004, view.scale);
  const strokeSelected = screenSpacePlanUnits(0.008, view.scale);
  const draftStroke = screenSpacePlanUnits(0.006, view.scale);
  const draftVertexR = screenSpacePlanUnits(0.012, view.scale);
  const draftDash = `${screenSpacePlanUnits(0.02, view.scale)} ${screenSpacePlanUnits(0.01, view.scale)}`;

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label="Floor map"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 280,
        overflow: "hidden",
        background: "#e8e8ec",
        borderRadius: 8,
        border: "1px solid #e2e2e5",
        touchAction: "none",
        cursor,
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={planBoxRef}
          style={{
            position: "relative",
            width: planBox.width > 0 ? planBox.width : "100%",
            height: planBox.height > 0 ? planBox.height : "100%",
            flex: "0 0 auto",
          }}
        >
          {planUrl ? (
            <img
              src={planUrl}
              alt="Floor plan"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setIntrinsic({ w: img.naturalWidth, h: img.naturalHeight });
                }
              }}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                /* Box already matches plan aspect; fill so overlay 0–1 coords stay locked. */
                objectFit: "fill",
                pointerEvents: "none",
              }}
            />
          ) : null}

          {visibleFeatures.map((feature) => {
            const geom = asFeatureGeometry(feature.geometry);
            if (!geom) return null;
            const color = colorForType(feature.type);
            const selected = feature.id === selectedFeatureId;
            const z = 10 + (feature.sortOrder ?? 0);
            const label = feature.label;

            if (isPolygonGeometry(geom)) {
              const cx = geom.points.reduce((s, p) => s + p[0], 0) / geom.points.length;
              const cy = geom.points.reduce((s, p) => s + p[1], 0) / geom.points.length;
              return (
                <div key={feature.id} style={{ position: "absolute", inset: 0, zIndex: z, pointerEvents: "none" }}>
                  <svg
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
                  >
                    <polygon
                      points={geom.points.map(([px, py]) => `${px},${py}`).join(" ")}
                      fill={color}
                      fillOpacity={selected ? 0.4 : 0.22}
                      stroke={color}
                      strokeWidth={selected ? strokeSelected : stroke}
                      style={{ pointerEvents: "auto", cursor: editable ? "move" : "pointer" }}
                      onPointerDown={(ev) => {
                        if (editable) beginGeomDrag(ev, feature, "polygon");
                        else ev.stopPropagation();
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectFeature(feature);
                      }}
                    />
                  </svg>
                  {label ? (
                    <div
                      style={{
                        position: "absolute",
                        left: `${cx * 100}%`,
                        top: `${cy * 100}%`,
                        transform: markerTransform,
                        pointerEvents: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f172a",
                        textShadow: "0 0 4px #fff, 0 0 4px #fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </div>
                  ) : null}
                </div>
              );
            }

            if (isCircleGeometry(geom)) {
              const { rx, ry } = circleRadii(geom.r, planAspect);
              return (
                <div key={feature.id} style={{ position: "absolute", inset: 0, zIndex: z, pointerEvents: "none" }}>
                  <svg
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
                  >
                    <ellipse
                      cx={geom.x}
                      cy={geom.y}
                      rx={rx}
                      ry={ry}
                      fill={color}
                      fillOpacity={selected ? 0.4 : 0.22}
                      stroke={color}
                      strokeWidth={selected ? strokeSelected : stroke}
                      style={{ pointerEvents: "auto", cursor: editable ? "move" : "pointer" }}
                      onPointerDown={(ev) => {
                        if (editable) beginGeomDrag(ev, feature, "circle");
                        else ev.stopPropagation();
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectFeature(feature);
                      }}
                    />
                  </svg>
                  {label ? (
                    <div
                      style={{
                        position: "absolute",
                        left: `${geom.x * 100}%`,
                        top: `${geom.y * 100}%`,
                        transform: markerTransform,
                        pointerEvents: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f172a",
                        textShadow: "0 0 4px #fff, 0 0 4px #fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </div>
                  ) : null}
                </div>
              );
            }

            if (isPointGeometry(geom)) {
              return (
                <button
                  key={feature.id}
                  type="button"
                  aria-label={label || feature.type}
                  onPointerDown={(ev) => {
                    if (editable) beginGeomDrag(ev, feature, "point");
                    else ev.stopPropagation();
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectFeature(feature);
                  }}
                  style={{
                    position: "absolute",
                    left: `${geom.x * 100}%`,
                    top: `${geom.y * 100}%`,
                    transform: markerTransform,
                    width: selected ? 22 : 18,
                    height: selected ? 22 : 18,
                    borderRadius: "50%",
                    border: selected ? "3px solid #111" : "2px solid #fff",
                    background: color,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                    padding: 0,
                    cursor: editable ? "grab" : "pointer",
                    zIndex: z,
                  }}
                />
              );
            }
            return null;
          })}

          {editable && selectedFeature && selectedGeom && isPolygonGeometry(selectedGeom)
            ? selectedGeom.points.map(([px, py], i) => (
                <button
                  key={`v-${selectedFeature.id}-${i}`}
                  type="button"
                  aria-label={`Vertex ${i + 1}`}
                  onPointerDown={(ev) => beginGeomDrag(ev, selectedFeature, "vertex", { vertexIndex: i })}
                  style={{
                    position: "absolute",
                    left: `${px * 100}%`,
                    top: `${py * 100}%`,
                    transform: markerTransform,
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    border: "2px solid #111",
                    background: "#fff",
                    padding: 0,
                    cursor: "nwse-resize",
                    zIndex: 10000,
                  }}
                />
              ))
            : null}

          {editable && selectedFeature && selectedGeom && isCircleGeometry(selectedGeom) ? (
            <button
              type="button"
              aria-label="Resize circle"
              onPointerDown={(ev) => beginGeomDrag(ev, selectedFeature, "radius")}
              style={{
                position: "absolute",
                left: `${(selectedGeom.x + selectedGeom.r) * 100}%`,
                top: `${selectedGeom.y * 100}%`,
                transform: markerTransform,
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "2px solid #111",
                background: "#fff",
                padding: 0,
                cursor: "ew-resize",
                zIndex: 10000,
              }}
            />
          ) : null}

          {draftPolygonPoints && draftPolygonPoints.length > 0 ? (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                overflow: "visible",
                zIndex: 9999,
              }}
            >
              {draftPolygonPoints.length >= 2 ? (
                <polyline
                  points={draftPolygonPoints.map(([px, py]) => `${px},${py}`).join(" ")}
                  fill="none"
                  stroke="#111"
                  strokeWidth={draftStroke}
                  strokeDasharray={draftDash}
                />
              ) : null}
              {draftPolygonPoints.map(([px, py], i) => (
                <circle
                  key={`draft-${i}`}
                  cx={px}
                  cy={py}
                  r={draftVertexR}
                  fill="#111"
                  stroke="#fff"
                  strokeWidth={stroke}
                />
              ))}
            </svg>
          ) : null}

          {draftCircle ? (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                overflow: "visible",
                zIndex: 9999,
              }}
            >
              <ellipse
                cx={draftCircle.x}
                cy={draftCircle.y}
                rx={circleRadii(draftCircle.r, planAspect).rx}
                ry={circleRadii(draftCircle.r, planAspect).ry}
                fill="none"
                stroke="#111"
                strokeWidth={draftStroke}
                strokeDasharray={draftDash}
              />
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { MapFeature } from "../types";
import { asFeatureGeometry, isPointGeometry, isPolygonGeometry } from "../lib/geometry";
import { colorForType } from "../lib/featureStyle";

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
}: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

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

  const aspectRatio =
    planWidth != null && planHeight != null && planWidth > 0 && planHeight > 0
      ? `${planWidth} / ${planHeight}`
      : "4 / 3";

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
    [seedPinch],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent) => {
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
          onSelectFeature(null);
        }
        dragRef.current = null;
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [onSelectFeature, seedPinch],
  );

  const visibleFeatures = features.filter((f) => visibleTypes.has(f.type));

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
        cursor: "grab",
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
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio,
          }}
        >
          {planUrl ? (
            <img
              src={planUrl}
              alt="Floor plan"
              draggable={false}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                /* Stretch to the plan box so 0–1 overlay coords match the image. */
                objectFit: "fill",
                pointerEvents: "none",
              }}
            />
          ) : null}

          {/* Polygon overlay — normalized viewBox 0 0 1 1 */}
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
            }}
          >
            {visibleFeatures.map((feature) => {
              const geom = asFeatureGeometry(feature.geometry);
              if (!geom || !isPolygonGeometry(geom)) return null;
              const points = geom.points.map(([px, py]) => `${px},${py}`).join(" ");
              const color = colorForType(feature.type);
              const selected = feature.id === selectedFeatureId;
              return (
                <polygon
                  key={feature.id}
                  points={points}
                  fill={color}
                  fillOpacity={selected ? 0.45 : 0.28}
                  stroke={color}
                  strokeWidth={selected ? 0.008 : 0.004}
                  style={{ pointerEvents: "auto", cursor: "pointer" }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectFeature(feature);
                  }}
                />
              );
            })}
          </svg>

          {/* Point markers — percent positioning, origin top-left */}
          {visibleFeatures.map((feature) => {
            const geom = asFeatureGeometry(feature.geometry);
            if (!geom || !isPointGeometry(geom)) return null;
            const color = colorForType(feature.type);
            const selected = feature.id === selectedFeatureId;
            return (
              <button
                key={feature.id}
                type="button"
                aria-label={feature.label || feature.type}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectFeature(feature);
                }}
                style={{
                  position: "absolute",
                  left: `${geom.x * 100}%`,
                  top: `${geom.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: selected ? 22 : 18,
                  height: selected ? 22 : 18,
                  borderRadius: "50%",
                  border: selected ? "3px solid #111" : "2px solid #fff",
                  background: color,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                  padding: 0,
                  cursor: "pointer",
                  zIndex: selected ? 2 : 1,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { MapFeature } from "../types";
import { asFeatureGeometry, isPointGeometry, isPolygonGeometry } from "../lib/geometry";
import { colorForType } from "../lib/featureStyle";

export type MapCanvasProps = {
  planUrl: string | null;
  mimeType: string | null;
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

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

export function MapCanvas({
  planUrl,
  mimeType,
  features,
  visibleTypes,
  onSelectFeature,
  selectedFeatureId = null,
}: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
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
  } | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

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
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: view.x,
        originY: view.y,
        moved: false,
      };
    },
    [view.x, view.y],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
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
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        if (!drag.moved) {
          // Click on empty canvas clears selection (feature buttons stopPropagation)
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
    [onSelectFeature],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        pinchRef.current = { distance: d, scale: view.scale };
        dragRef.current = null;
      }
    },
    [view.scale],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = d / pinchRef.current.distance;
      const nextScale = clampScale(pinchRef.current.scale * ratio);
      setView((prev) => ({ ...prev, scale: nextScale }));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pinchRef.current) {
      pinchRef.current = null;
    }
  }, []);

  const visibleFeatures = features.filter((f) => visibleTypes.has(f.type));

  const isSvg =
    mimeType === "image/svg+xml" ||
    (planUrl != null && planUrl.toLowerCase().endsWith(".svg"));

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label="Floor map"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
            aspectRatio:
              /* prefer plan-filled box; fallback square-ish landscape */
              "4 / 3",
          }}
        >
          {planUrl ? (
            isSvg ? (
              <object
                data={planUrl}
                type="image/svg+xml"
                aria-label="Floor plan"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  objectFit: "contain",
                }}
              >
                <img
                  src={planUrl}
                  alt="Floor plan"
                  draggable={false}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
              </object>
            ) : (
              <img
                src={planUrl}
                alt="Floor plan"
                draggable={false}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                }}
              />
            )
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

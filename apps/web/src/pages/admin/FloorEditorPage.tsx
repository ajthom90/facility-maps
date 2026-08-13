import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { MapCanvas } from "../../components/MapCanvas";
import { shouldHandleFeatureDeleteKey } from "../../lib/editorKeys";
import { radiusFromCenter, rectanglePoints } from "../../lib/geometry";
import type { FeatureGeometry } from "../../types";
import { mediaKind } from "../../lib/media";
import {
  FEATURE_TYPES,
  type FeatureMedia,
  type FeatureType,
  type FloorDetail,
  type MapFeature,
} from "../../types";

type Tool = "select" | "pin" | "rect" | "polygon" | "circle";

export function FloorEditorPage() {
  const { floorId = "" } = useParams<{ floorId: string }>();
  const { t } = useTranslation();

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [featureType, setFeatureType] = useState<FeatureType>("exit");
  const [selected, setSelected] = useState<MapFeature | null>(null);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editType, setEditType] = useState<string>("exit");

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Track selected id so edit fields only reset when the user picks a different feature. */
  const selectedIdRef = useRef<string | null>(null);
  /** Always-current draft vertices for double-click / Complete (avoids stale state). */
  const draftPointsRef = useRef<[number, number][]>([]);

  const allTypes = useMemo(() => new Set<string>(FEATURE_TYPES), []);

  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const setDraftPointsSynced = useCallback((points: [number, number][]) => {
    draftPointsRef.current = points;
    setDraftPoints(points);
  }, []);

  const loadFloor = useCallback(async () => {
    const data = await api.getFloorById(floorId);
    setFloor(data);
    return data;
  }, [floorId]);

  useEffect(() => {
    let cancelled = false;
    setFloor(null);
    setSelected(null);
    selectedIdRef.current = null;
    setDraftPointsSynced([]);
    setError(null);
    loadFloor().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadFloor, t, setDraftPointsSynced]);

  // Only reset edit fields when the selected *feature id* changes — not when the
  // same feature object identity updates after autosave (which would clobber in-progress notes/label).
  useEffect(() => {
    const nextId = selected?.id ?? null;
    if (nextId === selectedIdRef.current) return;
    selectedIdRef.current = nextId;
    if (selected) {
      setEditLabel(selected.label ?? "");
      setEditNotes(selected.notes ?? "");
      setEditType(selected.type);
    } else {
      setEditLabel("");
      setEditNotes("");
      setEditType("exit");
    }
  }, [selected]);

  function replaceFeature(next: MapFeature) {
    setFloor((prev) =>
      prev
        ? {
            ...prev,
            features: prev.features.map((f) => (f.id === next.id ? next : f)),
          }
        : prev,
    );
    // Refresh selection only when this is the currently selected feature —
    // do not jump selection after concurrent saves of another feature.
    setSelected((prev) => (prev?.id === next.id ? next : prev));
  }

  function addFeature(next: MapFeature) {
    setFloor((prev) =>
      prev ? { ...prev, features: [...prev.features, next] } : prev,
    );
    setSelected(next);
  }

  function removeFeature(id: string) {
    setFloor((prev) =>
      prev
        ? { ...prev, features: prev.features.filter((f) => f.id !== id) }
        : prev,
    );
    setSelected((prev) => (prev?.id === id ? null : prev));
  }

  /** Update only media so concurrent label/notes patches are not clobbered. */
  function updateFeatureMedia(
    featureId: string,
    update: (media: FeatureMedia[]) => FeatureMedia[],
  ) {
    setFloor((prev) =>
      prev
        ? {
            ...prev,
            features: prev.features.map((f) =>
              f.id === featureId ? { ...f, media: update(f.media ?? []) } : f,
            ),
          }
        : prev,
    );
    setSelected((prev) =>
      prev?.id === featureId ? { ...prev, media: update(prev.media ?? []) } : prev,
    );
  }

  async function onUploadPlan(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !floorId) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadFloorPlan(floorId, file);
      await loadFloor();
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setUploading(false);
    }
  }

  const onPlanClick = useCallback(
    async (coords: { x: number; y: number }) => {
      if (!floorId || !floor) return;

      if (tool === "select") {
        setSelected(null);
        return;
      }

      if (tool === "pin") {
        setSaving(true);
        setError(null);
        try {
          const created = await api.createFeature({
            floorId,
            type: featureType,
            geometry: { type: "point", x: coords.x, y: coords.y },
            sortOrder: nextSortOrder(),
          });
          addFeature(created);
          flashSaved();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        } finally {
          setSaving(false);
        }
        return;
      }

      if (tool === "rect") {
        const current = draftPointsRef.current;
        if (current.length === 0) {
          setDraftPointsSynced([[coords.x, coords.y]]);
          return;
        }
        const points = rectanglePoints(current[0], [coords.x, coords.y]);
        if (!points) return;
        setSaving(true);
        setError(null);
        try {
          const created = await api.createFeature({
            floorId,
            type: featureType,
            geometry: { type: "polygon", points },
            sortOrder: nextSortOrder(),
          });
          addFeature(created);
          setDraftPointsSynced([]);
          flashSaved();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        } finally {
          setSaving(false);
        }
        return;
      }

      if (tool === "circle") {
        const current = draftPointsRef.current;
        if (current.length === 0) {
          setDraftPointsSynced([[coords.x, coords.y]]);
          return;
        }
        const [cx, cy] = current[0];
        const plan = floor.plan;
        const aspect =
          plan?.width && plan?.height && plan.width > 0 && plan.height > 0
            ? plan.width / plan.height
            : 4 / 3;
        const r = radiusFromCenter(cx, cy, coords.x, coords.y, aspect);
        setSaving(true);
        setError(null);
        try {
          const created = await api.createFeature({
            floorId,
            type: featureType,
            geometry: { type: "circle", x: cx, y: cy, r },
            sortOrder: nextSortOrder(),
          });
          addFeature(created);
          setDraftPointsSynced([]);
          flashSaved();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        } finally {
          setSaving(false);
        }
        return;
      }

      if (tool === "polygon") {
        const next: [number, number][] = [
          ...draftPointsRef.current,
          [coords.x, coords.y],
        ];
        draftPointsRef.current = next;
        setDraftPoints(next);
      }
    },
    [floor, floorId, tool, featureType, flashSaved, t, setDraftPointsSynced],
  );

  const completePolygon = useCallback(async () => {
    // Read from ref so double-click sees the latest vertices even if a click
    // just updated draftPoints and React state has not re-rendered yet.
    const points = draftPointsRef.current;
    if (!floorId || points.length < 3) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createFeature({
        floorId,
        type: featureType,
        geometry: { type: "polygon", points },
        sortOrder: nextSortOrder(),
      });
      addFeature(created);
      setDraftPointsSynced([]);
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSaving(false);
    }
  }, [floorId, featureType, flashSaved, t, setDraftPointsSynced]);

  function cancelPolygon() {
    setDraftPointsSynced([]);
  }

  function nextSortOrder(): number {
    const orders = floor?.features.map((f) => f.sortOrder ?? 0) ?? [];
    return orders.length === 0 ? 0 : Math.max(...orders) + 1;
  }

  function applyLocalGeometry(featureId: string, geometry: FeatureGeometry) {
    setFloor((prev) =>
      prev
        ? {
            ...prev,
            features: prev.features.map((f) => (f.id === featureId ? { ...f, geometry } : f)),
          }
        : prev,
    );
    setSelected((prev) => (prev?.id === featureId ? { ...prev, geometry } : prev));
  }

  async function commitGeometry(featureId: string, geometry: FeatureGeometry) {
    applyLocalGeometry(featureId, geometry);
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateFeature(featureId, { geometry });
      replaceFeature(updated);
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
      await loadFloor().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedPatch(patch: {
    label?: string | null;
    notes?: string | null;
    type?: string;
    sortOrder?: number;
  }) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateFeature(selected.id, patch);
      replaceFeature(updated);
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSaving(false);
    }
  }

  async function onLabelBlur() {
    if (!selected) return;
    const next = editLabel.trim() || null;
    if ((selected.label ?? null) === next) return;
    await saveSelectedPatch({ label: next });
  }

  async function onNotesBlur() {
    if (!selected) return;
    const next = editNotes.trim() || null;
    if ((selected.notes ?? null) === next) return;
    await saveSelectedPatch({ notes: next });
  }

  async function onTypeChange(next: string) {
    setEditType(next);
    if (!selected || selected.type === next) return;
    await saveSelectedPatch({ type: next });
  }

  async function nudgeLayer(direction: "forward" | "back" | "front" | "bottom") {
    if (!selected || !floor) return;
    const ordered = [...floor.features].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt),
    );
    const index = ordered.findIndex((f) => f.id === selected.id);
    if (index < 0) return;

    let nextOrder = selected.sortOrder ?? 0;
    if (direction === "front") {
      nextOrder = Math.max(...ordered.map((f) => f.sortOrder ?? 0)) + 1;
    } else if (direction === "bottom") {
      nextOrder = Math.min(...ordered.map((f) => f.sortOrder ?? 0)) - 1;
    } else if (direction === "forward") {
      const other = ordered[index + 1];
      if (!other) return;
      nextOrder = (other.sortOrder ?? 0) + 1;
    } else {
      const other = ordered[index - 1];
      if (!other) return;
      nextOrder = (other.sortOrder ?? 0) - 1;
    }
    await saveSelectedPatch({ sortOrder: nextOrder });
  }

  const onDeleteSelected = useCallback(
    async (opts?: { confirm?: boolean }) => {
      if (!selected) return;
      if (opts?.confirm !== false && !window.confirm(`${t("delete")}?`)) return;
      setSaving(true);
      setError(null);
      try {
        await api.deleteFeature(selected.id);
        removeFeature(selected.id);
        flashSaved();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      } finally {
        setSaving(false);
      }
    },
    [selected, t, flashSaved],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!shouldHandleFeatureDeleteKey(e)) return;
      if (tool !== "select" || !selected || saving) return;
      e.preventDefault();
      void onDeleteSelected({ confirm: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool, selected, saving, onDeleteSelected]);

  async function onUploadMedia(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    const featureId = selected.id;
    setSaving(true);
    setError(null);
    try {
      const uploaded = await api.uploadFeatureMedia(featureId, file);
      const item: FeatureMedia = {
        id: uploaded.id,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        createdAt: uploaded.createdAt,
      };
      updateFeatureMedia(featureId, (m) => [...m, item]);
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteMedia(mediaId: string) {
    if (!selected) return;
    if (!window.confirm(`${t("delete")}?`)) return;
    const featureId = selected.id;
    setSaving(true);
    setError(null);
    try {
      await api.deleteFeatureMedia(featureId, mediaId);
      updateFeatureMedia(featureId, (m) => m.filter((x) => x.id !== mediaId));
      flashSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSaving(false);
    }
  }

  function onSelectFeature(feature: MapFeature | null) {
    if (tool !== "select" && feature) {
      // Selecting existing features is always allowed to open the edit panel
      setTool("select");
    }
    setSelected(feature);
  }

  if (error && !floor) {
    return <p role="alert">{error}</p>;
  }

  if (!floor) {
    return <p>{t("loading")}</p>;
  }

  const cursor = tool === "select" ? "grab" : "crosshair";

  return (
    <section style={{ display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link to="/admin" style={{ fontSize: "0.9rem" }}>
          ← {t("structure")}
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.25rem", flex: 1 }}>{floor.name}</h1>
        {savedFlash ? (
          <span
            role="status"
            style={{
              fontSize: "0.85rem",
              color: "#15803d",
              fontWeight: 600,
              background: "#dcfce7",
              padding: "0.25rem 0.55rem",
              borderRadius: 999,
            }}
          >
            {t("saved")}
          </span>
        ) : null}
        {saving || uploading ? (
          <span style={{ fontSize: "0.85rem", color: "#666" }}>{t("loading")}</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.65rem",
          alignItems: "center",
          background: "#fff",
          border: "1px solid #e2e2e5",
          borderRadius: 8,
          padding: "0.65rem 0.75rem",
        }}
      >
        <div style={{ display: "flex", gap: 4 }} role="group" aria-label="Tools">
          {(["select", "pin", "rect", "polygon", "circle"] as Tool[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (value !== tool) setDraftPointsSynced([]);
                setTool(value);
              }}
              style={{
                ...toolButtonStyle,
                background: tool === value ? "#1d4ed8" : "#fff",
                color: tool === value ? "#fff" : "#1a1a1a",
              }}
            >
              {t(`tools.${value}`)}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
          <span>{t("featureType")}</span>
          <select
            value={featureType}
            onChange={(e) => setFeatureType(e.target.value as FeatureType)}
            style={selectStyle}
          >
            {FEATURE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`featureTypes.${type}`)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
          <span>{t("uploadPlan")}</span>
          <input
            type="file"
            accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg"
            onChange={onUploadPlan}
            disabled={uploading}
          />
        </label>

        {tool === "circle" && draftPoints.length === 1 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#555" }}>{t("circleHint")}</span>
            <button type="button" onClick={cancelPolygon} style={ghostButtonStyle}>
              {t("cancel")}
            </button>
          </div>
        ) : null}

        {tool === "rect" && draftPoints.length === 1 ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#555" }}>{t("rectHint")}</span>
            <button type="button" onClick={cancelPolygon} style={ghostButtonStyle}>
              {t("cancel")}
            </button>
          </div>
        ) : null}

        {tool === "polygon" ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#555" }}>
              {draftPoints.length} {t("vertices")}
            </span>
            <button
              type="button"
              onClick={completePolygon}
              disabled={draftPoints.length < 3 || saving}
              style={primaryButtonStyle}
            >
              {t("complete")}
            </button>
            <button type="button" onClick={cancelPolygon} style={ghostButtonStyle}>
              {t("cancel")}
            </button>
          </div>
        ) : null}
      </div>

      {!floor.plan ? (
        <p style={{ margin: 0 }}>{t("emptyPlan")}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 280px)",
            gap: "0.75rem",
            alignItems: "start",
          }}
          className="floor-editor-grid"
        >
          <div
            style={{
              position: "relative",
              height: "min(70vh, 640px)",
              minHeight: 280,
            }}
            onDoubleClick={(e) => {
              // Complete from ref (latest vertices) without relying on stale state.
              // The second click of a double-click already appended a vertex via
              // onPlanClick — drop that extra point before completing when possible.
              if (tool !== "polygon") return;
              e.preventDefault();
              const points = draftPointsRef.current;
              if (points.length < 3) return;
              // Prefer completing without the double-click vertex when we still
              // have ≥3 points after removing it.
              const forComplete =
                points.length > 3 ? points.slice(0, -1) : points;
              draftPointsRef.current = forComplete;
              setDraftPoints(forComplete);
              if (forComplete.length >= 3) {
                void completePolygon();
              }
            }}
          >
            <MapCanvas
              planUrl={floor.plan.url}
              mimeType={floor.plan.mimeType}
              planWidth={floor.plan.width}
              planHeight={floor.plan.height}
              features={floor.features}
              visibleTypes={allTypes}
              onSelectFeature={onSelectFeature}
              selectedFeatureId={selected?.id ?? null}
              onPlanClick={onPlanClick}
              draftPolygonPoints={draftPoints}
              draftCircle={
                tool === "circle" && draftPoints.length === 1
                  ? { x: draftPoints[0][0], y: draftPoints[0][1], r: 0.05 }
                  : null
              }
              cursor={cursor}
              editable
              onGeometryChange={applyLocalGeometry}
              onGeometryCommit={(id, geom) => void commitGeometry(id, geom)}
            />
          </div>

          <aside
            style={{
              background: "#fff",
              border: "1px solid #e2e2e5",
              borderRadius: 8,
              padding: "0.75rem",
              display: "grid",
              gap: "0.65rem",
              minHeight: 180,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem" }}>{t("editFeature")}</h2>
            {!selected ? (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>{t("selectFeatureHint")}</p>
            ) : (
              <>
                <label style={fieldStyle}>
                  <span>{t("label")}</span>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={() => void onLabelBlur()}
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  <span>{t("notes")}</span>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={() => void onNotesBlur()}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>
                <div style={fieldStyle}>
                  <span>{t("media")}</span>
                  {(selected.media ?? []).length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                      {t("mediaEmpty")}
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {(selected.media ?? []).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            position: "relative",
                            width: 64,
                            height: 64,
                            borderRadius: 6,
                            overflow: "hidden",
                            border: "1px solid #e2e2e5",
                            background: "#f4f4f5",
                          }}
                        >
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "block", width: "100%", height: "100%" }}
                          >
                            {mediaKind(item.mimeType) === "video" ? (
                              <video
                                src={item.url}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            ) : (
                              <img
                                src={item.url}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            )}
                          </a>
                          <button
                            type="button"
                            onClick={() => void onDeleteMedia(item.id)}
                            aria-label={t("delete")}
                            disabled={saving}
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: "none",
                              background: "rgba(0,0,0,0.55)",
                              color: "#fff",
                              fontSize: 12,
                              lineHeight: "18px",
                              padding: 0,
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
                    <span>{t("addMedia")}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                      onChange={(e) => void onUploadMedia(e)}
                      disabled={saving}
                    />
                  </label>
                </div>
                <div style={fieldStyle}>
                  <span>{t("layerOrder")}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <button type="button" onClick={() => void nudgeLayer("bottom")} style={toolButtonStyle}>
                      {t("sendToBack")}
                    </button>
                    <button type="button" onClick={() => void nudgeLayer("back")} style={toolButtonStyle}>
                      {t("sendBackward")}
                    </button>
                    <button type="button" onClick={() => void nudgeLayer("forward")} style={toolButtonStyle}>
                      {t("bringForward")}
                    </button>
                    <button type="button" onClick={() => void nudgeLayer("front")} style={toolButtonStyle}>
                      {t("bringToFront")}
                    </button>
                  </div>
                </div>
                <label style={fieldStyle}>
                  <span>{t("featureType")}</span>
                  <select
                    value={editType}
                    onChange={(e) => void onTypeChange(e.target.value)}
                    style={selectStyle}
                  >
                    {FEATURE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`featureTypes.${type}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => void onDeleteSelected()} style={dangerButtonStyle}>
                  {t("delete")}
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      <style>{`
        @media (max-width: 720px) {
          .floor-editor-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

const toolButtonStyle: CSSProperties = {
  padding: "0.35rem 0.65rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const selectStyle: CSSProperties = {
  padding: "0.35rem 0.5rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  fontSize: "0.9rem",
};

const inputStyle: CSSProperties = {
  padding: "0.4rem 0.55rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  fontSize: "0.9rem",
  width: "100%",
  boxSizing: "border-box",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: "0.85rem",
};

const primaryButtonStyle: CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: 6,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const ghostButtonStyle: CSSProperties = {
  padding: "0.35rem 0.65rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  background: "#fff",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const dangerButtonStyle: CSSProperties = {
  padding: "0.4rem 0.7rem",
  borderRadius: 6,
  border: "1px solid #f0b4b4",
  background: "#fff",
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};

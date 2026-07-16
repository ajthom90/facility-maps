import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { BuildingSummary, CampusSummary, FloorSummary } from "../../types";

type CampusNode = CampusSummary & {
  buildings: (BuildingSummary & { floors: FloorSummary[] })[];
};

export function StructurePage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<CampusNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  const [newBuildingName, setNewBuildingName] = useState<Record<string, string>>({});
  const [newFloorName, setNewFloorName] = useState<Record<string, string>>({});
  const [newFloorLevel, setNewFloorLevel] = useState<Record<string, string>>({});
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set());
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    const { campuses } = await api.getCampuses();
    const nodes: CampusNode[] = await Promise.all(
      campuses.map(async (campus) => {
        const detail = await api.getCampus(campus.slug);
        const buildings = await Promise.all(
          detail.buildings.map(async (building) => {
            const b = await api.getBuilding(campus.slug, building.slug);
            return { ...building, floors: b.floors };
          }),
        );
        return { ...campus, buildings };
      }),
    );
    setTree(nodes);
    setExpandedCampuses((prev) => {
      if (prev.size > 0) return prev;
      return new Set(nodes.map((c) => c.id));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusy(false);
    }
  }

  function toggleCampus(id: string) {
    setExpandedCampuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBuilding(id: string) {
    setExpandedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreateCampus(e: FormEvent) {
    e.preventDefault();
    const name = newCampusName.trim();
    if (!name) return;
    await withBusy(async () => {
      await api.createCampus({ name });
      setNewCampusName("");
    });
  }

  async function onRenameCampus(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateCampus(id, { name });
    });
  }

  async function onDeleteCampus(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteCampus(id);
    });
  }

  async function onCreateBuilding(e: FormEvent, campusId: string) {
    e.preventDefault();
    const name = (newBuildingName[campusId] ?? "").trim();
    if (!name) return;
    await withBusy(async () => {
      await api.createBuilding({ campusId, name });
      setNewBuildingName((prev) => ({ ...prev, [campusId]: "" }));
      setExpandedCampuses((prev) => new Set(prev).add(campusId));
    });
  }

  async function onRenameBuilding(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateBuilding(id, { name });
    });
  }

  async function onDeleteBuilding(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteBuilding(id);
    });
  }

  async function onCreateFloor(e: FormEvent, buildingId: string) {
    e.preventDefault();
    const name = (newFloorName[buildingId] ?? "").trim();
    if (!name) return;
    const levelRaw = (newFloorLevel[buildingId] ?? "").trim();
    const level = levelRaw === "" ? undefined : Number(levelRaw);
    await withBusy(async () => {
      await api.createFloor({
        buildingId,
        name,
        level: level !== undefined && Number.isFinite(level) ? level : undefined,
      });
      setNewFloorName((prev) => ({ ...prev, [buildingId]: "" }));
      setNewFloorLevel((prev) => ({ ...prev, [buildingId]: "" }));
      setExpandedBuildings((prev) => new Set(prev).add(buildingId));
    });
  }

  async function onRenameFloor(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateFloor(id, { name });
    });
  }

  async function onDeleteFloor(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteFloor(id);
    });
  }

  if (error && !tree) {
    return <p role="alert">{error}</p>;
  }

  if (!tree) {
    return <p>{t("loading")}</p>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.35rem" }}>{t("structure")}</h1>
        <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
          {t("campuses")} · {t("buildings")} · {t("floors")}
        </p>
      </div>

      {error ? (
        <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreateCampus} style={inlineFormStyle}>
        <input
          value={newCampusName}
          onChange={(e) => setNewCampusName(e.target.value)}
          placeholder={t("addCampus")}
          disabled={busy}
          style={inputStyle}
        />
        <button type="submit" disabled={busy || !newCampusName.trim()} style={primaryButtonStyle}>
          {t("add")}
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
        {tree.map((campus) => {
          const campusOpen = expandedCampuses.has(campus.id);
          return (
            <li key={campus.id} style={cardStyle}>
              <div style={rowStyle}>
                <button
                  type="button"
                  onClick={() => toggleCampus(campus.id)}
                  style={toggleStyle}
                  aria-expanded={campusOpen}
                >
                  {campusOpen ? "▾" : "▸"} {campus.name}
                  <span style={metaStyle}>/{campus.slug}</span>
                </button>
                <div style={actionsStyle}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRenameCampus(campus.id, campus.name)}
                    style={ghostButtonStyle}
                  >
                    {t("rename")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteCampus(campus.id, campus.name)}
                    style={dangerButtonStyle}
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>

              {campusOpen ? (
                <div style={{ marginTop: "0.75rem", paddingLeft: "0.5rem" }}>
                  <div style={sectionLabelStyle}>{t("buildings")}</div>
                  <form
                    onSubmit={(e) => onCreateBuilding(e, campus.id)}
                    style={{ ...inlineFormStyle, marginBottom: "0.5rem" }}
                  >
                    <input
                      value={newBuildingName[campus.id] ?? ""}
                      onChange={(e) =>
                        setNewBuildingName((prev) => ({ ...prev, [campus.id]: e.target.value }))
                      }
                      placeholder={t("addBuilding")}
                      disabled={busy}
                      style={inputStyle}
                    />
                    <button
                      type="submit"
                      disabled={busy || !(newBuildingName[campus.id] ?? "").trim()}
                      style={primaryButtonStyle}
                    >
                      {t("add")}
                    </button>
                  </form>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                    {campus.buildings.map((building) => {
                      const buildingOpen = expandedBuildings.has(building.id);
                      return (
                        <li
                          key={building.id}
                          style={{
                            background: "#f7f7f8",
                            borderRadius: 6,
                            border: "1px solid #e8e8ec",
                            padding: "0.55rem 0.65rem",
                          }}
                        >
                          <div style={rowStyle}>
                            <button
                              type="button"
                              onClick={() => toggleBuilding(building.id)}
                              style={toggleStyle}
                              aria-expanded={buildingOpen}
                            >
                              {buildingOpen ? "▾" : "▸"} {building.name}
                              <span style={metaStyle}>/{building.slug}</span>
                            </button>
                            <div style={actionsStyle}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onRenameBuilding(building.id, building.name)}
                                style={ghostButtonStyle}
                              >
                                {t("rename")}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onDeleteBuilding(building.id, building.name)}
                                style={dangerButtonStyle}
                              >
                                {t("delete")}
                              </button>
                            </div>
                          </div>

                          {buildingOpen ? (
                            <div style={{ marginTop: "0.6rem", paddingLeft: "0.35rem" }}>
                              <div style={sectionLabelStyle}>{t("floors")}</div>
                              <form
                                onSubmit={(e) => onCreateFloor(e, building.id)}
                                style={{ ...inlineFormStyle, marginBottom: "0.5rem", flexWrap: "wrap" }}
                              >
                                <input
                                  value={newFloorName[building.id] ?? ""}
                                  onChange={(e) =>
                                    setNewFloorName((prev) => ({
                                      ...prev,
                                      [building.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t("addFloor")}
                                  disabled={busy}
                                  style={inputStyle}
                                />
                                <input
                                  value={newFloorLevel[building.id] ?? ""}
                                  onChange={(e) =>
                                    setNewFloorLevel((prev) => ({
                                      ...prev,
                                      [building.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t("level")}
                                  inputMode="numeric"
                                  disabled={busy}
                                  style={{ ...inputStyle, maxWidth: 80 }}
                                />
                                <button
                                  type="submit"
                                  disabled={busy || !(newFloorName[building.id] ?? "").trim()}
                                  style={primaryButtonStyle}
                                >
                                  {t("add")}
                                </button>
                              </form>

                              <ul
                                style={{
                                  listStyle: "none",
                                  padding: 0,
                                  margin: 0,
                                  display: "grid",
                                  gap: "0.35rem",
                                }}
                              >
                                {building.floors.map((floor) => (
                                  <li key={floor.id} style={rowStyle}>
                                    <span style={{ fontSize: "0.9rem" }}>
                                      {floor.name}
                                      <span style={metaStyle}>
                                        /{floor.slug} · L{floor.level}
                                      </span>
                                    </span>
                                    <div style={actionsStyle}>
                                      <Link
                                        to={`/admin/floors/${floor.id}`}
                                        style={{
                                          ...primaryButtonStyle,
                                          textDecoration: "none",
                                          display: "inline-block",
                                          fontSize: "0.8rem",
                                          padding: "0.3rem 0.6rem",
                                        }}
                                      >
                                        {t("editMap")}
                                      </Link>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onRenameFloor(floor.id, floor.name)}
                                        style={ghostButtonStyle}
                                      >
                                        {t("rename")}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => onDeleteFloor(floor.id, floor.name)}
                                        style={dangerButtonStyle}
                                      >
                                        {t("delete")}
                                      </button>
                                    </div>
                                  </li>
                                ))}
                                {building.floors.length === 0 ? (
                                  <li style={{ fontSize: "0.85rem", color: "#666" }}>{t("emptyFloors")}</li>
                                ) : null}
                              </ul>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                    {campus.buildings.length === 0 ? (
                      <li style={{ fontSize: "0.85rem", color: "#666" }}>{t("emptyBuildings")}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e2e5",
  borderRadius: 8,
  padding: "0.75rem 0.85rem",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: "0.35rem",
  flexWrap: "wrap",
};

const inlineFormStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 120,
  padding: "0.4rem 0.55rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  fontSize: "0.9rem",
};

const primaryButtonStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: 6,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const ghostButtonStyle: CSSProperties = {
  padding: "0.3rem 0.55rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  background: "#fff",
  cursor: "pointer",
  fontSize: "0.8rem",
};

const dangerButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  borderColor: "#f0b4b4",
  color: "#b91c1c",
};

const toggleStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.95rem",
  textAlign: "left",
  padding: 0,
};

const metaStyle: CSSProperties = {
  fontWeight: 400,
  color: "#888",
  fontSize: "0.8rem",
  marginLeft: 6,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#666",
  marginBottom: 6,
};

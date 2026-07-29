import { useEffect, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import type { CampusDetail } from "../types";
import { SingleMapPage } from "./FloorMapPage";

const cardLinkStyle: CSSProperties = {
  display: "block",
  padding: "1.25rem",
  background: "#fff",
  border: "1px solid #e2e2e5",
  borderRadius: 8,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 600,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
  gap: "1rem",
  listStyle: "none",
  padding: 0,
  margin: 0,
};

export function CampusPage() {
  const { campusSlug = "" } = useParams<{ campusSlug: string }>();
  const { t } = useTranslation();
  const [campus, setCampus] = useState<CampusDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCampus(null);
    setError(null);
    api
      .getCampus(campusSlug)
      .then((data) => {
        if (!cancelled) setCampus(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campusSlug, t]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!campus) {
    return <p>{t("loading")}</p>;
  }

  if (campus.hierarchyMode === "single_map") {
    const floorId = campus.mapFloorId ?? campus.floors[0]?.id;
    if (!floorId) {
      return (
        <section>
          <Breadcrumb items={[{ label: campus.name }]} />
          <h1 style={{ marginTop: 0 }}>{campus.name}</h1>
          <p>{t("emptyPlan")}</p>
        </section>
      );
    }
    return (
      <SingleMapPage
        campusSlug={campus.slug}
        campusName={campus.name}
        floorId={floorId}
      />
    );
  }

  if (campus.hierarchyMode === "no_buildings") {
    return (
      <section>
        <Breadcrumb items={[{ label: campus.name }]} />
        <h1 style={{ marginTop: 0 }}>{campus.name}</h1>
        <h2 style={{ fontSize: "1.1rem" }}>{t("floors")}</h2>
        {campus.floors.length === 0 ? (
          <p>{t("emptyFloors")}</p>
        ) : (
          <ul style={gridStyle}>
            {campus.floors.map((floor) => (
              <li key={floor.id}>
                <Link to={`/${campus.slug}/${floor.slug}`} style={cardLinkStyle}>
                  {floor.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // full
  return (
    <section>
      <Breadcrumb items={[{ label: campus.name }]} />
      <h1 style={{ marginTop: 0 }}>{campus.name}</h1>
      <h2 style={{ fontSize: "1.1rem" }}>{t("buildings")}</h2>
      {campus.buildings.length === 0 ? (
        <p>{t("emptyBuildings")}</p>
      ) : (
        <ul style={gridStyle}>
          {campus.buildings.map((building) => (
            <li key={building.id}>
              <Link
                to={`/${campus.slug}/${building.slug}`}
                style={cardLinkStyle}
              >
                {building.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

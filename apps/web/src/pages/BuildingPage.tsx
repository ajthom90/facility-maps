import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import type { BuildingDetail } from "../types";

export function BuildingPage() {
  const params = useParams<{
    campusSlug: string;
    buildingSlug?: string;
    segmentSlug?: string;
  }>();
  const campusSlug = params.campusSlug ?? "";
  const buildingSlug = params.buildingSlug ?? params.segmentSlug ?? "";
  const { t } = useTranslation();
  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [campusName, setCampusName] = useState<string>(campusSlug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBuilding(null);
    setError(null);

    Promise.all([api.getCampus(campusSlug), api.getBuilding(campusSlug, buildingSlug)])
      .then(([campus, buildingData]) => {
        if (!cancelled) {
          setCampusName(campus.name);
          setBuilding(buildingData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusSlug, buildingSlug, t]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!building) {
    return <p>{t("loading")}</p>;
  }

  return (
    <section>
      <Breadcrumb
        items={[
          { label: campusName, to: `/${campusSlug}` },
          { label: building.name },
        ]}
      />
      <h1 style={{ marginTop: 0 }}>{building.name}</h1>
      <h2 style={{ fontSize: "1.1rem" }}>{t("floors")}</h2>
      {building.floors.length === 0 ? (
        <p>{t("emptyFloors")}</p>
      ) : (
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
            gap: "1rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {building.floors.map((floor) => (
            <li key={floor.id}>
              <Link
                to={`/${campusSlug}/${building.slug}/${floor.slug}`}
                style={{
                  display: "block",
                  padding: "1.25rem",
                  background: "#fff",
                  border: "1px solid #e2e2e5",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  fontWeight: 600,
                }}
              >
                {floor.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

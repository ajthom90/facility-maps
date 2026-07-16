import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import type { CampusDetail } from "../types";

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

  return (
    <section>
      <Breadcrumb items={[{ label: campus.name }]} />
      <h1 style={{ marginTop: 0 }}>{campus.name}</h1>
      <h2 style={{ fontSize: "1.1rem" }}>{t("buildings")}</h2>
      {campus.buildings.length === 0 ? (
        <p>{t("emptyBuildings")}</p>
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
          {campus.buildings.map((building) => (
            <li key={building.id}>
              <Link
                to={`/${campus.slug}/${building.slug}`}
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
                {building.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

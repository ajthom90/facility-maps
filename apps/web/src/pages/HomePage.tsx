import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { CampusSummary } from "../types";

export function HomePage() {
  const { t } = useTranslation();
  const [campuses, setCampuses] = useState<CampusSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getCampuses()
      .then((data) => {
        if (!cancelled) setCampuses(data.campuses);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!campuses) {
    return <p>{t("loading")}</p>;
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{t("campuses")}</h1>
      {campuses.length === 0 ? (
        <p>{t("emptyCampuses")}</p>
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
          {campuses.map((campus) => (
            <li key={campus.id}>
              <Link
                to={`/${campus.slug}`}
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
                {campus.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

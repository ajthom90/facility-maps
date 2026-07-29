import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { HierarchyMode } from "../types";
import { BuildingPage } from "./BuildingPage";
import { CampusFloorMapPage } from "./FloorMapPage";

/**
 * Resolves /:campusSlug/:segment based on campus hierarchy mode:
 * - full → building page
 * - no_buildings → campus-level floor map
 * - single_map → not used (map is on campus root)
 */
export function MiddleSegmentPage() {
  const { campusSlug = "" } = useParams<{ campusSlug: string }>();
  const { t } = useTranslation();
  const [mode, setMode] = useState<HierarchyMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMode(null);
    setError(null);
    api
      .getCampus(campusSlug)
      .then((campus) => {
        if (!cancelled) setMode(campus.hierarchyMode);
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

  if (error) return <p role="alert">{error}</p>;
  if (!mode) return <p>{t("loading")}</p>;

  if (mode === "no_buildings") {
    return <CampusFloorMapPage />;
  }
  if (mode === "full") {
    return <BuildingPage />;
  }

  return <p role="alert">{t("notFound")}</p>;
}

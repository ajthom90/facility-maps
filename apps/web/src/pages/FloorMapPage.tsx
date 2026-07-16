import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import { FeaturePopup } from "../components/FeaturePopup";
import { LayerPanel } from "../components/LayerPanel";
import { Legend } from "../components/Legend";
import { MapCanvas } from "../components/MapCanvas";
import { useLayers } from "../hooks/useLayers";
import { FEATURE_TYPES, type FloorDetail, type LayerPreset, type MapFeature } from "../types";

export function FloorMapPage() {
  const {
    campusSlug = "",
    buildingSlug = "",
    floorSlug = "",
  } = useParams<{
    campusSlug: string;
    buildingSlug: string;
    floorSlug: string;
  }>();
  const { t } = useTranslation();

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [campusName, setCampusName] = useState(campusSlug);
  const [buildingName, setBuildingName] = useState(buildingSlug);
  const [presets, setPresets] = useState<LayerPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapFeature | null>(null);

  const { activeTypes, activePresetSlug, applyPreset, toggleType } = useLayers(
    presets,
    FEATURE_TYPES,
  );

  useEffect(() => {
    let cancelled = false;
    setFloor(null);
    setError(null);
    setSelected(null);

    Promise.all([
      api.getCampus(campusSlug),
      api.getBuilding(campusSlug, buildingSlug),
      api.getFloor(campusSlug, buildingSlug, floorSlug),
      api.getPresets(),
    ])
      .then(([campus, building, floorData, presetsData]) => {
        if (cancelled) return;
        setCampusName(campus.name);
        setBuildingName(building.name);
        setFloor(floorData);
        setPresets(
          [...presetsData.presets].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
          ),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusSlug, buildingSlug, floorSlug, t]);

  const visibleTypeList = useMemo(() => {
    if (!floor) return [] as string[];
    const present = new Set(floor.features.map((f) => f.type));
    return [...activeTypes].filter((type) => present.has(type));
  }, [floor, activeTypes]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!floor) {
    return <p>{t("loading")}</p>;
  }

  const hasPlan = floor.plan != null;
  const noFeatures = floor.features.length === 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        /* Break out of Layout max-width slightly on wide screens via full width */
        width: "100%",
      }}
    >
      <Breadcrumb
        items={[
          { label: campusName, to: `/${campusSlug}` },
          { label: buildingName, to: `/${campusSlug}/${buildingSlug}` },
          { label: floor.name },
        ]}
      />
      <h1 style={{ margin: 0, fontSize: "1.35rem" }}>{floor.name}</h1>

      {!hasPlan ? (
        <p>{t("emptyPlan")}</p>
      ) : (
        <div
          style={{
            position: "relative",
            height: "min(70vh, 640px)",
            minHeight: 280,
          }}
        >
          <MapCanvas
            planUrl={floor.plan!.url}
            mimeType={floor.plan!.mimeType}
            features={floor.features}
            visibleTypes={activeTypes}
            onSelectFeature={setSelected}
            selectedFeatureId={selected?.id ?? null}
          />
          <FeaturePopup feature={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      <Legend visibleTypes={visibleTypeList} emptyFeatures={hasPlan && noFeatures} />

      <LayerPanel
        presets={presets}
        activeTypes={activeTypes}
        activePresetSlug={activePresetSlug}
        onApplyPreset={applyPreset}
        onToggleType={toggleType}
        allTypes={FEATURE_TYPES}
      />
    </section>
  );
}

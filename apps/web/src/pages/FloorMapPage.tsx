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
import {
  FEATURE_TYPES,
  type FloorDetail,
  type LayerPreset,
  type MapFeature,
} from "../types";

type Crumb = { label: string; to?: string };

type FloorMapViewProps = {
  floor: FloorDetail;
  crumbs: Crumb[];
  presets: LayerPreset[];
};

/** Shared map viewer shell (public). */
export function FloorMapView({ floor, crumbs, presets }: FloorMapViewProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<MapFeature | null>(null);
  const { activeTypes, activePresetSlug, applyPreset, toggleType } = useLayers(
    presets,
    FEATURE_TYPES,
  );

  useEffect(() => {
    if (selected && !activeTypes.has(selected.type)) {
      setSelected(null);
    }
  }, [selected, activeTypes]);

  const visibleTypeList = useMemo(() => {
    const present = new Set(floor.features.map((f) => f.type));
    return [...activeTypes].filter((type) => present.has(type));
  }, [floor, activeTypes]);

  const hasPlan = floor.plan != null;
  const noFeatures = floor.features.length === 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        width: "100%",
      }}
    >
      <Breadcrumb items={crumbs} />
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
            planWidth={floor.plan!.width}
            planHeight={floor.plan!.height}
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
        featureSelected={selected != null}
      />
    </section>
  );
}

/** Full hierarchy: /:campus/:building/:floor */
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

  useEffect(() => {
    let cancelled = false;
    setFloor(null);
    setError(null);

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

  if (error) return <p role="alert">{error}</p>;
  if (!floor) return <p>{t("loading")}</p>;

  return (
    <FloorMapView
      floor={floor}
      presets={presets}
      crumbs={[
        { label: campusName, to: `/${campusSlug}` },
        { label: buildingName, to: `/${campusSlug}/${buildingSlug}` },
        { label: floor.name },
      ]}
    />
  );
}

/** no_buildings: /:campus/:floor */
export function CampusFloorMapPage() {
  const params = useParams<{
    campusSlug: string;
    floorSlug?: string;
    segmentSlug?: string;
  }>();
  const campusSlug = params.campusSlug ?? "";
  const floorSlug = params.floorSlug ?? params.segmentSlug ?? "";
  const { t } = useTranslation();

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [campusName, setCampusName] = useState(campusSlug);
  const [presets, setPresets] = useState<LayerPreset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFloor(null);
    setError(null);

    Promise.all([
      api.getCampus(campusSlug),
      api.getCampusFloor(campusSlug, floorSlug),
      api.getPresets(),
    ])
      .then(([campus, floorData, presetsData]) => {
        if (cancelled) return;
        if (campus.hierarchyMode !== "no_buildings") {
          setError(t("notFound"));
          return;
        }
        setCampusName(campus.name);
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
  }, [campusSlug, floorSlug, t]);

  if (error) return <p role="alert">{error}</p>;
  if (!floor) return <p>{t("loading")}</p>;

  return (
    <FloorMapView
      floor={floor}
      presets={presets}
      crumbs={[
        { label: campusName, to: `/${campusSlug}` },
        { label: floor.name },
      ]}
    />
  );
}

/** single_map embedded on campus page or by floor id. */
export function SingleMapPage({
  campusSlug,
  campusName,
  floorId,
}: {
  campusSlug: string;
  campusName: string;
  floorId: string;
}) {
  const { t } = useTranslation();
  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [presets, setPresets] = useState<LayerPreset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFloor(null);
    setError(null);

    Promise.all([api.getFloorById(floorId), api.getPresets()])
      .then(([floorData, presetsData]) => {
        if (cancelled) return;
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
  }, [floorId, t]);

  if (error) return <p role="alert">{error}</p>;
  if (!floor) return <p>{t("loading")}</p>;

  return (
    <FloorMapView
      floor={floor}
      presets={presets}
      crumbs={[{ label: campusName, to: `/${campusSlug}` }, { label: floor.name }]}
    />
  );
}

import { useTranslation } from "react-i18next";
import type { MapFeature } from "../types";
import { colorForType } from "../lib/featureStyle";

export type FeaturePopupProps = {
  feature: MapFeature | null;
  onClose: () => void;
};

export function FeaturePopup({ feature, onClose }: FeaturePopupProps) {
  const { t } = useTranslation();

  if (!feature) return null;

  const color = colorForType(feature.type);

  return (
    <div
      role="dialog"
      aria-label={feature.label || t(`featureTypes.${feature.type}`)}
      style={{
        position: "absolute",
        left: "0.75rem",
        right: "0.75rem",
        bottom: "0.75rem",
        /* Above Layers FAB (z-index 40) so close control is not covered on mobile */
        zIndex: 45,
        background: "#fff",
        borderRadius: 10,
        border: "1px solid #e2e2e5",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        padding: "0.85rem 1rem",
        maxWidth: 420,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <strong>{t(`featureTypes.${feature.type}`, { defaultValue: feature.type })}</strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: "none",
            background: "transparent",
            fontSize: "1.25rem",
            lineHeight: 1,
            cursor: "pointer",
            padding: "0 0.25rem",
          }}
        >
          ×
        </button>
      </div>
      {feature.label ? (
        <p style={{ margin: "0.5rem 0 0" }}>
          <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{t("label")}: </span>
          {feature.label}
        </p>
      ) : null}
      {feature.notes ? (
        <p style={{ margin: "0.35rem 0 0" }}>
          <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{t("notes")}: </span>
          {feature.notes}
        </p>
      ) : null}
    </div>
  );
}

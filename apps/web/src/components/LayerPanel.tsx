import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayerPreset } from "../types";
import { FEATURE_TYPES } from "../types";
import { colorForType } from "../lib/featureStyle";

export type LayerPanelProps = {
  presets: LayerPreset[];
  activeTypes: Set<string>;
  activePresetSlug: string | null;
  onApplyPreset: (slug: string) => void;
  onToggleType: (type: string) => void;
  allTypes?: readonly string[];
  /** When true, shift the mobile FAB so it does not cover FeaturePopup close. */
  featureSelected?: boolean;
};

export function LayerPanel({
  presets,
  activeTypes,
  activePresetSlug,
  onApplyPreset,
  onToggleType,
  allTypes = FEATURE_TYPES,
  featureSelected = false,
}: LayerPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const body = (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          marginBottom: "0.75rem",
        }}
      >
        {presets.map((preset) => {
          const active = activePresetSlug === preset.slug;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.slug)}
              aria-pressed={active}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 999,
                border: active ? "2px solid #2563eb" : "1px solid #c8c8ce",
                background: active ? "#dbeafe" : "#fff",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {t(`presets.${preset.slug}`, { defaultValue: preset.slug })}
            </button>
          );
        })}
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {allTypes.map((type) => {
          const checked = activeTypes.has(type);
          return (
            <li key={type}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  padding: "0.25rem 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleType(type)}
                />
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: colorForType(type),
                    flexShrink: 0,
                  }}
                />
                <span>{t(`featureTypes.${type}`, { defaultValue: type })}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      {/* Desktop / wide: inline panel */}
      <aside
        aria-label={t("layers")}
        className="layer-panel-desktop"
        style={{
          background: "#fff",
          border: "1px solid #e2e2e5",
          borderRadius: 8,
          padding: "0.85rem 1rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.65rem", fontSize: "1rem" }}>{t("layers")}</h2>
        {body}
      </aside>

      {/* Mobile: bottom sheet trigger + sheet */}
      <div className="layer-panel-mobile">
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            /* When a feature popup is open, raise FAB above popup area */
            bottom: featureSelected ? "7.5rem" : "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            padding: "0.75rem 1.5rem",
            borderRadius: 999,
            border: "none",
            background: "#1e293b",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            cursor: "pointer",
          }}
        >
          {t("layers")}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("layers")}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                background: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: "1rem 1.25rem 1.5rem",
                maxHeight: "70vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("layers")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: "1.5rem",
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  ×
                </button>
              </div>
              {body}
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        .layer-panel-mobile { display: none; }
        .layer-panel-desktop { display: block; }
        @media (max-width: 640px) {
          .layer-panel-mobile { display: block; }
          .layer-panel-desktop { display: none; }
        }
      `}</style>
    </>
  );
}

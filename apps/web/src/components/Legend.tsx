import { useTranslation } from "react-i18next";
import { colorForType } from "../lib/featureStyle";

export type LegendProps = {
  /** Feature types currently visible on the map */
  visibleTypes: string[];
  /** True when the floor has a plan but no features at all */
  emptyFeatures?: boolean;
};

export function Legend({ visibleTypes, emptyFeatures = false }: LegendProps) {
  const { t } = useTranslation();

  if (emptyFeatures) {
    return (
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
        {t("emptyFeatures")}
      </p>
    );
  }

  if (visibleTypes.length === 0) {
    return null;
  }

  const sorted = [...visibleTypes].sort();

  return (
    <ul
      aria-label="Legend"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem 1rem",
        listStyle: "none",
        margin: 0,
        padding: 0,
        fontSize: "0.8rem",
      }}
    >
      {sorted.map((type) => (
        <li
          key={type}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: colorForType(type),
            }}
          />
          {t(`featureTypes.${type}`, { defaultValue: type })}
        </li>
      ))}
    </ul>
  );
}

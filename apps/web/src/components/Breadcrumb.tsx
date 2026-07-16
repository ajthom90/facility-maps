import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          listStyle: "none",
          padding: 0,
          margin: 0,
          alignItems: "center",
        }}
      >
        <li>
          <Link to="/">{t("appTitle")}</Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span aria-hidden="true">›</span>
              {item.to && !isLast ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

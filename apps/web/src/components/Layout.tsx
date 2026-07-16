import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Layout() {
  const { t } = useTranslation();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        color: "#1a1a1a",
        background: "#f7f7f8",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "0.75rem 1.25rem",
          background: "#fff",
          borderBottom: "1px solid #e2e2e5",
        }}
      >
        <Link to="/" style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
          {t("appTitle")}
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <LanguageSwitcher />
          <Link to="/admin" style={{ fontSize: "0.9rem" }}>
            {t("admin")}
          </Link>
        </div>
      </header>
      <main style={{ flex: 1, padding: "1.25rem", maxWidth: 960, width: "100%", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

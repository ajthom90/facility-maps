import { useEffect, useState, type CSSProperties } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type AdminUser } from "../../api/client";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (!me) {
          navigate("/admin/login", { replace: true });
          return;
        }
        setUser(me);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  async function onLogout() {
    try {
      await api.logout();
    } catch {
      /* still leave admin */
    }
    navigate("/admin/login", { replace: true });
  }

  if (loading) {
    return (
      <div style={shellStyle}>
        <p style={{ padding: "1.25rem" }}>{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shellStyle}>
        <p role="alert" style={{ padding: "1.25rem" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={shellStyle}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          padding: "0.75rem 1.25rem",
          background: "#fff",
          borderBottom: "1px solid #e2e2e5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/admin" style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
            {t("admin")}
          </Link>
          <nav style={{ display: "flex", gap: "0.75rem", fontSize: "0.9rem" }}>
            <NavLink
              to="/admin"
              end
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "#1d4ed8" : "inherit",
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {t("structure")}
            </NavLink>
            <NavLink
              to="/admin/users"
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "#1d4ed8" : "inherit",
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {t("users")}
            </NavLink>
            <NavLink
              to="/admin/presets"
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "#1d4ed8" : "inherit",
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {t("layerPresets")}
            </NavLink>
            <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
              {t("publicView")}
            </Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#555" }}>{user.username}</span>
          <LanguageSwitcher />
          <button type="button" onClick={onLogout} style={ghostButtonStyle}>
            {t("logout")}
          </button>
        </div>
      </header>
      <main
        style={{
          flex: 1,
          padding: "1.25rem",
          maxWidth: 1100,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
  background: "#f7f7f8",
};

const ghostButtonStyle: CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  background: "#fff",
  cursor: "pointer",
  fontSize: "0.875rem",
};

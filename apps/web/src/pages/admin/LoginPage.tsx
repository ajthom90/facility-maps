import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled && user) {
          navigate("/admin", { replace: true });
        }
      })
      .catch(() => {
        /* stay on login */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(username.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p>{t("loading")}</p>;
  }

  return (
    <section
      style={{
        maxWidth: 360,
        margin: "2rem auto",
        padding: "1.5rem",
        background: "#fff",
        border: "1px solid #e2e2e5",
        borderRadius: 8,
      }}
    >
      <h1 style={{ marginTop: 0, fontSize: "1.25rem" }}>{t("login")}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: "0.875rem" }}>{t("username")}</span>
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: "0.875rem" }}>{t("password")}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        {error ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {submitting ? t("loading") : t("login")}
        </button>
      </form>
    </section>
  );
}

const inputStyle: CSSProperties = {
  padding: "0.5rem 0.65rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  fontSize: "1rem",
};

const primaryButtonStyle: CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 6,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.95rem",
};

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, type ManagedAdminUser } from "../../api/client";

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ManagedAdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { users: rows } = await api.listAdminUsers();
    setUsers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    await withBusy(async () => {
      await api.createAdminUser({ username: u, password });
      setUsername("");
      setPassword("");
    });
  }

  async function onToggleDisabled(user: ManagedAdminUser) {
    await withBusy(async () => {
      await api.updateAdminUser(user.id, { disabled: !user.disabled });
    });
  }

  if (error && !users) {
    return <p role="alert">{error}</p>;
  }

  if (!users) {
    return <p>{t("loading")}</p>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.35rem" }}>{t("users")}</h1>
        <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>{t("usersHint")}</p>
      </div>

      {error ? (
        <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreate} style={formStyle}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("username")}
          autoComplete="off"
          disabled={busy}
          style={inputStyle}
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          autoComplete="new-password"
          disabled={busy}
          style={inputStyle}
          required
        />
        <button type="submit" disabled={busy || !username.trim() || !password} style={primaryButtonStyle}>
          {t("createUser")}
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        {users.map((user) => (
          <li key={user.id} style={cardStyle}>
            <div>
              <div style={{ fontWeight: 600 }}>{user.username}</div>
              <div style={{ fontSize: "0.8rem", color: "#666" }}>
                {user.disabled ? t("disabled") : t("enabled")}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleDisabled(user)}
              style={user.disabled ? primaryButtonStyle : dangerButtonStyle}
            >
              {user.disabled ? t("enable") : t("disable")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  flex: "1 1 140px",
  minWidth: 120,
  padding: "0.4rem 0.55rem",
  borderRadius: 6,
  border: "1px solid #c8c8ce",
  fontSize: "0.9rem",
};

const primaryButtonStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: 6,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const dangerButtonStyle: CSSProperties = {
  padding: "0.35rem 0.65rem",
  borderRadius: 6,
  border: "1px solid #f0b4b4",
  background: "#fff",
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: "0.8rem",
};

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  background: "#fff",
  border: "1px solid #e2e2e5",
  borderRadius: 8,
  padding: "0.75rem 0.85rem",
};

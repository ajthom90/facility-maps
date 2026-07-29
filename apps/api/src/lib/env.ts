import fs from "node:fs";
import path from "node:path";

/** Known placeholder secrets that must never be used in production. */
const WEAK_SESSION_SECRETS = new Set([
  "change-me-in-production",
  "dev-only-change-me",
  "generate-a-long-random-string",
]);

/**
 * Load KEY=VALUE pairs from a file into process.env when the key is unset.
 * Supports optional quotes and ignores blank lines / # comments.
 */
export function loadEnvFile(filePath: string): void {
  if (!filePath || !fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Fill when unset or empty so a restored /config/app.env wins over blank compose env.
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }
}

/** Optional host/project .env then container config volume file. */
function loadOptionalConfigFiles(): void {
  // Local development: repo-root .env if present (cwd-dependent).
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  // Docker: CONFIG_FILE defaults to /config/app.env on the config volume.
  const configFile =
    process.env.CONFIG_FILE?.trim() ||
    (fs.existsSync("/config/app.env") ? "/config/app.env" : "");
  if (configFile) loadEnvFile(configFile);
}

loadOptionalConfigFiles();

/**
 * Cookie Secure flag.
 * - COOKIE_SECURE=true  → secure cookies (use behind HTTPS)
 * - COOKIE_SECURE=false → insecure cookies (plain HTTP, e.g. internal Compose)
 * - unset               → false (safe default for plain HTTP internal deploys)
 */
function parseCookieSecure(raw: string | undefined = process.env.COOKIE_SECURE): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return false;
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  /**
   * Path to the SQLite database file.
   * Docker default: /data/db/facility-maps.sqlite (on the data volume).
   */
  SQLITE_PATH:
    process.env.SQLITE_PATH ??
    path.resolve(process.cwd(), "data", "facility-maps.sqlite"),
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-only-change-me",
  COOKIE_SECURE: parseCookieSecure(),
  ADMIN_BOOTSTRAP_USERNAME: process.env.ADMIN_BOOTSTRAP_USERNAME ?? "",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "data", "uploads"),
  /**
   * Relative path (from process cwd) to built web assets, e.g. `apps/web/dist`.
   * When set, the API serves the SPA after API routes. Empty = API only.
   * Absolute paths are not supported by @hono/node-server serveStatic.
   */
  WEB_DIST: process.env.WEB_DIST ?? "",
  /**
   * Optional path to a KEY=VALUE config file (defaults to /config/app.env when present).
   * Stored on the config volume so secrets move with host migrations.
   */
  CONFIG_FILE: process.env.CONFIG_FILE ?? "",
};

/** True if secret is missing, empty, a known default, or shorter than 16 chars. */
export function isWeakSessionSecret(secret: string): boolean {
  if (!secret || secret.trim() === "") return true;
  if (secret.length < 16) return true;
  if (WEAK_SESSION_SECRETS.has(secret)) return true;
  return false;
}

/**
 * In production, refuse to start with a missing/weak SESSION_SECRET.
 * Safe to call in non-production (no-op).
 */
export function assertProductionSessionSecret(
  secret: string = env.SESSION_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv !== "production") return;
  if (!isWeakSessionSecret(secret)) return;

  console.error(
    "Fatal: SESSION_SECRET is missing, empty, shorter than 16 characters, or a known default " +
      "(change-me-in-production, dev-only-change-me, generate-a-long-random-string). " +
      "Set a long random SESSION_SECRET in the environment or /config/app.env before running in production.",
  );
  process.exit(1);
}

/** Exported for tests — parse COOKIE_SECURE the same way as env.COOKIE_SECURE. */
export function parseCookieSecureFlag(raw: string | undefined): boolean {
  return parseCookieSecure(raw);
}

/**
 * Persist current runtime settings into CONFIG_FILE (or /config/app.env) when missing,
 * so a fresh host can start with compose env once, then migrate the config volume later.
 */
export function ensureConfigFileWritten(): void {
  const target =
    env.CONFIG_FILE ||
    (fs.existsSync("/config") ? "/config/app.env" : "");
  if (!target) return;
  if (fs.existsSync(target)) return;

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = [
      "# Facility Safety Maps — portable config (back up this file with the data volume)",
      `# Written automatically on first start at ${new Date().toISOString()}`,
      `SESSION_SECRET=${env.SESSION_SECRET}`,
      `COOKIE_SECURE=${env.COOKIE_SECURE ? "true" : "false"}`,
      `ADMIN_BOOTSTRAP_USERNAME=${env.ADMIN_BOOTSTRAP_USERNAME}`,
      `ADMIN_BOOTSTRAP_PASSWORD=${env.ADMIN_BOOTSTRAP_PASSWORD}`,
      `SQLITE_PATH=${env.SQLITE_PATH}`,
      `UPLOAD_DIR=${env.UPLOAD_DIR}`,
      "",
    ].join("\n");
    fs.writeFileSync(target, body, { mode: 0o600 });
    console.log(`Wrote initial config to ${target}`);
  } catch (err) {
    console.warn(`Could not write config file ${target}:`, err);
  }
}

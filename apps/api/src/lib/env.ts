/** Known placeholder secrets that must never be used in production. */
const WEAK_SESSION_SECRETS = new Set([
  "change-me-in-production",
  "dev-only-change-me",
  "generate-a-long-random-string",
]);

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
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://facility:facility@localhost:5432/facility_maps",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-only-change-me",
  COOKIE_SECURE: parseCookieSecure(),
  ADMIN_BOOTSTRAP_USERNAME: process.env.ADMIN_BOOTSTRAP_USERNAME ?? "",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./data/uploads",
  /**
   * Relative path (from process cwd) to built web assets, e.g. `apps/web/dist`.
   * When set, the API serves the SPA after API routes. Empty = API only.
   * Absolute paths are not supported by @hono/node-server serveStatic.
   */
  WEB_DIST: process.env.WEB_DIST ?? "",
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
      "Set a long random SESSION_SECRET before running in production.",
  );
  process.exit(1);
}

/** Exported for tests — parse COOKIE_SECURE the same way as env.COOKIE_SECURE. */
export function parseCookieSecureFlag(raw: string | undefined): boolean {
  return parseCookieSecure(raw);
}

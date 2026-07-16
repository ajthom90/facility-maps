export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://facility:facility@localhost:5432/facility_maps",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-only-change-me",
  ADMIN_BOOTSTRAP_USERNAME: process.env.ADMIN_BOOTSTRAP_USERNAME ?? "",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./data/uploads",
};

/** True when a unique constraint was violated (Postgres or SQLite). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string | number; message?: string };
  if (e.code === "23505") return true; // Postgres
  if (e.code === "SQLITE_CONSTRAINT_UNIQUE") return true;
  if (e.code === "SQLITE_CONSTRAINT") return true;
  if (typeof e.message === "string" && /unique constraint failed/i.test(e.message)) {
    return true;
  }
  return false;
}

/**
 * Shared SQLite path helpers for integration tests.
 * fileParallelism is disabled so suites can share one DB safely if needed;
 * prefer unique paths per suite when isolation matters.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTestSqlitePath(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fm-${label}-`));
  return path.join(dir, "test.sqlite");
}

export function cleanupSqliteFiles(sqlitePath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(sqlitePath + suffix);
    } catch {
      /* ignore */
    }
  }
  try {
    fs.rmdirSync(path.dirname(sqlitePath));
  } catch {
    /* ignore if not empty */
  }
}

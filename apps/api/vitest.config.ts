import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one Postgres DB (admin_users etc.); avoid races.
    fileParallelism: false,
  },
});

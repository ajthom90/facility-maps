import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration suites use separate temp SQLite files; keep serial for simplicity.
    fileParallelism: false,
  },
});

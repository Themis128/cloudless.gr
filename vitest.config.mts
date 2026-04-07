import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  test: {
    environment: "jsdom",
    pool: "threads",
    maxWorkers: 2,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    reporters: ["default"],
  },
});

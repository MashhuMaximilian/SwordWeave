import { defineConfig } from "vitest/config";
import path from "node:path";
import { assertIsolatedApplicationTestTarget } from "./src/test/isolated-application-guard";

assertIsolatedApplicationTestTarget();

export default defineConfig({
  cacheDir: ".sw-vitest-cache",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only.ts"),
    },
  },
  test: {
    setupFiles: ["./src/test/setup-isolated-application.ts"],
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

// Frontend unit tests only (pure utilities). The backend has its own Jest suite in server/.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});

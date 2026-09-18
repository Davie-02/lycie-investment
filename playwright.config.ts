import { defineConfig, devices } from "@playwright/test";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD_HASH } from "./tests/constants";

const FRONTEND_URL = "http://localhost:5173";
const API_URL = "http://localhost:3001";

// E2E tests run against a dedicated `lycie_investment_test` Postgres
// database (created once locally with `createdb lycie_investment_test`,
// same user/password as the dev DB) — never the developer's own dev
// database. `prisma migrate reset --force` wipes and reseeds it fresh
// before every run, so tests never depend on — or corrupt — local state.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npx prisma migrate reset --force --skip-generate && npm run start:dev",
      cwd: "server",
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: "postgresql://lycie:lycie@localhost:5432/lycie_investment_test?schema=public",
        PORT: "3001",
        NODE_ENV: "development",
        FRONTEND_URL,
        JWT_SECRET: "e2e-test-only-secret-not-used-anywhere-real",
        ADMIN_NAME: "E2E Admin",
        ADMIN_EMAIL: TEST_ADMIN_EMAIL,
        ADMIN_PASSWORD_HASH: TEST_ADMIN_PASSWORD_HASH,
      },
    },
    {
      command: "npm run dev",
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_API_BASE_URL: `${API_URL}/api`,
      },
    },
  ],
});

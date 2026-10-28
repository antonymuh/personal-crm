import { defineConfig, devices } from "@playwright/test";

import { e2eDatabaseUrl } from "./e2e/database";

// A port of its own, so the tests never hit a `pnpm dev` that is already
// running against the real database.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // All tests share one database, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ru-RU",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build, like on the server. `next dev` cannot run twice in
    // one folder, and it may already be running for manual checks.
    command:
      "pnpm exec tsx e2e/prepare-database.ts && pnpm exec next build && pnpm exec tsx e2e/serve-build.ts",
    url: `${baseURL}/health`,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
    },
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
  },
});

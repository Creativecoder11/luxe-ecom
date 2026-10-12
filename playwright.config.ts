import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * E2E runs against a production build backed by the dedicated E2E database
 * (migrated, emptied and seeded by scripts/prepare-e2e-db.ts on every run).
 * SHELL_PREVIEW=true only enables /styleguide; it is rejected when APP_ENV=production.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One `next start` process serves every worker. A CPU profile (2026-10-11) showed the server
  // saturated by ordinary request work at 4 workers on a dev laptop, so parallelism is capped.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  // Assertions wait for server actions (password hashing, transactions). On a loaded laptop
  // (macOS background tasks pushed load averages past 100 on 2026-10-12) 5 s was too tight.
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in once as the seeded owner and stores the session (avoids tripping login rate limits).
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `pnpm exec tsx scripts/prepare-e2e-db.ts && pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      SHELL_PREVIEW: "true",
      APP_ENV: "test",
      APP_URL: `http://localhost:${PORT}`,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
    },
  },
});

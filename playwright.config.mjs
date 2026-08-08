import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "artifacts/test-results",
  reporter: "line",
  retries: 0,
  testDir: "apps/web/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3020",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm --filter @moss-mini-demo/web build && pnpm --filter @moss-mini-demo/web exec next start -p 3020",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3020/api/health",
  },
  workers: 1,
});

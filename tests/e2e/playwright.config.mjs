import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error(
    "BASE_URL is required for the external-server E2E smoke test.",
  );
}
new URL(baseURL);

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "../../artifacts/test-results/gate-a-smoke",
  reporter: "line",
  retries: 0,
  testDir: ".",
  testMatch: "**/*.e2e.mjs",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
});

import { defineConfig, devices } from "@playwright/test";
import { STATE } from "./e2e/fixtures";

/**
 * End-to-end tests against a running app. Point E2E_BASE_URL at a dev server
 * that's already up (only one `next dev` may run per folder); without it,
 * Playwright starts `npm run dev` itself. The server needs SMS_DRIVER=console
 * so the sign-in code comes back in development.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Locally the installed Chrome (no browser download); CI installs Playwright's Chromium.
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One test shop and one relay: run in order.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/e2e",
  use: { baseURL, channel, locale: "en-US", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "app", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], channel, storageState: STATE } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});

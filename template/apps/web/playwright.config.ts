import { defineConfig, devices } from "@playwright/test";
import type { ReporterDescription } from "@playwright/test";
import { E2E } from "./tests/e2e.env";

// The e2e dashboard (`scripts/e2e-dashboard.mjs`) drives the run and sets
// E2E_DASH_EVENTS to the NDJSON file its reporter appends to. The dashboard
// owns the UI, so the HTML report is still WRITTEN (the dashboard serves it at
// /report when the run ends) but never auto-opened. Configured here rather
// than as a CLI `--reporter=` flag because the CLI form REPLACES the config's
// reporter list and cannot carry the html options.
const dashboardEvents = process.env.E2E_DASH_EVENTS;
const reporter: ReporterDescription[] = dashboardEvents
  ? [
      ["html", { open: "never" }],
      ["./tests/reporters/dashboard-reporter.ts"],
    ]
  : [["html", { open: "never" }]];

export default defineConfig({
  testDir: "./tests",
  // Generous: a first navigation against a freshly booted stack pays for the
  // api's lazy schema work and the browser's first paint of a heavy route.
  timeout: 120000,
  // The suite shares one seeded database. Parallelism makes it non-deterministic
  // — a spec that reads what another spec wrote then passes or fails on timing
  // rather than on behaviour. Keep both of these as they are.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter,
  // The stack (database + worker + api + web) is owned by scripts/e2e.sh.
  // Playwright NEVER starts servers — there is no webServer block, on purpose.
  // Adding one boots a second, unmigrated stack on top of the real one.
  use: {
    baseURL: E2E.webBase,
    trace: "on-first-retry",
    actionTimeout: 15000,
  },
  projects: [
    // Seeds the fixtures the suite needs (the database itself was already
    // recreated and migrated by scripts/e2e.sh) and saves one storageState per
    // persona. Every other project depends on it, so a scoped run still seeds.
    { name: "setup", testMatch: /setup\/seed\.setup\.ts/ },
    {
      name: "chromium-unauth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testDir: "./tests/unauthenticated",
    },
    {
      name: "chromium-smoke",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
      dependencies: ["setup"],
      testDir: "./tests/smoke",
    },
    // Service-worker tests only. `navigator.serviceWorker` exists ONLY in a
    // secure context — HTTPS, or the literal hostname localhost — and this
    // stack serves plain HTTP on the custom host, so the API is absent there.
    // The same server is reached as http://localhost:<port> instead. Scoped to
    // its own project because sw.ts is a CACHING worker that intercepts
    // fetches; enabling it under every other test would change navigation
    // behaviour they were all verified without.
    {
      name: "chromium-pwa",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: E2E.webBaseLocalhost,
        storageState: "playwright/.auth/admin-localhost.json",
      },
      dependencies: ["setup"],
      testDir: "./tests/pwa",
    },
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
      dependencies: ["setup"],
      testDir: "./tests/authenticated",
    },
  ],
});

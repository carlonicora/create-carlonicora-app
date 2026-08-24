import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./tests/e2e.env";

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
  reporter: [["html", { open: "never" }]],
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
  ],
});

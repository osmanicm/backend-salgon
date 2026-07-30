import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "es-MX",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "setup-agent",
      testMatch: /auth\.agent\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      // El spec de agente corre en su propio proyecto con la sesión del agente
      testIgnore: /leads-agent\.spec\.ts/,
    },
    {
      name: "chromium-agent",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/agent.json",
      },
      dependencies: ["setup-agent"],
      testMatch: /leads-agent\.spec\.ts/,
    },
  ],
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

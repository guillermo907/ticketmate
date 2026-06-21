import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "/private/tmp/foro-gdl-playwright-results",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  use: {
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off"
  },
  projects: [
    {
      name: "theme-panel",
      grep: /@theme-panel/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3100"
      }
    },
    {
      name: "event-poster-flow",
      grep: /@event-poster-flow/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3100"
      }
    },
    {
      name: "security",
      grep: /@security/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3101"
      }
    }
  ],
  webServer: [
    {
      command: "./node_modules/.bin/next start --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: true,
      env: {
        NODE_ENV: "production",
        LOCAL_ADMIN_PREVIEW: "true",
        NEXTAUTH_URL: "http://127.0.0.1:3100",
        AUTH_SECRET: "playwright-local-secret"
      }
    },
    {
      command: "./node_modules/.bin/next start --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: true,
      env: {
        NODE_ENV: "production",
        LOCAL_ADMIN_PREVIEW: "false",
        NEXTAUTH_URL: "http://127.0.0.1:3101",
        AUTH_SECRET: "playwright-local-secret"
      }
    }
  ]
});

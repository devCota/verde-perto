import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/demo",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:4300/verde-perto/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/demo-server.mjs",
    url: "http://127.0.0.1:4300/verde-perto/",
    reuseExistingServer: false,
    timeout: 15000,
  },
});

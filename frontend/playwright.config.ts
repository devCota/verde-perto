import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        (process.platform === "win32"
          ? ".venv/Scripts/python.exe"
          : ".venv/bin/python") +
        " -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: resolve(process.cwd(), "../backend"),
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: "npm start",
      url: "http://127.0.0.1:4200",
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});

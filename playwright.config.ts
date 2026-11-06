import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://localhost:4199", viewport: { width: 1280, height: 800 }, trace: "off" },
  webServer: { command: "npx vite --port 4199 --strictPort", url: "http://localhost:4199", reuseExistingServer: true, timeout: 60_000 },
});

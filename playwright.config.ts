import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Trên máy có sẵn Chromium (vd. môi trường đám mây) thì dùng luôn, không cần `playwright install`
const PRESET = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:4199",
    viewport: { width: 1280, height: 800 },
    trace: "off",
    launchOptions: existsSync(PRESET) ? { executablePath: PRESET } : {},
  },
  webServer: { command: "npx vite --port 4199 --strictPort", url: "http://localhost:4199", reuseExistingServer: true, timeout: 60_000 },
});

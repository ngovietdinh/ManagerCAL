import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Kiểm thử chế độ máy chủ: chạy Worker + D1 tại máy bằng wrangler (CSDL trống mỗi lần chạy).
const PRESET = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e-server",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:8788",
    // E2E_PHONE=1: chạy cùng các luồng ở cỡ điện thoại (npm run test:e2e:server:phone)
    ...(process.env.E2E_PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } }),
    trace: "off",
    launchOptions: existsSync(PRESET) ? { executablePath: PRESET } : {},
  },
  webServer: {
    command: "rm -rf .wrangler/state-e2e && npx vite build && npx wrangler d1 migrations apply managercal --local --persist-to .wrangler/state-e2e && npx wrangler dev --port 8788 --persist-to .wrangler/state-e2e",
    url: "http://localhost:8788/api/health",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

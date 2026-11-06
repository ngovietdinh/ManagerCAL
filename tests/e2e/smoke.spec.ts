import { expect, test } from "@playwright/test";

const PAGES = ["/", "/jobs", "/orders", "/certificates", "/customers", "/devices", "/standards", "/seals", "/catalog", "/staff", "/reports", "/settings", "/audit", "/notifications", "/chat"];

test("đăng nhập demo và mở được mọi trang chính không lỗi JS", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/#/login");
  await page.getByRole("button", { name: /Nguyễn Văn An/ }).click();
  await expect(page).toHaveURL(/#\/$/);
  for (const p of PAGES) {
    await page.goto(`/#${p}`);
    await page.waitForTimeout(400);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("tra cứu GCN công khai", async ({ page }) => {
  await page.goto("/#/lookup");
  await expect(page.locator("body")).toContainText(/Tra cứu/i, { timeout: 20_000 });
});

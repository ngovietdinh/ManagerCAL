import { expect, test, type Page } from "@playwright/test";

// Điện thoại (390 × 844, cảm ứng): không trang nào cuộn ngang; bảng thành thẻ có nhãn;
// kiểm định viên nhập và nộp biên bản ngay trên điện thoại.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function loginAs(page: Page, name: string) {
  await page.goto("/#/login");
  await page.evaluate(() => localStorage.removeItem("managercal.user"));
  await page.reload();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/#\/$/);
}

const PAGES = ["/", "/jobs", "/orders", "/orders/new", "/certificates", "/customers", "/devices", "/standards", "/seals", "/catalog", "/staff", "/reports", "/settings", "/audit", "/notifications", "/chat"];

test("mọi trang vừa khung điện thoại, không cuộn ngang", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loginAs(page, "Nguyễn Văn An");
  for (const p of PAGES) {
    await page.goto("/#" + p);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(600);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw, p).toBeLessThanOrEqual(390);
  }
  // bảng phiếu thành thẻ: tiêu đề cột đọc được ngay trong thẻ
  await page.goto("/#/jobs");
  const card = page.locator("tbody tr").first();
  await expect(card.locator("td.cell-main")).toContainText(/DH\d{4}/);
  await expect(card.locator('td[data-label="Khách hàng"]')).toBeVisible();
  // GCN A4 co vừa màn hình
  await page.goto("/#/certificates");
  await page.locator("tbody tr").first().click();
  const doc = page.getByTestId("cert-doc");
  await expect(doc).toBeVisible();
  const box = await doc.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("KĐV nhập biên bản trên điện thoại: ô nhập 16px, nút lưu/nộp luôn trong tầm tay", async ({ page }) => {
  await loginAs(page, "Lê Minh Cường");
  await page.goto("/#/jobs");
  await page.locator("tr", { hasText: "KCN Tân Phú Thịnh" }).filter({ hasText: "Đã phân công" }).filter({ hasText: "COD" }).first().click();
  await expect(page.locator("h1")).toContainText(/Phiếu DH/);
  const input = page.getByLabel("Điểm 1 (≈ 20 % phạm vi) giá trị chuẩn");
  expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // đang ở giữa biên bản, nút Nộp soát xét vẫn nhìn thấy trong khung
  await input.scrollIntoViewIfNeeded();
  const submit = page.getByRole("button", { name: "Nộp soát xét" });
  const b = (await submit.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(844);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

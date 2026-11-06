import { expect, test, type Page } from "@playwright/test";

// Luồng đầy đủ trên dữ liệu demo, qua ba người với ba vai trò khác nhau:
// KĐV nhập biên bản → người soát xét đồng ý → người ký phát hành GCN có tem → tra cứu công khai.
// Phiếu dùng: thiết bị đo COD trạm nước thải KCN Tân Phú Thịnh, đã phân công cho Lê Minh Cường.

async function loginAs(page: Page, name: string) {
  // đăng xuất chắc chắn (xoá người dùng đã nhớ) rồi mới chọn người
  await page.goto("/#/login");
  await page.evaluate(() => localStorage.removeItem("managercal.user"));
  await page.reload();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/#\/$/);
}

// Điền số liệu biên bản đầu đo COD: điểm "0" đọc 0; ba điểm kiểm đọc đúng giá trị chuẩn (100 / 250 / 400 mg/L);
// lặp lại, độ trôi đọc 250 so với chuẩn 250 → sai số 0, tuyến tính R² = 1.
const valueFor = (label: string) => (/Điểm “0”/.test(label) ? "0" : /Điểm 1/.test(label) ? "100" : /Điểm 3/.test(label) ? "400" : "250");
async function fillRecord(page: Page) {
  await page.getByLabel("Nhiệt độ °C").fill("25");
  await page.getByLabel("Độ ẩm %RH").fill("60");
  const cells = page.locator("input.input-sm");
  await expect(cells.first()).toBeVisible();
  const n = await cells.count();
  expect(n).toBeGreaterThan(10);
  for (let i = 0; i < n; i++) {
    const c = cells.nth(i);
    await c.fill(valueFor((await c.getAttribute("aria-label")) ?? ""));
  }
}

test("KĐV nhập biên bản → soát xét → ký phát hành → tra cứu GCN", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Kiểm định viên
  await loginAs(page, "Lê Minh Cường");
  await page.goto("/#/jobs");
  const row = page.locator("tr", { hasText: "KCN Tân Phú Thịnh" }).filter({ hasText: "Đã phân công" }).filter({ hasText: "COD" }).first();
  await row.click();
  await expect(page).toHaveURL(/#\/jobs\/.+/);
  const jobUrl = page.url();

  // chọn chuẩn, đánh dấu kiểm tra bên ngoài, nhập số liệu
  await page.locator("label", { hasText: "CH-QTN-02" }).locator("input[type=checkbox]").check();
  for (const b of await page.getByRole("button", { name: "Đạt", exact: true }).all()) await b.click();
  await fillRecord(page);
  await expect(page.getByText("Kết luận:")).toBeVisible();
  await page.getByRole("button", { name: "Nộp soát xét" }).click();
  await expect(page.getByText("Đã nộp soát xét")).toBeVisible();

  // 2. Người soát xét
  await loginAs(page, "Phạm Thu Dung");
  await page.goto(jobUrl);
  const review = page.locator("section", { hasText: "Soát xét biên bản" });
  await expect(review.locator("input[type=checkbox]").first()).toBeVisible();
  for (const c of await review.locator("input[type=checkbox]").all()) await c.check();
  await review.getByRole("button", { name: "Đồng ý, chuyển phê duyệt" }).click();
  await expect(page.getByText("Đã chuyển phê duyệt")).toBeVisible();

  // 3. Người ký
  await loginAs(page, "Nguyễn Văn An");
  await page.goto(jobUrl);
  await page.getByRole("button", { name: "Phê duyệt, phát hành" }).click();
  await page.getByRole("button", { name: "Ký và phát hành" }).click();
  await page.getByRole("button", { name: /Xem/ }).last().click();
  await expect(page).toHaveURL(/#\/certificates\/.+/);
  await expect(page.locator(".doc")).toContainText("GIẤY CHỨNG NHẬN KIỂM ĐỊNH");
  await expect(page.locator(".doc")).toContainText("KCN Tân Phú Thịnh");
  const number = (await page.locator(".doc").innerText()).match(/Số:\s*(\S+)/)?.[1];
  expect(number).toBeTruthy();

  // 4. Tra cứu công khai theo số GCN
  await page.goto(`/#/lookup/${encodeURIComponent(number!)}`);
  await expect(page.locator("body")).toContainText(/hợp lệ|còn hiệu lực/i);

  expect(errors).toEqual([]);
});

test("quy tắc chặn: KĐV không chọn được chuẩn quá hạn", async ({ page }) => {
  await loginAs(page, "Trần Thị Bình");
  await page.goto("/#/jobs");
  await page.locator("tr", { hasText: "Bệnh viện Đa khoa Thành An" }).filter({ hasText: "Đã phân công" }).first().click();
  const expired = page.locator("label", { hasText: "CH-QTN-00" });
  await expect(expired).toContainText(/quá hạn|khoá/);
  await expect(expired.locator("input[type=checkbox]")).toBeDisabled();
});

test("tiếp nhận đơn từ thiết bị đã có của khách → sinh phiếu chờ phân công", async ({ page }) => {
  await loginAs(page, "Hoàng Văn Em");
  await page.goto("/#/orders/new?customer=c-5");
  await page.getByRole("button", { name: /Chọn từ thiết bị đã có/ }).click();
  await page.locator("tr", { hasText: "TH-43I-5511" }).click();
  await page.locator("tr", { hasText: "TH-49I-5512" }).click();
  await page.getByRole("button", { name: "Thêm 2 thiết bị" }).click();
  await page.getByRole("button", { name: "Tiếp nhận", exact: true }).click();
  await expect(page).toHaveURL(/#\/orders\/(?!new).+/);
  await expect(page.locator("main")).toContainText("Trung tâm Quan trắc Môi trường tỉnh Thành An");
  await expect(page.locator("main")).toContainText("TH-43I-5511");
  await expect(page.locator("main").getByText("Chờ phân công")).toHaveCount(2);
});

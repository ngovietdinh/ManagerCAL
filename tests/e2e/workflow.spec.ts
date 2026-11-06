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

test("chat nội bộ: nhờ soát xét từ trang phiếu → người nhận thấy ngay ở tab khác, bấm Nhận", async ({ context }) => {
  const errors: string[] = [];
  const a = await context.newPage();
  a.on("pageerror", (e) => errors.push(e.message));
  await loginAs(a, "Lê Minh Cường");
  const b = await context.newPage();
  b.on("pageerror", (e) => errors.push(e.message));
  await loginAs(b, "Phạm Thu Dung");

  // Cường mở phiếu đã phân công, nhờ Dung soát xét
  await a.bringToFront();
  await a.goto("/#/jobs");
  await a.locator("tr", { hasText: "KCN Tân Phú Thịnh" }).filter({ hasText: "Đã phân công" }).filter({ hasText: "COD" }).first().click();
  await expect(a.locator("h1")).toContainText(/Phiếu DH\d{4}-\d{4}-\d{2}/);
  const code = (await a.locator("h1").innerText()).match(/DH\d{4}-\d{4}-\d{2}/)![0];
  await a.getByRole("button", { name: "Nhờ đồng nghiệp" }).click();
  const dlg = a.getByRole("dialog");
  await dlg.getByRole("radio", { name: "Soát xét" }).click();
  await dlg.getByRole("radio", { name: /Phạm Thu Dung/ }).click();
  await dlg.getByRole("button", { name: "Gửi lời nhờ" }).click();
  await expect(a.getByText("Đã nhờ Phạm Thu Dung soát xét")).toBeVisible();

  // Dung (tab khác) thấy tin chưa đọc mà không cần tải lại trang
  await b.bringToFront();
  const chatBtn = b.getByRole("button", { name: /Trao đổi nội bộ, \d+ tin chưa đọc/ });
  await expect(chatBtn).toBeVisible({ timeout: 10_000 });
  await chatBtn.click();
  const panel = b.getByRole("dialog", { name: "Trao đổi nội bộ" });
  await panel.getByRole("button", { name: /Lê Minh Cường/ }).click();
  await expect(panel.getByText(`Nhờ anh/chị soát xét giúp phiếu ${code} với ạ.`, { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Nhận", exact: true }).last().click();
  await expect(panel.getByText(/Đã nhận, mình xem ngay/).last()).toBeVisible();

  // Cường thấy trả lời; gõ mã phiếu trong tin → thành thẻ trích dẫn
  await a.bringToFront();
  const pa = a.getByRole("dialog", { name: "Trao đổi nội bộ" });
  await expect(pa.getByText(/Đã nhận, mình xem ngay/).last()).toBeVisible({ timeout: 10_000 });
  await pa.getByLabel("Nội dung tin nhắn").fill(`Cảm ơn chị, phiếu ${code} em nộp rồi ạ`);
  await a.keyboard.press("Enter");
  await expect(pa.getByRole("link", { name: new RegExp(code) }).last()).toBeVisible();
  expect(errors).toEqual([]);
});

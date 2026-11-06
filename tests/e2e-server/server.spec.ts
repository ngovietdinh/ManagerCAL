import { expect, test, type Page } from "@playwright/test";

// Chạy tuần tự: khởi tạo hệ thống một lần rồi các bước sau dùng chung CSDL.
test.describe.configure({ mode: "serial" });

const ADMIN = { name: "Nguyễn Văn An", email: "giamdoc@congty.vn" };
const PW = "Matkhau-2026";

async function login(page: Page, email: string) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(PW);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/$/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/#\/login/);
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

let jobUrl = "";
let certNumber = "";

test("khởi tạo hệ thống lần đầu với dữ liệu mẫu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Khởi tạo hệ thống")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Tên công ty").fill("Công ty Kiểm định Thử");
  await page.getByLabel("Họ tên quản trị *").fill(ADMIN.name);
  await page.getByLabel("Email đăng nhập *").fill(ADMIN.email);
  await page.getByLabel("Mật khẩu * (ít nhất 8 ký tự)").fill(PW);
  await page.getByLabel("Nhập lại mật khẩu *").fill(PW);
  await page.getByText("Nạp dữ liệu mẫu để dùng thử").click();
  await page.getByRole("button", { name: "Khởi tạo và đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("Việc của tôi");
  await expect(page.locator("header").first()).not.toContainText("Chế độ demo");
});

test("sai mật khẩu bị từ chối", async ({ page }) => {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Sai email hoặc mật khẩu.")).toBeVisible();
});

test("KĐV nhập biên bản và nộp → dữ liệu lưu trên máy chủ", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "cuong@kdqtviet.vn");
  await page.goto("/#/jobs");
  await page.locator("tr", { hasText: "KCN Tân Phú Thịnh" }).filter({ hasText: "Đã phân công" }).filter({ hasText: "COD" }).first().click();
  await expect(page).toHaveURL(/#\/jobs\/.+/);
  jobUrl = page.url();
  await page.locator("label", { hasText: "CH-QTN-02" }).locator("input[type=checkbox]").check();
  await expect(page.getByRole("button", { name: "Đạt", exact: true }).first()).toBeVisible();
  for (const b of await page.getByRole("button", { name: "Đạt", exact: true }).all()) await b.click();
  await fillRecord(page);
  await page.getByRole("button", { name: "Nộp soát xét" }).click();
  await expect(page.getByText("Đã nộp soát xét")).toBeVisible();
  expect(errors).toEqual([]);
});

test("trình duyệt khác (người soát xét) thấy ngay phiếu vừa nộp và đồng ý", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, "dung@kdqtviet.vn");
  await page.goto(jobUrl.replace(/^.*#/, "/#"));
  await expect(page.locator("main")).toContainText("Chờ soát xét");
  const review = page.locator("section", { hasText: "Soát xét biên bản" });
  await expect(review.locator("input[type=checkbox]").first()).toBeVisible();
  for (const c of await review.locator("input[type=checkbox]").all()) await c.check();
  await review.getByRole("button", { name: "Đồng ý, chuyển phê duyệt" }).click();
  await expect(page.getByText("Đã chuyển phê duyệt")).toBeVisible();
  await ctx.close();
});

test("giám đốc ký phát hành GCN có tem", async ({ page }) => {
  await login(page, ADMIN.email);
  await page.goto(jobUrl.replace(/^.*#/, "/#"));
  await page.getByRole("button", { name: "Phê duyệt, phát hành" }).click();
  await page.getByRole("button", { name: "Ký và phát hành" }).click();
  await page.getByRole("button", { name: /Xem/ }).last().click();
  await expect(page).toHaveURL(/#\/certificates\/.+/);
  await expect(page.locator(".doc")).toContainText("GIẤY CHỨNG NHẬN KIỂM ĐỊNH");
  await expect(page.locator(".doc")).toContainText("Công ty Kiểm định Thử");
  // phiếu làm tại hiện trường → nơi kiểm định là địa chỉ khách
  await expect(page.locator(".doc")).toContainText("Nơi kiểm địnhKCN Tân Phú Thịnh", { useInnerText: false });
  certNumber = (await page.locator(".doc").innerText()).match(/Số:\s*(\S+)/)![1];
  await logout(page);
});

test("tra cứu công khai không cần đăng nhập", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/#/lookup/${encodeURIComponent(certNumber)}`);
  await expect(page.locator("body")).toContainText(/hợp lệ, còn hiệu lực/i, { timeout: 20_000 });
  await ctx.close();
});

test("quản trị đặt mật khẩu cho nhân viên mới, nhân viên đăng nhập được", async ({ page }) => {
  await login(page, ADMIN.email);
  await page.goto("/#/staff");
  await page.getByRole("button", { name: "Thêm nhân sự" }).click();
  const dlg = page.locator("[class*='max-h-[92vh]']").last();
  await dlg.getByLabel("Mã nhân viên").fill("NV99");
  await dlg.getByLabel("Họ tên").fill("Ngô Thị Mới");
  await dlg.getByLabel("Email").fill("moi@congty.vn");
  await dlg.getByText("Kiểm định viên", { exact: true }).click();
  await dlg.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đặt mật khẩu cho Ngô Thị Mới")).toBeVisible();
  await page.getByLabel("Mật khẩu mới (ít nhất 8 ký tự)").fill(PW);
  await page.getByLabel("Nhập lại mật khẩu mới").fill(PW);
  await page.getByRole("button", { name: "Lưu mật khẩu" }).click();
  await expect(page.getByText("Đã đặt mật khẩu cho Ngô Thị Mới")).toBeVisible();
  await logout(page);
  await login(page, "moi@congty.vn");
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await expect(page.locator("header").getByText("Ngô Thị Mới")).toBeVisible();
});

import { beforeAll, describe, expect, it } from "vitest";
import { handleApi } from "../../worker/api";
import { createD1 } from "./d1shim";
import { genReadings } from "@/lib/seed/demo";

const db = createD1();
const env = { DB: db };
const BASE = "https://mc.test";

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await handleApi(new Request(BASE + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }), env);
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, body: await res.json() as Record<string, any>, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}
const rpc = (cookie: string, method: string, ...args: unknown[]) => call("/api/rpc", { body: { method, args }, cookie });

let admin = "";   // Nguyễn Văn An: quản trị + ký
let binh = "";    // KĐV
let dung = "";    // soát xét + ký
let em = "";      // tiếp nhận
const PW = "matkhau-thu-123";

beforeAll(async () => {
  const h = await call("/api/health");
  expect(h.body.needsSetup).toBe(true);
  const s = await call("/api/setup", { body: { company_name: "Công ty Thử", full_name: "Nguyễn Văn An", email: "an@thu.vn", password: PW, demo: true } });
  expect(s.status).toBe(200);
  admin = s.cookie!;
  for (const [email, set] of [["binh@kdqtviet.vn", (c: string) => (binh = c)], ["dung@kdqtviet.vn", (c: string) => (dung = c)], ["em@kdqtviet.vn", (c: string) => (em = c)]] as const) {
    const r = await call("/api/login", { body: { email, password: PW } });
    expect(r.status).toBe(200);
    set(r.cookie!);
  }
}, 60_000);

describe("khởi tạo, đăng nhập", () => {
  it("không khởi tạo lại được", async () => {
    expect((await call("/api/health")).body.needsSetup).toBe(false);
    expect((await call("/api/setup", { body: { full_name: "X", email: "x@x.vn", password: "12345678" } })).status).toBe(403);
  });
  it("sai mật khẩu bị từ chối; chưa đăng nhập không đọc được dữ liệu", async () => {
    expect((await call("/api/login", { body: { email: "an@thu.vn", password: "sai-mat-khau" } })).status).toBe(400);
    expect((await call("/api/data/customers")).status).toBe(401);
  });
  it("đọc dữ liệu demo đã nạp vào D1", async () => {
    const me = await call("/api/me", { cookie: admin });
    expect(me.body.user.full_name).toBe("Nguyễn Văn An");
    const settings = await call("/api/data/settings/1", { cookie: admin });
    expect(settings.body.row.company.name).toBe("Công ty Thử");
    const certs = await call("/api/data/certificates", { cookie: admin });
    expect(certs.body.rows.length).toBeGreaterThan(5);
    const q = encodeURIComponent(JSON.stringify({ where: { status: "received" } }));
    const jobs = await call(`/api/data/jobs?q=${q}`, { cookie: admin });
    expect(jobs.body.rows.length).toBeGreaterThan(0);
    expect(jobs.body.rows.every((j: { status: string }) => j.status === "received")).toBe(true);
  });
  it("KĐV không xem được nhật ký; chỉ thấy thông báo của mình", async () => {
    expect((await call("/api/data/audit_logs", { cookie: binh })).status).toBe(403);
    const n = await call("/api/data/notifications", { cookie: binh });
    const me = (await call("/api/me", { cookie: binh })).body.user;
    expect(n.body.rows.every((x: { user_id: string | null }) => x.user_id === me.id || x.user_id === null)).toBe(true);
  });
});

describe("luồng nghiệp vụ qua API (quy tắc kiểm tra trên máy chủ)", () => {
  it("tiếp nhận → phân công → nhập biên bản → soát xét → ký phát hành, số GCN và tem đúng", async () => {
    // tiếp nhận lại đầu đo pH của Giấy Sông Lam (kiểm định sau sửa chữa)
    const order = await rpc(em, "createOrder", {
      customer_id: "c-1", branch_id: "br-hn", received_at: "2026-11-06", expected_at: "2026-11-10", onsite: false,
      contact_name: null, contact_phone: null, note: null,
      items: [{ device_id: "d-1-ph", kind: "periodic", price: 350000, priority: "normal", intake: { condition: "Tốt", accessories: "", note: "" } }],
    });
    expect(order.status).toBe(200);
    const jobId = order.body.result.jobs[0].id;

    // KĐV không có quyền phân công
    expect((await rpc(binh, "assignJob", jobId, { assignee_id: "u-binh", reviewer_id: null, due_date: null, priority: "normal" })).status).toBe(403);
    expect((await rpc(dung, "assignJob", jobId, { assignee_id: "u-binh", reviewer_id: null, due_date: null, priority: "normal" })).status).toBe(200);

    // số liệu: lấy mẫu biên bản đầu đo pH (ĐLVN 381:2021), số đọc trong sai số cho phép
    const proc = (await call("/api/data/procedures/pr-qt-ph", { cookie: binh })).body.row;
    const readings = genReadings(proc.template);
    const env_ = { temp: 24, humidity: 55, pressure: null };
    // chuẩn quá hạn → máy chủ chặn khi nộp
    expect((await rpc(binh, "saveReadings", jobId, { env: env_, readings, standard_ids: ["s-ph-cu", "s-bath"], performed_at: "2026-11-06", performed_note: null })).status).toBe(200);
    const blocked = await rpc(binh, "submitForReview", jobId);
    expect(blocked.body.error.code).toBe("STANDARD_UNUSABLE");
    // chuẩn còn hạn → nộp được
    expect((await rpc(binh, "saveReadings", jobId, { env: env_, readings, standard_ids: ["s-ph", "s-bath"], performed_at: "2026-11-06", performed_note: null })).status).toBe(200);
    expect((await rpc(binh, "submitForReview", jobId)).status).toBe(200);

    // KĐV không tự soát xét được
    expect((await rpc(binh, "reviewJob", jobId, { ok: true, note: null, checks: {} })).status).toBe(403);
    expect((await rpc(dung, "reviewJob", jobId, { ok: true, note: null, checks: {} })).status).toBe(200);

    // ký phát hành
    const before = (await call("/api/data/certificates", { cookie: admin })).body.rows.length;
    const issued = await rpc(admin, "approveAndIssue", jobId, { issued_at: "2026-11-06", seal_no: "KĐV-000040", place: "Phòng thí nghiệm" });
    expect(issued.status).toBe(200);
    const cert = issued.body.result.certificate;
    expect(cert.kind).toBe("certificate");
    expect(cert.seal_no).toBe("KĐV-000040");
    const after = (await call("/api/data/certificates", { cookie: admin })).body.rows;
    expect(after.length).toBe(before + 1);
    expect(new Set(after.map((c: { number: string }) => c.number)).size).toBe(after.length);
    const seal = (await call(`/api/data/seals?q=${encodeURIComponent(JSON.stringify({ where: { number: "KĐV-000040" } }))}`, { cookie: admin })).body.rows[0];
    expect(seal.status).toBe("used");
    const dev = (await call("/api/data/devices/d-1-ph", { cookie: admin })).body.row;
    expect(dev.next_due).toBe(cert.valid_to);

    // tra cứu công khai, không cần đăng nhập
    const pub = await call(`/api/lookup/${encodeURIComponent(cert.number)}`);
    expect(pub.body.certificate.status).toBe("valid");
    expect(pub.body.certificate.snapshot.readings).toBeUndefined();
  }, 30_000);

  it("thao tác lỗi giữa chừng không ghi gì (nguyên tử)", async () => {
    const n0 = (db.raw.prepare("SELECT COUNT(*) AS n FROM rows WHERE tbl='orders'").get() as { n: number }).n;
    const r = await rpc(em, "createOrder", {
      customer_id: "c-1", branch_id: "br-hn", received_at: "2026-11-06", expected_at: null, onsite: false, contact_name: null, contact_phone: null, note: null,
      items: [{ device_id: "d-1-ph", kind: "periodic", price: 1, priority: "normal", intake: { condition: "", accessories: "", note: "" } }, { device_id: "khong-ton-tai", kind: "periodic", price: 1, priority: "normal", intake: { condition: "", accessories: "", note: "" } }],
    });
    expect(r.status).toBe(404);
    const n1 = (db.raw.prepare("SELECT COUNT(*) AS n FROM rows WHERE tbl='orders'").get() as { n: number }).n;
    expect(n1).toBe(n0);
  });

  it("chỉ thao tác trong danh sách mới gọi được", async () => {
    expect((await rpc(admin, "repo", "x")).status).toBe(400);
    expect((await rpc(admin, "constructor")).status).toBe(400);
  });

  it("đổi mật khẩu, đăng xuất", async () => {
    expect((await call("/api/password", { body: { password: "mat-khau-moi-1", current: "sai" }, cookie: binh })).status).toBe(400);
    expect((await call("/api/password", { body: { user_id: "u-an", password: "mat-khau-moi-1" }, cookie: binh })).status).toBe(403);
    expect((await call("/api/password", { body: { password: "mat-khau-moi-1", current: PW }, cookie: binh })).status).toBe(200);
    expect((await call("/api/login", { body: { email: "binh@kdqtviet.vn", password: "mat-khau-moi-1" } })).status).toBe(200);
    await call("/api/logout", { body: {}, cookie: binh });
    expect((await call("/api/me", { cookie: binh })).status).toBe(401);
  });

  it("sao lưu và khôi phục", async () => {
    const b = await call("/api/backup", { cookie: admin });
    expect(b.body.data.jobs.length).toBeGreaterThan(10);
    const r = await call("/api/restore", { body: b.body, cookie: admin });
    expect(r.status).toBe(200);
    const again = await call("/api/backup", { cookie: admin });
    expect(again.body.data.jobs.length).toBe(b.body.data.jobs.length);
    expect(again.body.seq).toEqual(b.body.seq);
  });
});

describe("giới hạn D1 gói miễn phí: ≤ 50 truy vấn mỗi lượt gọi", () => {
  const measure = async (fn: () => Promise<unknown>) => { const c0 = db.count; await fn(); return db.count - c0; };
  it("các thao tác nặng nhất", async () => {
    const counts: Record<string, number> = {};
    counts.list_jobs = await measure(() => call("/api/data/jobs", { cookie: admin }));
    counts.daily = await measure(() => rpc(admin, "runDailyChecks"));
    // đơn 40 thiết bị
    const devs = (await call(`/api/data/devices?q=${encodeURIComponent(JSON.stringify({ where: { customer_id: "c-5" } }))}`, { cookie: admin })).body.rows as { id: string }[];
    const items = Array.from({ length: 40 }, (_, i) => ({ device_id: devs[i % devs.length].id, kind: "periodic", price: 1, priority: "normal", intake: { condition: "", accessories: "", note: "" } }));
    counts.order40 = await measure(() => rpc(em, "createOrder", { customer_id: "c-5", branch_id: "br-hn", received_at: "2026-11-06", expected_at: null, onsite: false, contact_name: null, contact_phone: null, note: null, items }));
    const job = (await call(`/api/data/jobs?q=${encodeURIComponent(JSON.stringify({ where: { status: "approval" } }))}`, { cookie: admin })).body.rows[0];
    counts.issue = await measure(() => rpc(admin, "approveAndIssue", job.id, { issued_at: "2026-11-06", seal_no: null, place: "x" }));
    counts.sealBatch = await measure(() => rpc(dung, "createSealBatch", { prefix: "B2-", from_no: 1, to_no: 2000, received_at: "2026-11-06", note: null }));
    console.log("số truy vấn D1:", counts);
    for (const v of Object.values(counts)) expect(v).toBeLessThanOrEqual(45);
  }, 60_000);
});

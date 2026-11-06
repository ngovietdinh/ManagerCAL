// Đo thực nghiệm dung lượng trên SQLite (cùng lược đồ, chỉ mục với D1) để kiểm chứng công thức dự báo "bao lâu thì đầy".
import { describe, expect, it } from "vitest";
import { handleApi } from "../../worker/api";
import { D1Repo } from "../../worker/d1repo";
import { Services } from "@/lib/services";
import { demoUsers, genReadings } from "@/lib/seed/demo";
import { analyzeStorage, monthsUntilFull, FREE_LIMIT, type StorageInfo } from "@/lib/storage";
import type { User } from "@/lib/types";
import { createD1 } from "./d1shim";

const USERS = demoUsers();

describe("dự báo dung lượng", () => {
  it("công thức: đầy sau (giới hạn − hiện có) / (byte mỗi tháng × hệ số chỉ mục)", () => {
    const info: StorageInfo = { size_bytes: 2_000_000, limit_bytes: FREE_LIMIT, tables: [
      { tbl: "jobs", n: 100, bytes: 300_000, n30: 100, bytes30: 300_000, n90: 100 },
      { tbl: "certificates", n: 100, bytes: 500_000, n30: 100, bytes30: 500_000, n90: 100 },
      { tbl: "chat_messages", n: 0, bytes: 0, n30: 0, bytes30: 0, n90: 0 },
    ] };
    const a = analyzeStorage(info);
    expect(a.perJob).toBe(8000);
    expect(a.overhead).toBeCloseTo(2.5);
    expect(monthsUntilFull(a, FREE_LIMIT, 1000, 0)).toBeCloseTo((FREE_LIMIT - 2_000_000) / (8000 * 1000 * 2.5), 3);
  });

  it("đo thật: 60 phiếu trọn vòng đời + 600 tin nhắn, ước tính khớp mức tăng thật ±35 %", async () => {
    const db = createD1();
    const env = { DB: db };
    const setup = await handleApi(new Request("https://mc.test/api/setup", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ company_name: "Đo", full_name: "Giám đốc", email: "gd@do.vn", password: "matkhau-123", demo: true }) }), env);
    expect(setup.status).toBe(200);
    const size = () => {
      const r = db.raw.prepare("SELECT page_count * page_size AS s FROM pragma_page_count(), pragma_page_size()").get() as { s: number };
      return r.s;
    };
    const stats = (): StorageInfo => {
      const rows = db.raw.prepare("SELECT tbl, COUNT(*) AS n, SUM(length(data)) AS bytes FROM rows GROUP BY tbl").all() as { tbl: string; n: number; bytes: number }[];
      return { size_bytes: size(), limit_bytes: FREE_LIMIT, tables: rows.map((r) => ({ ...r, n30: r.n, bytes30: r.bytes, n90: r.n })) };
    };
    const run = async <T>(uid: string, fn: (s: Services) => Promise<T>): Promise<T> => {
      const repo = new D1Repo(db);
      const s = new Services(repo, () => USERS.find((u) => u.id === uid) as User);
      const r = await fn(s);
      await repo.commit();
      return r;
    };
    const before = stats();
    const a0 = analyzeStorage(before);
    const proc = (await new D1Repo(db).get("procedures", "pr-qt-ph"))!;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const { order, jobs } = await run("u-em", (s) => s.createOrder({ customer_id: "c-1", branch_id: "br-hn", received_at: "2026-11-06", expected_at: null, onsite: true, contact_name: null, contact_phone: null, note: null,
        items: [{ device_id: "d-1-ph", kind: "periodic", price: 1200000, priority: "normal", intake: { condition: "Bình thường", accessories: "", note: "" } }] }));
      const id = jobs[0].id;
      await run("u-dung", (s) => s.assignJob(id, { assignee_id: "u-binh", reviewer_id: null, due_date: null, priority: "normal" }));
      await run("u-binh", (s) => s.saveReadings(id, { env: { temp: 24, humidity: 60, pressure: null }, readings: genReadings(proc.template), standard_ids: ["s-ph", "s-bath"], performed_at: "2026-11-06", performed_note: null }));
      await run("u-binh", (s) => s.submitForReview(id));
      await run("u-dung", async (s) => s.reviewJob(id, { ok: true, note: null, checks: Object.fromEntries((await s.settings()).review.checklist.map((_, k) => [String(k), true])) }));
      await run("u-an", (s) => s.approveAndIssue(id, { issued_at: "2026-11-06", seal_no: null, place: "Trạm" }));
      await run("u-em", (s) => s.returnDevice(id, "2026-11-06"));
      await run("u-giang", (s) => s.setOrderPaid(order.id, true, "2026-11-06"));
      for (let k = 0; k < 10; k++) await run(k % 2 ? "u-binh" : "u-dung", (s) => s.chatSend({ channel: "dm:u-binh:u-dung", text: "Phiếu này em đo xong rồi, chị soát xét giúp em với nhé, khách hẹn chiều nay lấy." }));
    }
    const after = stats();
    const grew = after.size_bytes! - before.size_bytes!;
    const a1 = analyzeStorage(after);
    const predicted = (a1.perJob * N + a1.perMsg * N * 10) * a1.overhead;
    const per = Object.fromEntries(after.tables.map((t) => [t.tbl, Math.round((t.bytes - (before.tables.find((x) => x.tbl === t.tbl)?.bytes ?? 0)) / N)]).filter(([, v]) => (v as number) > 0));
    console.log("byte tăng mỗi phiếu theo bảng:", per);
    console.log("đo dung lượng:", { truoc: before.size_bytes, sau: after.size_bytes, tang_moi_phieu_kem_10_tin: Math.round(grew / N), du_bao: Math.round(predicted / N), byte_moi_phieu: Math.round(a1.perJob), byte_moi_tin: Math.round(a1.perMsg), he_so: a1.overhead.toFixed(2), he_so_luc_dau: a0.overhead.toFixed(2) });
    expect(predicted / grew).toBeGreaterThan(0.65);
    expect(predicted / grew).toBeLessThan(1.35);
  }, 120_000);
});

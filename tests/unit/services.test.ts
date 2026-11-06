import { beforeAll, describe, expect, it } from "vitest";
import { LocalRepo } from "@/lib/store/local";
import { Services } from "@/lib/services";
import { seedDemo, demoUsers, genReadings } from "@/lib/seed/demo";
const DEMO_USERS = demoUsers();
import type { User } from "@/lib/types";

let repo: LocalRepo;
let current: User | null = null;
let svc: Services;
const as = (id: string) => { current = DEMO_USERS.find((u) => u.id === id)!; };

beforeAll(async () => {
  repo = new LocalRepo({ memoryOnly: true });
  await seedDemo(repo);
  svc = new Services(repo, () => current);
});

describe("dữ liệu demo", () => {
  it("có đơn hàng, phiếu ở nhiều trạng thái, GCN và thông báo không đạt", async () => {
    const jobs = await repo.list("jobs");
    const statuses = new Set(jobs.map((j) => j.status));
    for (const s of ["received", "assigned", "in_progress", "review", "approval", "issued", "returned"]) expect(statuses.has(s as never)).toBe(true);
    const certs = await repo.list("certificates");
    expect(certs.some((c) => c.kind === "certificate")).toBe(true);
    expect(certs.some((c) => c.kind === "fail_notice")).toBe(true);
    // số GCN không trùng
    expect(new Set(certs.map((c) => c.number)).size).toBe(certs.length);
    expect(certs[0].number).toMatch(/^\d{5}\/\d{2}\/KĐ-HN$/);
  });
  it("chuẩn quá hạn bị khoá tự động", async () => {
    const s = await repo.get("standards", "s-ph-cu");
    expect(s?.status).toBe("locked");
  });
  it("GCN đạt có hạn = ngày cấp + chu kỳ − 1 ngày và cập nhật hạn thiết bị", async () => {
    const cert = (await repo.list("certificates")).find((c) => c.kind === "certificate" && c.snapshot.procedure?.doc_kind !== "ra_report")!;
    const dev = await repo.get("devices", cert.device_id);
    expect(dev?.next_due).toBe(cert.valid_to);
    expect(cert.seal_no).toMatch(/^KĐV-\d{6}$/);
    const seal = (await repo.list("seals", { where: { number: cert.seal_no! } }))[0];
    expect(seal.status).toBe("used");
  });
});

describe("quy tắc chặn cứng", () => {
  it("không phân công người chưa có ủy quyền lĩnh vực", async () => {
    as("u-dung");
    const job = (await repo.list("jobs", { where: { status: "received" } })).find((j) => j.instrument_type_id === "it-qt-gas")!;
    // u-binh chỉ có ủy quyền quan trắc nước; phiếu bộ phân tích khí thải → chặn
    await expect(svc.assignJob(job.id, { assignee_id: "u-binh", reviewer_id: null, due_date: null, priority: "normal" })).rejects.toMatchObject({ code: "NOT_AUTHORIZED_PERFORM" });
  });
  it("người soát xét phải khác người thực hiện", async () => {
    // u-cuong vừa là kiểm định viên vừa có quyền soát xét: tự soát phiếu mình làm → chặn
    const job = (await repo.list("jobs", { where: { status: "assigned", assignee_id: "u-cuong" } })).find((j) => j.instrument_type_id === "it-qt-cod")!;
    const proc = (await repo.get("procedures", "pr-qt-cod"))!;
    as("u-cuong");
    await svc.saveReadings(job.id, { env: { temp: 24, humidity: 55, pressure: null }, readings: genReadings(proc.template), standard_ids: ["s-cod"], performed_at: "2026-11-05", performed_note: null });
    await svc.submitForReview(job.id);
    await expect(svc.reviewJob(job.id, { ok: true, note: null, checks: {} })).rejects.toMatchObject({ code: "REVIEWER_IS_PERFORMER" });
  });
  it("không nộp soát xét khi chuẩn quá hạn", async () => {
    as("u-dung");
    // phiếu đầu đo pH bị trả lại sau soát xét, KĐV đo lại bằng lô dung dịch chuẩn đã hết hạn
    const job = (await repo.list("jobs", { where: { status: "in_progress" } })).find((j) => j.instrument_type_id === "it-qt-ph")!;
    const proc = (await repo.get("procedures", "pr-qt-ph"))!;
    as(job.assignee_id!);
    await svc.saveReadings(job.id, { env: { temp: 24, humidity: 55, pressure: null }, readings: genReadings(proc.template), standard_ids: ["s-ph-cu", "s-bath"], performed_at: "2026-11-05", performed_note: null });
    await expect(svc.submitForReview(job.id)).rejects.toMatchObject({ code: "STANDARD_UNUSABLE" });
  });
  it("GCN đã phát hành chỉ thay thế hoặc thu hồi, bản cũ đổi trạng thái", async () => {
    as("u-an");
    const cert = (await repo.list("certificates", { where: { kind: "certificate", status: "valid" } }))[0];
    const rep = await svc.replaceCertificate(cert.id, { reason: "Sai địa chỉ khách", customer: { address: "Địa chỉ mới" } });
    expect(rep.replaces_id).toBe(cert.id);
    expect(rep.snapshot.customer.address).toBe("Địa chỉ mới");
    expect(rep.snapshot.result).toEqual(cert.snapshot.result);
    expect((await repo.get("certificates", cert.id))?.status).toBe("replaced");
    await expect(svc.revokeCertificate(cert.id, "x")).rejects.toMatchObject({ code: "CERT_NOT_VALID" });
    await svc.revokeCertificate(rep.id, "Phát hiện sai số liệu");
    expect((await repo.get("certificates", rep.id))?.status).toBe("revoked");
  });
  it("người không có quyền ký không phát hành được", async () => {
    as("u-em");
    const job = (await repo.list("jobs", { where: { status: "approval" } }))[0];
    await expect(svc.approveAndIssue(job.id, { issued_at: "2026-11-06", seal_no: null, place: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

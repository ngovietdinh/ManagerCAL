// =============================================================================
// LỚP NGHIỆP VỤ – mọi thao tác làm thay đổi dữ liệu đi qua đây.
// Quy tắc chặn cứng (mục 8 kế hoạch) nằm ở đây; giao diện chỉ gọi hàm.
// =============================================================================
import { checkEnv, evaluate, sameResult, sha256Hex } from "../calc";
import { dayjs, todayStr } from "../format";
import { can, type Action } from "../perm";
import type {
  AuthRole, Authorization, CertSnapshot, Certificate, Customer, Device, Field, InstrumentType, Job, JobHistory, JobKind,
  Notification, Order, Procedure, Readings, Role, Row, Seal, SealBatch, Settings, Standard, TableName, User,
} from "../types";
import type { Repo } from "../store/repo";
import { chatAnswer, chatList, chatRead, chatSend, chatSummary, type ChatSendInput, type ChatSummaryItem } from "./chat";
import type { ChatAsk, ChatMessage } from "../types";
import { AppError, newId, nowIso } from "../store/repo";

class BizError extends AppError {
  details: Record<string, unknown>;
  constructor(code: string, details: Record<string, unknown> | string = {}) {
    super(code, typeof details === "string" ? details : undefined);
    this.details = typeof details === "string" ? {} : details;
  }
}

export interface NewOrderItem {
  device_id?: string;                      // thiết bị đã có
  device?: Omit<Device, "id" | "customer_id" | "created_at" | "next_due" | "last_cert_id" | "last_result" | "status">; // thiết bị mới
  kind: JobKind;
  price: number;
  priority: Priority;
  intake: Job["intake"];
}
type Priority = Job["priority"];

export class Services {
  constructor(public repo: Repo, private currentUser: () => User | null) {}

  // ---------------------------------------------------------------------------
  // Tiện ích chung
  // ---------------------------------------------------------------------------
  me(): User {
    const u = this.currentUser();
    if (!u) throw new BizError("FORBIDDEN");
    if (!u.active) throw new BizError("INACTIVE_USER");
    return u;
  }
  require(action: Action) {
    const u = this.me();
    if (!can(u, action)) throw new BizError("FORBIDDEN");
    return u;
  }

  async settings(): Promise<Settings> {
    const s = await this.repo.get("settings", "1");
    if (!s) throw new BizError("NOT_FOUND");
    return s;
  }

  /**
   * Nhật ký: ai, lúc nào, trước, sau. Khi sửa chỉ ghi các trường THỰC SỰ đổi (không chép lại cả phiếu kèm
   * số liệu ở mỗi bước – trước đây chiếm ~85 % dung lượng CSDL). Lịch sử bước của phiếu đã nằm trong phiếu;
   * nội dung GCN (snapshot) không đổi sau phát hành nên không chép vào nhật ký.
   */
  private async audit(action: string, table: TableName, row_id: string, before: unknown, after: unknown) {
    const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
    const SKIP = new Set(["history", "snapshot"]);
    let b = before, a = after;
    if (obj(before) && obj(after)) {
      const nb: Record<string, unknown> = {}, na: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (SKIP.has(k) || JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
        nb[k] = before[k]; na[k] = after[k];
      }
      b = nb; a = na;
    } else {
      const strip = (v: unknown) => (obj(v) && "snapshot" in v ? Object.fromEntries(Object.entries(v).filter(([k]) => !SKIP.has(k))) : v);
      b = strip(before); a = strip(after);
    }
    await this.repo.insert("audit_logs", { id: newId(), user_id: this.currentUser()?.id ?? null, action, table, row_id, before: b, after: a, created_at: nowIso() });
  }

  /** Tạo dòng mới có kiểm tra quyền + nhật ký */
  async create<T extends TableName>(action: Action, table: T, row: Omit<Row<T>, "id" | "created_at">): Promise<Row<T>> {
    this.require(action);
    if (table.startsWith("chat_")) throw new BizError("FORBIDDEN");
    const full = { ...row, id: newId(), created_at: nowIso() } as Row<T>;
    const saved = await this.repo.insert(table, full);
    await this.audit("create", table, saved.id, null, saved);
    return saved;
  }

  async patch<T extends TableName>(action: Action, table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    this.require(action);
    if (table.startsWith("chat_")) throw new BizError("FORBIDDEN");
    const before = await this.repo.get(table, id);
    if (!before) throw new BizError("NOT_FOUND");
    const after = await this.repo.update(table, id, patch);
    await this.audit("update", table, id, before, after);
    return after;
  }

  async delete<T extends TableName>(action: Action, table: T, id: string): Promise<void> {
    this.require(action);
    if (table.startsWith("chat_")) throw new BizError("FORBIDDEN");
    const before = await this.repo.get(table, id);
    if (!before) return;
    await this.repo.remove(table, id);
    await this.audit("delete", table, id, before, null);
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.patch("settings", "settings", "1", { ...patch, updated_at: nowIso() });
  }

  /** Đánh số theo mẫu: {YYYY} {YY} {MM} {SEQ} {SEQ:n} {BR} {FIELD} */
  formatNumber(pattern: string, seq: number, ctx: { date?: string; branch?: string; field?: string } = {}): string {
    const d = dayjs(ctx.date ?? todayStr());
    return pattern
      .replace(/\{SEQ:(\d+)\}/g, (_, n) => String(seq).padStart(Number(n), "0"))
      .replace(/\{SEQ\}/g, String(seq))
      .replace(/\{YYYY\}/g, d.format("YYYY"))
      .replace(/\{YY\}/g, d.format("YY"))
      .replace(/\{MM\}/g, d.format("MM"))
      .replace(/\{BR\}/g, ctx.branch ?? "")
      .replace(/\{FIELD\}/g, ctx.field ?? "");
  }

  async nextCode(prefix: string, width = 4, scope = ""): Promise<string> {
    const n = await this.repo.nextSequence(`${prefix}${scope}`);
    return `${prefix}${scope ? scope + "-" : "-"}${String(n).padStart(width, "0")}`;
  }

  /** opts.email: việc giao cho người nhận → máy chủ gửi kèm email (khi đã cấu hình) */
  async notify(targets: { user_ids?: string[]; roles?: Role[]; all?: boolean }, title: string, body: string | null, link: string | null, opts: { email?: boolean } = {}) {
    const ids = new Set<string>(targets.user_ids ?? []);
    if (targets.roles?.length) {
      const users = await this.repo.list("users", { where: { active: true } as Partial<User> });
      for (const u of users) if (u.roles.some((r) => targets.roles!.includes(r))) ids.add(u.id);
    }
    const me = this.currentUser()?.id;
    const rows: Notification[] = (targets.all ? [null] : [...ids].filter((id) => id !== me)).map((user_id) => ({
      id: newId(), user_id, title, body, link, read: false, created_at: nowIso(), ...(opts.email && user_id ? { email: true } : {}),
    }));
    for (const r of rows) await this.repo.insert("notifications", r);
  }

  // ---------------------------------------------------------------------------
  // Ủy quyền, chuẩn
  // ---------------------------------------------------------------------------
  async isAuthorized(user_id: string, field_id: string, role: AuthRole, date = todayStr()): Promise<boolean> {
    const auths = await this.repo.list("authorizations", { where: { user_id, field_id, role } as Partial<Authorization> });
    return auths.some((a) => a.valid_from <= date && (!a.valid_to || a.valid_to >= date));
  }

  /** Chuẩn dùng được không? Trả về lý do nếu không. */
  standardProblem(std: Standard, field_id: string | null, date = todayStr()): string | null {
    if (std.status === "broken") return "đang hỏng";
    if (std.status === "retired") return "đã thanh lý";
    if (std.status === "locked") return "đã bị khoá";
    if (!std.cal_due) return "chưa có hạn hiệu chuẩn";
    if (std.cal_due < date) return `quá hạn hiệu chuẩn từ ${dayjs(std.cal_due).format("DD/MM/YYYY")}`;
    if (field_id && std.field_id !== field_id) return "không thuộc lĩnh vực của phép đo";
    return null;
  }

  /** Khoá tự động các chuẩn quá hạn (chạy mỗi ngày / mỗi lần mở app) */
  async lockExpiredStandards(): Promise<number> {
    const today = todayStr();
    const stds = await this.repo.list("standards", { where: { status: "ok" } as Partial<Standard> });
    let n = 0;
    for (const s of stds) {
      if (s.cal_due && s.cal_due < today) {
        await this.repo.update("standards", s.id, { status: "locked" });
        await this.audit("auto_lock", "standards", s.id, s, { ...s, status: "locked" });
        n++;
      }
    }
    return n;
  }

  /** Mở khoá khi đã hiệu chuẩn lại chuẩn */
  async recalibrateStandard(id: string, data: { cal_cert_no: string; cal_by: string; cal_date: string; cal_due: string }) {
    this.require("standards");
    const std = await this.repo.get("standards", id);
    if (!std) throw new BizError("NOT_FOUND");
    return this.patch("standards", "standards", id, { ...data, status: std.status === "locked" ? "ok" : std.status });
  }

  /** Mọi GCN đã dùng chuẩn này kể từ một ngày (đánh giá ảnh hưởng khi chuẩn bị phát hiện sai) */
  async certificatesUsingStandard(standard_id: string, since: string): Promise<Certificate[]> {
    const jobs = (await this.repo.list("jobs")).filter((j) => j.standard_ids.includes(standard_id) && j.certificate_id && (j.performed_at ?? "") >= since);
    const out: Certificate[] = [];
    for (const j of jobs) {
      const c = await this.repo.get("certificates", j.certificate_id!);
      if (c) out.push(c);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Khách hàng, thiết bị
  // ---------------------------------------------------------------------------
  async createCustomer(data: Omit<Customer, "id" | "created_at" | "code"> & { code?: string }): Promise<Customer> {
    const code = data.code?.trim() || (await this.nextCode("KH"));
    return this.create("customers", "customers", { ...data, code });
  }

  async createDevice(data: Omit<Device, "id" | "created_at" | "next_due" | "last_cert_id" | "last_result" | "status"> & Partial<Pick<Device, "next_due" | "status">>): Promise<Device> {
    return this.create("customers", "devices", { next_due: null, last_cert_id: null, last_result: null, status: "active", ...data });
  }

  /** Thiết bị sắp đến hạn trong N ngày (kể cả đã quá hạn) */
  async dueDevices(days: number): Promise<Device[]> {
    const limit = dayjs().add(days, "day").format("YYYY-MM-DD");
    return (await this.repo.list("devices", { where: { status: "active" } as Partial<Device> })).filter((d) => d.next_due && d.next_due <= limit);
  }

  // ---------------------------------------------------------------------------
  // Đơn hàng, tiếp nhận
  // ---------------------------------------------------------------------------
  async createOrder(data: {
    customer_id: string; branch_id: string | null; received_at: string; expected_at: string | null; onsite: boolean;
    contact_name: string | null; contact_phone: string | null; note: string | null; items: NewOrderItem[];
  }): Promise<{ order: Order; jobs: Job[] }> {
    const me = this.require("orders");
    if (!data.items.length) throw new BizError("NO_ITEMS", "Đơn hàng phải có ít nhất một thiết bị.");
    const types = await this.repo.list("instrument_types");
    const procedures = await this.repo.list("procedures");
    const code = await this.nextCode("DH", 4, dayjs(data.received_at).format("YYMM"));
    const order: Order = {
      id: newId(), code, customer_id: data.customer_id, branch_id: data.branch_id, received_at: data.received_at, expected_at: data.expected_at,
      onsite: data.onsite, status: "open", received_by: me.id, contact_name: data.contact_name, contact_phone: data.contact_phone,
      total_amount: data.items.reduce((s, i) => s + (i.price || 0), 0), paid: false, paid_at: null, note: data.note, created_at: nowIso(),
    };
    await this.repo.insert("orders", order);
    await this.audit("create", "orders", order.id, null, order);
    const jobs: Job[] = [];
    let n = 0;
    for (const it of data.items) {
      n++;
      let device: Device | null = null;
      if (it.device_id) device = await this.repo.get("devices", it.device_id);
      else if (it.device) device = await this.createDevice({ ...it.device, customer_id: data.customer_id });
      if (!device) throw new BizError("NOT_FOUND");
      const type = types.find((t) => t.id === device!.instrument_type_id);
      const proc = type?.procedure_id ? procedures.find((p) => p.id === type.procedure_id && p.status === "active") ?? null : null;
      const job: Job = {
        id: newId(), code: `${code}-${String(n).padStart(2, "0")}`, order_id: order.id, customer_id: data.customer_id, device_id: device.id,
        instrument_type_id: device.instrument_type_id, procedure_id: proc?.id ?? null, branch_id: data.branch_id, kind: it.kind, status: "received",
        priority: it.priority, due_date: data.expected_at, price: it.price || 0, intake: it.intake, assignee_id: null, reviewer_id: null, approver_id: null,
        standard_ids: [], env: { temp: null, humidity: null, pressure: null }, readings: {}, result: null, conclusion: null, performed_at: null, performed_note: null,
        submitted_at: null, review_note: null, review_checks: {}, reviewed_at: null, approved_at: null, return_reason: null, cancel_reason: null,
        certificate_id: null, returned_at: null, history: [this.hist(me.id, "Tiếp nhận")], created_at: nowIso(),
      };
      await this.repo.insert("jobs", job);
      jobs.push(job);
    }
    await this.notify({ roles: ["signer", "qa", "admin"] }, `Đơn ${code} mới: ${jobs.length} thiết bị chờ phân công`, null, `/jobs?order=${order.id}`, { email: true });
    return { order, jobs };
  }

  async setOrderPaid(order_id: string, paid: boolean, paid_at: string | null) {
    return this.patch("finance", "orders", order_id, { paid, paid_at: paid ? paid_at ?? todayStr() : null });
  }

  private hist(by: string, action: string, note?: string): JobHistory {
    return { at: nowIso(), by, action, ...(note ? { note } : {}) };
  }

  private async job(id: string): Promise<Job> {
    const j = await this.repo.get("jobs", id);
    if (!j) throw new BizError("NOT_FOUND");
    return j;
  }
  private async fieldOf(job: Job): Promise<InstrumentType & { field: Field | null }> {
    const t = await this.repo.get("instrument_types", job.instrument_type_id);
    if (!t) throw new BizError("NOT_FOUND");
    return { ...t, field: await this.repo.get("fields", t.field_id) };
  }
  private async saveJob(job: Job, before: Job, action: string) {
    const after = await this.repo.update("jobs", job.id, job);
    await this.audit(action, "jobs", job.id, before, after);
    return after;
  }

  // ---------------------------------------------------------------------------
  // Phiếu công việc – luồng trạng thái
  // ---------------------------------------------------------------------------
  async assignJob(id: string, data: { assignee_id: string; reviewer_id: string | null; due_date: string | null; priority: Priority; procedure_id?: string | null }) {
    const me = this.require("assign");
    const job = await this.job(id);
    if (!["received", "assigned", "in_progress"].includes(job.status)) throw new BizError("BAD_STATUS");
    const type = await this.fieldOf(job);
    const assignee = await this.repo.get("users", data.assignee_id);
    if (!assignee || !assignee.active) throw new BizError("NOT_FOUND");
    if (!(await this.isAuthorized(assignee.id, type.field_id, "perform"))) throw new BizError("NOT_AUTHORIZED_PERFORM");
    if (assignee.inspector_card_expiry && assignee.inspector_card_expiry < todayStr()) throw new BizError("CARD_EXPIRED");
    if (data.reviewer_id) {
      if (data.reviewer_id === assignee.id) throw new BizError("REVIEWER_IS_PERFORMER");
      if (!(await this.isAuthorized(data.reviewer_id, type.field_id, "review"))) throw new BizError("NOT_AUTHORIZED_REVIEW");
    }
    const before = structuredClone(job);
    const procedure_id = data.procedure_id === undefined ? job.procedure_id : data.procedure_id;
    const next: Job = {
      ...job, assignee_id: assignee.id, reviewer_id: data.reviewer_id, due_date: data.due_date, priority: data.priority, procedure_id,
      status: job.status === "received" ? "assigned" : job.status,
      history: [...job.history, this.hist(me.id, `Phân công cho ${assignee.full_name}`)],
    };
    const saved = await this.saveJob(next, before, "assign");
    await this.notify({ user_ids: [assignee.id] }, `Bạn được phân công phiếu ${job.code}`, null, `/jobs/${job.id}`, { email: true });
    return saved;
  }

  /** Lưu số liệu đo (nháp). Kỹ thuật viên được phân công hoặc người có quyền phân công. */
  async saveReadings(id: string, data: { env: Job["env"]; readings: Readings; standard_ids: string[]; performed_at: string | null; performed_note: string | null }) {
    const me = this.me();
    const job = await this.job(id);
    if (!["assigned", "in_progress"].includes(job.status)) throw new BizError("BAD_STATUS");
    if (job.assignee_id !== me.id && !can(me, "assign")) throw new BizError("FORBIDDEN");
    const proc = job.procedure_id ? await this.repo.get("procedures", job.procedure_id) : null;
    if (!proc) throw new BizError("NO_PROCEDURE");
    const result = evaluate(proc.template, data.readings);
    const before = structuredClone(job);
    const next: Job = {
      ...job, ...data, result, conclusion: result.complete ? (result.pass ? "pass" : "fail") : null,
      status: "in_progress", history: job.status === "assigned" ? [...job.history, this.hist(me.id, "Bắt đầu thực hiện")] : job.history,
    };
    return this.saveJob(next, before, "save_readings");
  }

  /** Nộp soát xét: kiểm tra đủ số liệu, môi trường, chuẩn, ủy quyền */
  async submitForReview(id: string) {
    const me = this.me();
    const job = await this.job(id);
    if (job.status !== "in_progress") throw new BizError("BAD_STATUS");
    if (job.assignee_id !== me.id && !can(me, "assign")) throw new BizError("FORBIDDEN");
    await this.validateForIssue(job);
    const before = structuredClone(job);
    const next: Job = { ...job, status: "review", submitted_at: nowIso(), return_reason: null, history: [...job.history, this.hist(me.id, "Nộp soát xét")] };
    const saved = await this.saveJob(next, before, "submit");
    const targets = job.reviewer_id ? { user_ids: [job.reviewer_id] } : { roles: ["reviewer", "signer"] as Role[] };
    await this.notify(targets, `Phiếu ${job.code} chờ soát xét`, null, `/jobs/${job.id}`, { email: true });
    return saved;
  }

  /** Các kiểm tra kỹ thuật bắt buộc trước khi nộp / phát hành */
  async validateForIssue(job: Job): Promise<{ procedure: Procedure; type: InstrumentType & { field: Field | null }; standards: Standard[] }> {
    const type = await this.fieldOf(job);
    const proc = job.procedure_id ? await this.repo.get("procedures", job.procedure_id) : null;
    if (!proc) throw new BizError("NO_PROCEDURE");
    if (!job.assignee_id || !(await this.isAuthorized(job.assignee_id, type.field_id, "perform", job.performed_at ?? todayStr()))) throw new BizError("NOT_AUTHORIZED_PERFORM");
    const envProblems = checkEnv(proc.template, job.env);
    if (envProblems.length) throw new BizError("ENV_OUT_OF_RANGE", { detail: envProblems.join("; ") });
    if (!job.standard_ids.length) throw new BizError("STANDARD_REQUIRED");
    const standards: Standard[] = [];
    for (const sid of job.standard_ids) {
      const s = await this.repo.get("standards", sid);
      if (!s) throw new BizError("NOT_FOUND");
      const problem = this.standardProblem(s, type.field_id, job.performed_at ?? todayStr());
      if (problem) throw new BizError("STANDARD_UNUSABLE", { code: s.code, reason: problem });
      standards.push(s);
    }
    const result = evaluate(proc.template, job.readings);
    if (!result.complete) throw new BizError("READINGS_INCOMPLETE", { missing: result.missing.slice(0, 5).join("; ") + (result.missing.length > 5 ? "…" : "") });
    if (!sameResult(result, job.result)) throw new BizError("RESULT_MISMATCH");
    return { procedure: proc, type, standards };
  }

  /** Soát xét: đồng ý → chờ phê duyệt; không đồng ý → trả lại kỹ thuật viên */
  async reviewJob(id: string, data: { ok: boolean; note: string | null; checks: Record<string, boolean> }) {
    const me = this.require("review");
    const job = await this.job(id);
    if (job.status !== "review") throw new BizError("BAD_STATUS");
    if (job.assignee_id === me.id) throw new BizError("REVIEWER_IS_PERFORMER");
    const type = await this.fieldOf(job);
    if (!(await this.isAuthorized(me.id, type.field_id, "review"))) throw new BizError("NOT_AUTHORIZED_REVIEW");
    const before = structuredClone(job);
    const next: Job = data.ok
      ? { ...job, status: "approval", reviewer_id: me.id, review_note: data.note, review_checks: data.checks, reviewed_at: nowIso(), history: [...job.history, this.hist(me.id, "Soát xét đạt", data.note ?? undefined)] }
      : { ...job, status: "in_progress", reviewer_id: me.id, review_note: data.note, review_checks: data.checks, return_reason: data.note || "Soát xét không đạt", history: [...job.history, this.hist(me.id, "Trả lại sau soát xét", data.note ?? undefined)] };
    const saved = await this.saveJob(next, before, data.ok ? "review_ok" : "review_return");
    if (data.ok) await this.notify({ roles: ["signer"] }, `Phiếu ${job.code} chờ phê duyệt`, null, `/jobs/${job.id}`, { email: true });
    else if (job.assignee_id) await this.notify({ user_ids: [job.assignee_id] }, `Phiếu ${job.code} bị trả lại`, data.note, `/jobs/${job.id}`, { email: true });
    return saved;
  }

  /** Người ký trả lại (về soát xét lại / thực hiện lại) */
  async returnFromApproval(id: string, note: string) {
    const me = this.require("sign");
    const job = await this.job(id);
    if (job.status !== "approval") throw new BizError("BAD_STATUS");
    const before = structuredClone(job);
    const next: Job = { ...job, status: "in_progress", return_reason: note, history: [...job.history, this.hist(me.id, "Trả lại khi phê duyệt", note)] };
    const saved = await this.saveJob(next, before, "approval_return");
    if (job.assignee_id) await this.notify({ user_ids: [job.assignee_id] }, `Phiếu ${job.code} bị trả lại khi phê duyệt`, note, `/jobs/${job.id}`, { email: true });
    return saved;
  }

  /** Phê duyệt và phát hành GCN (đạt) hoặc Thông báo không đạt */
  async approveAndIssue(id: string, data: { issued_at: string; seal_no: string | null; place: string }): Promise<{ job: Job; certificate: Certificate }> {
    const me = this.require("sign");
    const job = await this.job(id);
    if (job.status !== "approval") throw new BizError("BAD_STATUS");
    const { procedure, type, standards } = await this.validateForIssue(job);
    if (!(await this.isAuthorized(me.id, type.field_id, "sign"))) throw new BizError("NOT_AUTHORIZED_SIGN");
    const result = evaluate(procedure.template, job.readings);
    const pass = result.pass === true;
    const settings = await this.settings();
    const customer = await this.repo.get("customers", job.customer_id);
    const device = await this.repo.get("devices", job.device_id);
    const performer = job.assignee_id ? await this.repo.get("users", job.assignee_id) : null;
    const branch = job.branch_id ? await this.repo.get("branches", job.branch_id) : null;
    if (!customer || !device) throw new BizError("NOT_FOUND");

    // Tem: chỉ cấp khi đạt, và chỉ cho kiểm định (biên bản kiểm tra RA của hệ thống quan trắc không cấp tem)
    const isRa = procedure.doc_kind === "ra_report";
    let seal: Seal | null = null;
    if (pass && !isRa) {
      if (data.seal_no) {
        const found = (await this.repo.list("seals", { where: { number: data.seal_no } as Partial<Seal> }))[0];
        if (!found || !["stock", "assigned"].includes(found.status)) throw new BizError("SEAL_UNAVAILABLE", { number: data.seal_no });
        seal = found;
      }
    }

    const year = dayjs(data.issued_at).format("YYYY");
    const seqKey = `cert:${settings.numbering.reset === "year" ? year : "all"}`;
    const seq = await this.repo.nextSequence(seqKey);
    const number = this.formatNumber(settings.numbering.certificate_pattern, seq, { date: data.issued_at, branch: branch?.code ?? "", field: type.field?.code ?? "" });
    const valid_to = pass ? dayjs(data.issued_at).add(type.cycle_months, "month").subtract(1, "day").format("YYYY-MM-DD") : null;

    const snapshot: CertSnapshot = {
      company: settings.company,
      customer: { name: customer.name, address: customer.address, tax_code: customer.tax_code },
      device: { name: device.name, manufacturer: device.manufacturer, model: device.model, serial: device.serial, range_text: device.range_text, accuracy_class: device.accuracy_class, resolution_text: device.resolution_text, location: device.location, customer_code: device.customer_code },
      instrument_type: { code: type.code, name: type.name, cycle_months: type.cycle_months },
      procedure: { code: procedure.code, name: procedure.name, version: procedure.version, ...(procedure.doc_kind ? { doc_kind: procedure.doc_kind } : {}) },
      standards: standards.map((s) => ({ code: s.code, name: s.name, serial: s.serial, cal_cert_no: s.cal_cert_no, cal_due: s.cal_due })),
      env: job.env, result, performer: performer ? { full_name: performer.full_name, inspector_card_no: performer.inspector_card_no } : null,
      signer: { full_name: me.full_name, title: me.title }, kind: job.kind, performed_at: job.performed_at, place: data.place,
    };
    const cert: Certificate = {
      id: newId(), number, kind: pass ? "certificate" : "fail_notice", job_id: job.id, device_id: device.id, customer_id: customer.id, branch_id: job.branch_id,
      issued_at: data.issued_at, valid_to, signer_id: me.id, status: "valid", replaces_id: null, replaced_by_id: null, revoke_reason: null,
      seal_no: seal?.number ?? null, snapshot, hash: "", created_at: nowIso(),
    };
    cert.hash = await sha256Hex(JSON.stringify({ number: cert.number, issued_at: cert.issued_at, valid_to: cert.valid_to, snapshot }));
    await this.repo.insert("certificates", cert);
    await this.audit("issue", "certificates", cert.id, null, cert);

    if (seal) await this.repo.update("seals", seal.id, { status: "used", certificate_id: cert.id, used_at: data.issued_at, assigned_to: seal.assigned_to ?? me.id });

    const before = structuredClone(job);
    const next: Job = { ...job, status: "issued", approver_id: me.id, approved_at: nowIso(), certificate_id: cert.id, conclusion: pass ? "pass" : "fail", result,
      history: [...job.history, this.hist(me.id, pass ? `Phát hành GCN số ${number}` : `Phát hành thông báo không đạt số ${number}`)] };
    const savedJob = await this.saveJob(next, before, "issue");

    await this.repo.update("devices", device.id, { next_due: valid_to, last_cert_id: cert.id, last_result: pass ? "pass" : "fail" });

    // Đơn hàng hoàn thành khi mọi phiếu đã phát hành hoặc huỷ
    const siblings = await this.repo.list("jobs", { where: { order_id: job.order_id } as Partial<Job> });
    if (siblings.every((j) => j.id === job.id || ["issued", "returned", "cancelled"].includes(j.status))) await this.repo.update("orders", job.order_id, { status: "done" });

    await this.notify({ roles: ["intake", "sales"] }, `${pass ? "GCN" : "Thông báo không đạt"} ${number} đã phát hành cho ${customer.name}`, device.name, `/certificates/${cert.id}`);
    return { job: savedJob, certificate: cert };
  }

  async returnDevice(id: string, returned_at: string) {
    const me = this.require("orders");
    const job = await this.job(id);
    if (job.status !== "issued") throw new BizError("BAD_STATUS");
    const before = structuredClone(job);
    return this.saveJob({ ...job, status: "returned", returned_at, history: [...job.history, this.hist(me.id, "Trả thiết bị cho khách")] }, before, "return_device");
  }

  async cancelJob(id: string, reason: string) {
    const me = this.require("assign");
    const job = await this.job(id);
    if (["issued", "returned", "cancelled"].includes(job.status)) throw new BizError("BAD_STATUS");
    const before = structuredClone(job);
    const saved = await this.saveJob({ ...job, status: "cancelled", cancel_reason: reason, history: [...job.history, this.hist(me.id, "Không thực hiện", reason)] }, before, "cancel");
    const siblings = await this.repo.list("jobs", { where: { order_id: job.order_id } as Partial<Job> });
    if (siblings.every((j) => ["issued", "returned", "cancelled"].includes(j.status))) await this.repo.update("orders", job.order_id, { status: siblings.every((j) => j.status === "cancelled") ? "cancelled" : "done" });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Giấy chứng nhận: thay thế, thu hồi
  // ---------------------------------------------------------------------------
  /** Thay thế GCN (sửa thông tin hành chính: tên khách, địa chỉ, thông tin thiết bị). Kết quả đo không đổi. */
  async replaceCertificate(id: string, data: { reason: string; customer?: Partial<CertSnapshot["customer"]>; device?: Partial<CertSnapshot["device"]> }): Promise<Certificate> {
    const me = this.require("sign");
    const old = await this.repo.get("certificates", id);
    if (!old) throw new BizError("NOT_FOUND");
    if (old.status !== "valid") throw new BizError("CERT_NOT_VALID");
    const settings = await this.settings();
    const type = await this.repo.get("instrument_types", (await this.job(old.job_id)).instrument_type_id);
    const branch = old.branch_id ? await this.repo.get("branches", old.branch_id) : null;
    const field = type ? await this.repo.get("fields", type.field_id) : null;
    const issued_at = todayStr();
    const seqKey = `cert:${settings.numbering.reset === "year" ? dayjs(issued_at).format("YYYY") : "all"}`;
    const number = this.formatNumber(settings.numbering.certificate_pattern, await this.repo.nextSequence(seqKey), { date: issued_at, branch: branch?.code ?? "", field: field?.code ?? "" });
    const snapshot: CertSnapshot = { ...old.snapshot, customer: { ...old.snapshot.customer, ...data.customer }, device: { ...old.snapshot.device, ...data.device }, signer: { full_name: me.full_name, title: me.title } };
    const cert: Certificate = {
      ...old, id: newId(), number, issued_at, signer_id: me.id, status: "valid", replaces_id: old.id, replaced_by_id: null, revoke_reason: null, snapshot, hash: "", created_at: nowIso(),
    };
    cert.hash = await sha256Hex(JSON.stringify({ number: cert.number, issued_at: cert.issued_at, valid_to: cert.valid_to, snapshot }));
    await this.repo.insert("certificates", cert);
    await this.audit("replace", "certificates", cert.id, old, cert);
    await this.repo.update("certificates", old.id, { status: "replaced", replaced_by_id: cert.id, revoke_reason: data.reason });
    await this.repo.update("jobs", old.job_id, { certificate_id: cert.id });
    await this.repo.update("devices", old.device_id, { last_cert_id: cert.id });
    return cert;
  }

  async revokeCertificate(id: string, reason: string): Promise<Certificate> {
    const me = this.require("sign");
    const old = await this.repo.get("certificates", id);
    if (!old) throw new BizError("NOT_FOUND");
    if (old.status !== "valid") throw new BizError("CERT_NOT_VALID");
    const after = await this.repo.update("certificates", id, { status: "revoked", revoke_reason: reason });
    await this.audit("revoke", "certificates", id, old, after);
    const device = await this.repo.get("devices", old.device_id);
    if (device && device.last_cert_id === id) await this.repo.update("devices", device.id, { next_due: null, last_result: null });
    const job = await this.repo.get("jobs", old.job_id);
    if (job) await this.repo.update("jobs", job.id, { history: [...job.history, this.hist(me.id, `Thu hồi GCN ${old.number}`, reason)] });
    await this.notify({ roles: ["intake", "sales", "qa"] }, `GCN ${old.number} đã bị thu hồi`, reason, `/certificates/${id}`);
    return after;
  }

  /** Tra cứu công khai theo số GCN */
  async lookupCertificate(number: string): Promise<Certificate | null> {
    const list = await this.repo.list("certificates", { where: { number: number.trim() } as Partial<Certificate> });
    return list[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Thư viện quy trình có sẵn trong phần mềm (vd. quan trắc tự động) → thêm vào danh mục đang dùng
  // ---------------------------------------------------------------------------
  /** Những mục của thư viện chưa có trong danh mục (theo id) */
  async libraryMissing(): Promise<{ fields: Field[]; procedures: Procedure[]; types: InstrumentType[] }> {
    const { LIBRARY } = await import("../seed/library");
    const [f, p, t] = await Promise.all([this.repo.list("fields"), this.repo.list("procedures"), this.repo.list("instrument_types")]);
    const has = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
    const hf = has(f), hp = has(p), ht = has(t);
    return {
      fields: LIBRARY.fields.filter((x) => !hf.has(x.id)),
      procedures: LIBRARY.procedures.filter((x) => !hp.has(x.id)),
      types: LIBRARY.types.filter((x) => !ht.has(x.id)),
    };
  }

  /** Thêm các mục còn thiếu của thư viện; không sửa mục đã có (người dùng có thể đã chỉnh) */
  async importLibrary(): Promise<{ fields: number; procedures: number; types: number }> {
    this.require("catalog");
    const miss = await this.libraryMissing();
    const t = nowIso();
    for (const x of miss.fields) await this.repo.insert("fields", { ...x, created_at: t });
    for (const x of miss.procedures) await this.repo.insert("procedures", { ...x, created_at: t });
    for (const x of miss.types) await this.repo.insert("instrument_types", { ...x, created_at: t });
    const counts = { fields: miss.fields.length, procedures: miss.procedures.length, types: miss.types.length };
    await this.audit("import_library", "procedures", "library", null, counts);
    return counts;
  }

  // ---------------------------------------------------------------------------
  // Tem kiểm định
  // ---------------------------------------------------------------------------
  async createSealBatch(data: { prefix: string; from_no: number; to_no: number; received_at: string; note: string | null; width?: number }): Promise<SealBatch> {
    this.require("seals");
    if (data.to_no < data.from_no || data.to_no - data.from_no > 20000) throw new BizError("BAD_RANGE", "Dải số tem không hợp lệ (tối đa 20.000 tem mỗi lô).");
    const width = data.width ?? 6;
    const existing = new Set((await this.repo.list("seals")).map((s) => s.number));
    const batch = await this.create("seals", "seal_batches", { prefix: data.prefix, from_no: data.from_no, to_no: data.to_no, received_at: data.received_at, note: data.note });
    for (let n = data.from_no; n <= data.to_no; n++) {
      const number = `${data.prefix}${String(n).padStart(width, "0")}`;
      if (existing.has(number)) continue;
      await this.repo.insert("seals", { id: newId(), batch_id: batch.id, number, seq: n, status: "stock", assigned_to: null, certificate_id: null, used_at: null, void_reason: null, created_at: nowIso() });
    }
    return batch;
  }

  async assignSeals(seal_ids: string[], user_id: string | null) {
    this.require("seals");
    for (const id of seal_ids) {
      const s = await this.repo.get("seals", id);
      if (!s || !["stock", "assigned"].includes(s.status)) continue;
      await this.repo.update("seals", id, { status: user_id ? "assigned" : "stock", assigned_to: user_id });
    }
    await this.audit("assign_seals", "seals", seal_ids.join(","), null, { user_id, count: seal_ids.length });
  }

  async voidSeal(id: string, reason: string) {
    this.require("seals");
    const s = await this.repo.get("seals", id);
    if (!s || s.status === "used") throw new BizError("SEAL_UNAVAILABLE", { number: s?.number ?? "?" });
    return this.patch("seals", "seals", id, { status: "void", void_reason: reason });
  }

  /** Tem tiếp theo có thể dùng cho người ký (ưu tiên tem đã cấp cho mình, rồi kho) */
  async nextSealFor(user_id: string): Promise<Seal | null> {
    const mine = await this.repo.list("seals", { where: { status: "assigned", assigned_to: user_id } as Partial<Seal>, orderBy: { field: "seq" } });
    if (mine[0]) return mine[0];
    const stock = await this.repo.list("seals", { where: { status: "stock" } as Partial<Seal>, orderBy: { field: "seq" }, limit: 1 });
    return stock[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Nhắc việc hằng ngày (idempotent theo ngày)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Trao đổi nội bộ (xem chat.ts)
  // ---------------------------------------------------------------------------
  chatSummary(): Promise<ChatSummaryItem[]> { return chatSummary(this); }
  chatList(channel: string, before?: string | null, limit?: number): Promise<ChatMessage[]> { return chatList(this, channel, before, limit); }
  chatSend(input: ChatSendInput): Promise<ChatMessage> { return chatSend(this, input); }
  chatRead(channel: string): Promise<void> { return chatRead(this, channel); }
  chatAnswer(message_id: string, status: Exclude<ChatAsk["status"], "open">): Promise<ChatMessage> { return chatAnswer(this, message_id, status); }

  async runDailyChecks(): Promise<void> {
    const today = todayStr();
    const marker = `daily:${today}`;
    const done = await this.repo.list("notifications", { where: { title: marker } as Partial<Notification> });
    if (done.length) return;
    await this.repo.insert("notifications", { id: newId(), user_id: "system", title: marker, body: null, link: null, read: true, created_at: nowIso() });

    const locked = await this.lockExpiredStandards();
    if (locked) await this.notify({ roles: ["qa", "signer", "admin"] }, `${locked} chuẩn quá hạn hiệu chuẩn đã bị khoá`, null, "/standards");

    const s = await this.settings();
    const soon = dayjs().add(s.reminders.standard_due_days, "day").format("YYYY-MM-DD");
    const stds = (await this.repo.list("standards", { where: { status: "ok" } as Partial<Standard> })).filter((x) => x.cal_due && x.cal_due <= soon);
    if (stds.length) await this.notify({ roles: ["qa", "admin"] }, `${stds.length} chuẩn sắp đến hạn hiệu chuẩn`, stds.map((x) => `${x.code} (${dayjs(x.cal_due).format("DD/MM/YYYY")})`).join(", "), "/standards");

    const cardSoon = dayjs().add(s.reminders.card_due_days, "day").format("YYYY-MM-DD");
    const users = (await this.repo.list("users", { where: { active: true } as Partial<User> })).filter((u) => u.inspector_card_expiry && u.inspector_card_expiry <= cardSoon);
    if (users.length) await this.notify({ roles: ["qa", "admin"] }, `${users.length} thẻ kiểm định viên sắp hết hạn`, users.map((u) => u.full_name).join(", "), "/staff");

    const maxDays = Math.max(...s.reminders.due_days);
    const due = await this.dueDevices(maxDays);
    if (due.length) await this.notify({ roles: ["sales", "intake", "admin"] }, `${due.length} thiết bị của khách đến hạn kiểm định trong ${maxDays} ngày`, null, "/devices?due=1");

    const overdueJobs = (await this.repo.list("jobs")).filter((j) => j.due_date && j.due_date < today && !["issued", "returned", "cancelled"].includes(j.status));
    for (const j of overdueJobs) {
      const targets = [j.assignee_id].filter((x): x is string => !!x);
      await this.notify({ user_ids: targets, roles: ["signer"] }, `Phiếu ${j.code} đã quá hạn trả (${dayjs(j.due_date).format("DD/MM")})`, null, `/jobs/${j.id}`);
    }
  }
}

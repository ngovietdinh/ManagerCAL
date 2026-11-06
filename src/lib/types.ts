// =============================================================================
// KIỂU DỮ LIỆU NGHIỆP VỤ – dùng chung cho giao diện, lớp lưu trữ và kiểm thử.
// Tên bảng/cột bằng tiếng Anh (để khớp SQL), nhãn hiển thị tiếng Việt ở labels.ts.
// =============================================================================

export type Id = string;
export type IsoDate = string;     // YYYY-MM-DD
export type IsoDateTime = string; // ISO 8601

// ---------------------------------------------------------------------------
// Người dùng, phân quyền
// ---------------------------------------------------------------------------
export type Role =
  | "admin"       // quản trị hệ thống
  | "director"    // giám đốc: xem mọi báo cáo, cài đặt
  | "sales"       // kinh doanh: khách hàng, thiết bị, đơn hàng
  | "intake"      // tiếp nhận: lập đơn, tiếp nhận, bàn giao
  | "technician"  // kiểm định viên: thực hiện đo
  | "reviewer"    // soát xét biên bản
  | "signer"      // ký duyệt, phát hành GCN
  | "qa"          // quản lý chất lượng: danh mục, quy trình, chuẩn, ủy quyền
  | "accountant"; // kế toán: thu tiền, công nợ

export interface User {
  id: Id;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  roles: Role[];
  branch_id: Id | null;
  title: string | null;            // chức danh
  inspector_card_no: string | null; // số thẻ kiểm định viên đo lường
  inspector_card_expiry: IsoDate | null;
  active: boolean;
  created_at: IsoDateTime;
}

export type AuthRole = "perform" | "review" | "sign";
export interface Authorization {
  id: Id;
  user_id: Id;
  field_id: Id;
  role: AuthRole;
  decision_no: string | null;  // số quyết định giao nhiệm vụ / ủy quyền
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Tổ chức, cài đặt
// ---------------------------------------------------------------------------
export interface Branch {
  id: Id;
  code: string;
  name: string;
  address: string | null;
  active: boolean;
  created_at: IsoDateTime;
}

export interface Settings {
  id: "1";
  company: {
    name: string;
    short_name: string;
    address: string;
    phone: string;
    email: string;
    tax_code: string;
    designation_no: string;    // số quyết định chỉ định tổ chức kiểm định
    designation_date: IsoDate | "";
    lab_code: string;          // ký hiệu tổ chức (in trên tem, GCN)
    director_name: string;
  };
  numbering: {
    certificate_pattern: string; // vd "{SEQ:5}/{YY}/KĐ"
    reset: "year" | "never";
  };
  reminders: { due_days: number[]; standard_due_days: number; card_due_days: number };
  review: { checklist: string[] };
  updated_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Danh mục kỹ thuật
// ---------------------------------------------------------------------------
export interface Field {            // lĩnh vực đo
  id: Id;
  code: string;                     // KL, AS, ND, DL, DT, DI, LL
  name: string;
  active: boolean;
  created_at: IsoDateTime;
}

export interface InstrumentType {   // loại phương tiện đo
  id: Id;
  code: string;
  name: string;
  field_id: Id;
  group2: boolean;                  // thuộc danh mục PTĐ nhóm 2 phải kiểm định
  cycle_months: number;             // chu kỳ kiểm định
  procedure_id: Id | null;          // quy trình mặc định
  default_price: number;            // đơn giá tham khảo
  active: boolean;
  note: string | null;
  created_at: IsoDateTime;
}

export type ProcedureStatus = "draft" | "active" | "retired";
/** Loại tài liệu phát hành: GCN kiểm định (có tem) hoặc biên bản kiểm tra RA của hệ thống quan trắc (không tem) */
export type DocKind = "verification" | "ra_report";
export interface Procedure {        // quy trình kiểm định (ĐLVN / nội bộ), có phiên bản
  id: Id;
  code: string;                     // ĐLVN 16:2009
  name: string;
  version: string;
  effective_from: IsoDate;
  status: ProcedureStatus;
  doc_kind?: DocKind;
  /** căn cứ pháp lý / ghi chú áp dụng hiển thị cho kiểm định viên */
  legal?: string;
  template: Template;
  note: string | null;
  created_at: IsoDateTime;
}

// --- Mẫu biên bản (xem calc/) ----------------------------------------------
export type MpeSpec =
  | { kind: "abs"; value: number }                               // ± giá trị (đơn vị của mục)
  | { kind: "pct_reading"; value: number }                       // ± % giá trị đo
  | { kind: "pct_span"; value: number; span: number }            // ± % phạm vi đo
  | { kind: "scale_oiml"; e: number; cls: "I" | "II" | "III" | "IIII"; in_service?: boolean }; // cân không tự động theo OIML R76

export interface TemplatePoint { id: string; label?: string; nominal: number; mpe?: MpeSpec }

/**
 * Các loại mục của mẫu biên bản:
 *  - checklist      kiểm tra bên ngoài / kỹ thuật (Đạt / Không đạt)
 *  - points         sai số tại các điểm đo; `ref_input`: kiểm định viên nhập giá trị chuẩn (theo chứng nhận của
 *                   dung dịch / khí chuẩn) thay cho giá trị danh định; `relative`: sai số tính theo % giá trị chuẩn
 *  - repeatability  độ lặp lại: `method` "range" (chênh lệch lớn nhất, cân) hoặc "stdev" (độ lệch chuẩn, ĐLVN 38x)
 *  - eccentricity   độ lệch tâm (cân)
 *  - drift          độ trôi: đo lại sau từng khoảng thời gian, so với lần đo đầu (ĐLVN 38x: 2 giờ; ĐLVN 389: 24 giờ)
 *  - linearity      độ tuyến tính toàn thang đo từ các điểm của một mục "points" (R² ≥ min_r2)
 *  - ra             độ chính xác tương đối của hệ thống quan trắc tự động (TT 10/2021/TT-BTNMT, Phụ lục 12)
 */
export type TemplateSection =
  | { id: string; kind: "checklist"; title: string; items: { id: string; label: string }[] }
  | {
      id: string; kind: "points"; title: string; unit: string; decimals: number;
      readings: number;              // số lần đọc mỗi điểm
      directions: 1 | 2;             // 2 = tăng và giảm (có độ trễ/hysteresis)
      mpe: MpeSpec;
      hysteresis_mpe?: MpeSpec;      // giới hạn độ trễ (mặc định = mpe)
      ref_input?: boolean;
      relative?: boolean;
      points: TemplatePoint[];
    }
  | { id: string; kind: "repeatability"; title: string; unit: string; decimals: number; nominal: number; readings: number; limit: MpeSpec; method?: "range" | "stdev"; ref_input?: boolean }
  | { id: string; kind: "eccentricity"; title: string; unit: string; decimals: number; nominal: number; positions: number; mpe: MpeSpec }
  | { id: string; kind: "drift"; title: string; unit: string; decimals: number; nominal: number; readings: number; interval: string; limit: MpeSpec; ref_input?: boolean }
  | { id: string; kind: "linearity"; title: string; source: string; min_r2: number }
  | { id: string; kind: "ra"; title: string; unit: string; decimals: number; pairs: number; limit_pct: number; qcvn_sub?: boolean };

export interface Template {
  env_limits: { temp?: [number, number]; humidity?: [number, number] };
  sections: TemplateSection[];
}

/** Số liệu kỹ thuật viên nhập: theo mục → theo điểm → mảng số đọc. Checklist: mục → id → true/false */
export type SectionReadings = Record<string, (number | null)[]> | Record<string, boolean>;
export type Readings = Record<string, SectionReadings>;

export interface EvalRow {
  label: string; nominal: number | null; readings: (number | null)[]; mean: number | null;
  error: number | null; mpe: number | null; pass: boolean | null; note?: string;
  /** đơn vị riêng của cột sai số / giới hạn (vd. "%" khi sai số tương đối, "" cho R²); mặc định = đơn vị của mục */
  unit?: string;
  /** "≥" khi giới hạn là cận dưới (R²) */
  cmp?: "≥";
}
export interface EvalSection { id: string; title: string; kind: TemplateSection["kind"]; rows: EvalRow[]; pass: boolean | null; unit?: string; decimals?: number }
export interface EvalResult { sections: EvalSection[]; pass: boolean | null; complete: boolean; missing: string[] }

// ---------------------------------------------------------------------------
// Chuẩn đo lường của phòng thí nghiệm
// ---------------------------------------------------------------------------
export type StandardStatus = "ok" | "locked" | "broken" | "retired";
export interface Standard {
  id: Id;
  code: string;
  name: string;
  field_id: Id;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  range_text: string | null;
  accuracy_text: string | null;    // cấp chính xác / ĐKĐBĐ
  cal_cert_no: string | null;
  cal_by: string | null;
  cal_date: IsoDate | null;
  cal_due: IsoDate | null;
  status: StandardStatus;
  branch_id: Id | null;
  note: string | null;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Khách hàng, thiết bị của khách
// ---------------------------------------------------------------------------
export interface Customer {
  id: Id;
  code: string;
  name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  sales_user_id: Id | null;
  note: string | null;
  active: boolean;
  created_at: IsoDateTime;
}

export type DeviceStatus = "active" | "retired";
export interface Device {
  id: Id;
  customer_id: Id;
  instrument_type_id: Id;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  range_text: string | null;
  resolution_text: string | null;
  accuracy_class: string | null;
  location: string | null;
  customer_code: string | null;    // mã nội bộ của khách
  next_due: IsoDate | null;
  last_cert_id: Id | null;
  last_result: "pass" | "fail" | null;
  status: DeviceStatus;
  note: string | null;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Đơn hàng, phiếu công việc
// ---------------------------------------------------------------------------
export type OrderStatus = "open" | "done" | "cancelled";
export interface Order {
  id: Id;
  code: string;
  customer_id: Id;
  branch_id: Id | null;
  received_at: IsoDate;
  expected_at: IsoDate | null;
  onsite: boolean;                 // thực hiện tại hiện trường
  status: OrderStatus;
  received_by: Id;
  contact_name: string | null;
  contact_phone: string | null;
  total_amount: number;
  paid: boolean;
  paid_at: IsoDate | null;
  note: string | null;
  created_at: IsoDateTime;
}

export type JobStatus =
  | "received"     // tiếp nhận, chờ phân công
  | "assigned"     // đã phân công
  | "in_progress"  // đang thực hiện
  | "review"       // chờ soát xét
  | "approval"     // chờ phê duyệt
  | "issued"       // đã phát hành GCN / thông báo
  | "returned"     // đã trả thiết bị cho khách
  | "cancelled";   // không thực hiện được / huỷ
export type JobKind = "initial" | "periodic" | "after_repair";
export type Priority = "normal" | "urgent";

export interface JobHistory { at: IsoDateTime; by: Id; action: string; note?: string }

export interface Job {
  id: Id;
  code: string;
  order_id: Id;
  customer_id: Id;
  device_id: Id;
  instrument_type_id: Id;
  procedure_id: Id | null;
  branch_id: Id | null;
  kind: JobKind;
  status: JobStatus;
  priority: Priority;
  due_date: IsoDate | null;
  price: number;
  intake: { condition: string; accessories: string; note: string };
  assignee_id: Id | null;
  reviewer_id: Id | null;
  approver_id: Id | null;
  standard_ids: Id[];
  env: { temp: number | null; humidity: number | null; pressure: number | null };
  readings: Readings;
  result: EvalResult | null;
  conclusion: "pass" | "fail" | null;
  performed_at: IsoDate | null;
  performed_note: string | null;
  submitted_at: IsoDateTime | null;
  review_note: string | null;
  review_checks: Record<string, boolean>;
  reviewed_at: IsoDateTime | null;
  approved_at: IsoDateTime | null;
  return_reason: string | null;    // lý do bị trả lại
  cancel_reason: string | null;
  certificate_id: Id | null;
  returned_at: IsoDate | null;     // ngày trả thiết bị cho khách
  history: JobHistory[];
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Giấy chứng nhận, tem
// ---------------------------------------------------------------------------
export type CertKind = "certificate" | "fail_notice";
export type CertStatus = "valid" | "replaced" | "revoked";

export interface CertSnapshot {
  company: Settings["company"];
  customer: Pick<Customer, "name" | "address" | "tax_code">;
  device: Pick<Device, "name" | "manufacturer" | "model" | "serial" | "range_text" | "accuracy_class" | "resolution_text" | "location" | "customer_code">;
  instrument_type: Pick<InstrumentType, "code" | "name" | "cycle_months">;
  procedure: (Pick<Procedure, "code" | "name" | "version"> & { doc_kind?: DocKind }) | null;
  standards: Pick<Standard, "code" | "name" | "serial" | "cal_cert_no" | "cal_due">[];
  env: Job["env"];
  result: EvalResult | null;
  performer: { full_name: string; inspector_card_no: string | null } | null;
  signer: { full_name: string; title: string | null };
  kind: JobKind;
  performed_at: IsoDate | null;
  place: string;
}

export interface Certificate {
  id: Id;
  number: string;
  kind: CertKind;
  job_id: Id;
  device_id: Id;
  customer_id: Id;
  branch_id: Id | null;
  issued_at: IsoDate;
  valid_to: IsoDate | null;
  signer_id: Id;
  status: CertStatus;
  replaces_id: Id | null;
  replaced_by_id: Id | null;
  revoke_reason: string | null;
  seal_no: string | null;
  snapshot: CertSnapshot;
  hash: string;
  created_at: IsoDateTime;
}

export interface SealBatch {
  id: Id;
  prefix: string;
  from_no: number;
  to_no: number;
  received_at: IsoDate;
  note: string | null;
  created_at: IsoDateTime;
}
export type SealStatus = "stock" | "assigned" | "used" | "void";
export interface Seal {
  id: Id;
  batch_id: Id;
  number: string;        // prefix + số, vd "KĐ-000123"
  seq: number;
  status: SealStatus;
  assigned_to: Id | null;
  certificate_id: Id | null;
  used_at: IsoDate | null;
  void_reason: string | null;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Thông báo, nhật ký
// ---------------------------------------------------------------------------
export interface Notification {
  id: Id;
  user_id: Id | null;    // null = gửi tất cả
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: IsoDateTime;
  /** Việc được giao / cần người nhận xử lý → máy chủ gửi thêm email (nếu đã cấu hình) */
  email?: boolean;
}

// ---------------------------------------------------------------------------
// Trao đổi nội bộ (chat)
// ---------------------------------------------------------------------------
/** Kênh: "general" (toàn công ty) hoặc "dm:<id1>:<id2>" (hai người, id sắp xếp tăng dần) */
export interface ChatChannel {
  id: string;
  kind: "general" | "dm";
  members: Id[];          // dm: 2 người; general: rỗng (mọi người)
  count: number;          // tổng số tin – dùng tính số tin chưa đọc
  last_at: IsoDateTime | null;
  last_text: string | null;
  last_user_id: Id | null;
  created_at: IsoDateTime;
}
export type ChatRefKind = "job" | "order" | "certificate";
/** Trích dẫn một công việc trong tin nhắn (nhãn do máy chủ lấy từ dữ liệu thật, không tin máy khách) */
export interface ChatRef { kind: ChatRefKind; id: Id; label: string; sub: string | null }
export type ChatAskKind = "review" | "sign" | "check";
/** Lời nhờ trong tin nhắn: người nhận bấm Nhận / Xong / Bận ngay trong khung chat */
export interface ChatAsk {
  kind: ChatAskKind;
  to_user_id: Id;
  status: "open" | "accepted" | "done" | "declined";
  answered_at: IsoDateTime | null;
}
export interface ChatMessage {
  id: Id;
  channel: string;
  user_id: Id;
  text: string;
  refs: ChatRef[];
  ask: ChatAsk | null;
  created_at: IsoDateTime;
}
/** Đã đọc tới đâu: id = "<user_id>|<channel>" */
export interface ChatRead { id: string; user_id: Id; channel: string; read_count: number; read_at: IsoDateTime; created_at: IsoDateTime }

export interface AuditLog {
  id: Id;
  user_id: Id | null;
  action: string;
  table: TableName;
  row_id: Id;
  before: unknown;
  after: unknown;
  created_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Bản đồ bảng → kiểu dòng
// ---------------------------------------------------------------------------
export interface Tables {
  settings: Settings;
  branches: Branch;
  users: User;
  authorizations: Authorization;
  fields: Field;
  instrument_types: InstrumentType;
  procedures: Procedure;
  standards: Standard;
  customers: Customer;
  devices: Device;
  orders: Order;
  jobs: Job;
  certificates: Certificate;
  seal_batches: SealBatch;
  seals: Seal;
  notifications: Notification;
  audit_logs: AuditLog;
  chat_channels: ChatChannel;
  chat_messages: ChatMessage;
  chat_reads: ChatRead;
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

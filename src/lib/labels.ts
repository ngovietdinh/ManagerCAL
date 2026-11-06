import type { AuthRole, CertKind, CertStatus, JobKind, JobStatus, OrderStatus, Priority, ProcedureStatus, Role, SealStatus, StandardStatus } from "./types";

export type Tone = "gray" | "green" | "red" | "amber" | "orange" | "blue" | "violet" | "cyan" | "pink" | "none";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị", director: "Giám đốc", sales: "Kinh doanh", intake: "Tiếp nhận", technician: "Kiểm định viên",
  reviewer: "Soát xét", signer: "Ký duyệt", qa: "Quản lý chất lượng", accountant: "Kế toán",
};
export const ROLES: Role[] = ["admin", "director", "sales", "intake", "technician", "reviewer", "signer", "qa", "accountant"];

export const AUTH_ROLE_LABEL: Record<AuthRole, string> = { perform: "Thực hiện", review: "Soát xét", sign: "Ký GCN" };

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  received: "Chờ phân công", assigned: "Đã phân công", in_progress: "Đang thực hiện", review: "Chờ soát xét",
  approval: "Chờ phê duyệt", issued: "Đã phát hành", returned: "Đã trả khách", cancelled: "Không thực hiện",
};
export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  received: "gray", assigned: "blue", in_progress: "cyan", review: "amber", approval: "orange", issued: "green", returned: "violet", cancelled: "red",
};
export const JOB_STATUSES: JobStatus[] = ["received", "assigned", "in_progress", "review", "approval", "issued", "returned", "cancelled"];

export const JOB_KIND_LABEL: Record<JobKind, string> = { initial: "Ban đầu", periodic: "Định kỳ", after_repair: "Sau sửa chữa" };
export const PRIORITY_LABEL: Record<Priority, string> = { normal: "Bình thường", urgent: "Gấp" };
export const PRIORITY_TONE: Record<Priority, Tone> = { normal: "gray", urgent: "red" };

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { open: "Đang xử lý", done: "Hoàn thành", cancelled: "Đã huỷ" };
export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = { open: "blue", done: "green", cancelled: "red" };

export const CERT_KIND_LABEL: Record<CertKind, string> = { certificate: "Giấy chứng nhận kiểm định", fail_notice: "Thông báo không đạt" };
export const CERT_STATUS_LABEL: Record<CertStatus, string> = { valid: "Hiệu lực", replaced: "Bị thay thế", revoked: "Đã thu hồi" };
export const CERT_STATUS_TONE: Record<CertStatus, Tone> = { valid: "green", replaced: "amber", revoked: "red" };

export const SEAL_STATUS_LABEL: Record<SealStatus, string> = { stock: "Trong kho", assigned: "Đã cấp", used: "Đã dùng", void: "Huỷ" };
export const SEAL_STATUS_TONE: Record<SealStatus, Tone> = { stock: "gray", assigned: "blue", used: "green", void: "red" };

export const STANDARD_STATUS_LABEL: Record<StandardStatus, string> = { ok: "Sử dụng được", locked: "Khoá (quá hạn)", broken: "Hỏng", retired: "Thanh lý" };
export const STANDARD_STATUS_TONE: Record<StandardStatus, Tone> = { ok: "green", locked: "red", broken: "red", retired: "gray" };

export const PROCEDURE_STATUS_LABEL: Record<ProcedureStatus, string> = { draft: "Nháp", active: "Đang áp dụng", retired: "Hết hiệu lực" };
export const PROCEDURE_STATUS_TONE: Record<ProcedureStatus, Tone> = { draft: "gray", active: "green", retired: "red" };

export const RESULT_LABEL = { pass: "Đạt", fail: "Không đạt" } as const;

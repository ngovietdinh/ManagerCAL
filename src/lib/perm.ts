import type { Role, User } from "./types";

export type Action =
  | "customers"    // thêm/sửa khách hàng, thiết bị khách
  | "orders"       // lập đơn, tiếp nhận, bàn giao
  | "assign"       // phân công
  | "perform"      // thực hiện đo
  | "review"       // soát xét
  | "sign"         // phê duyệt, phát hành, thay thế, thu hồi GCN
  | "catalog"      // lĩnh vực, loại PTĐ, quy trình
  | "standards"    // chuẩn
  | "users"        // nhân sự, ủy quyền
  | "seals"        // tem
  | "reports"      // báo cáo
  | "finance"      // thu tiền
  | "settings"
  | "audit";

const MATRIX: Record<Role, Action[]> = {
  admin: ["customers", "orders", "assign", "perform", "review", "sign", "catalog", "standards", "users", "seals", "reports", "finance", "settings", "audit"],
  director: ["reports", "settings", "audit", "assign"],
  sales: ["customers", "orders", "reports"],
  intake: ["customers", "orders", "assign"],
  technician: ["perform"],
  reviewer: ["review", "perform"],
  signer: ["sign", "review", "assign", "seals", "reports"],
  qa: ["catalog", "standards", "users", "seals", "audit", "reports", "assign"],
  accountant: ["finance", "reports", "customers"],
};

export function can(user: User | null | undefined, action: Action): boolean {
  if (!user || !user.active) return false;
  return user.roles.some((r) => MATRIX[r]?.includes(action));
}

export function hasRole(user: User | null | undefined, ...roles: Role[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r));
}

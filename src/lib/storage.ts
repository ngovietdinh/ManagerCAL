// Ước tính thời gian đến khi đầy dung lượng CSDL (Cloudflare D1: 500 MB / CSDL ở gói miễn phí, 10 GB gói trả phí).
// Đo trên dữ liệu thật: mỗi phiếu kéo theo bao nhiêu byte (phiếu + GCN + đơn + nhật ký + thông báo),
// mỗi tin nhắn bao nhiêu byte; nhân hệ số chỉ mục/trang của SQLite (đo được = kích thước tệp / dữ liệu JSON).

export interface TableStat { tbl: string; n: number; bytes: number; n30: number; bytes30: number; n90: number; oldest?: string | null }
export interface StorageInfo { size_bytes: number | null; limit_bytes: number; tables: TableStat[] }

export const FREE_LIMIT = 500 * 1024 * 1024;
export const PAID_LIMIT = 10 * 1024 * 1024 * 1024;
/** Khi không đo được kích thước tệp (chế độ demo): hệ số chỉ mục + trang SQLite ước tính */
export const DEFAULT_OVERHEAD = 2;
/** Tin nhắn trung bình khi chưa có dữ liệu chat */
export const DEFAULT_MSG_BYTES = 420;
const PER_JOB_TABLES = ["jobs", "certificates", "orders", "audit_logs", "notifications"];

export function analyzeStorage(info: StorageInfo) {
  const t = (name: string) => info.tables.find((x) => x.tbl === name) ?? { tbl: name, n: 0, bytes: 0, n30: 0, bytes30: 0, n90: 0 };
  const dataBytes = info.tables.reduce((s, x) => s + x.bytes, 0);
  const overhead = info.size_bytes && dataBytes ? Math.max(1, info.size_bytes / dataBytes) : DEFAULT_OVERHEAD;
  const size = info.size_bytes ?? Math.round(dataBytes * overhead);
  const jobs = t("jobs");
  const perJob = jobs.n ? PER_JOB_TABLES.reduce((s, x) => s + t(x).bytes, 0) / jobs.n : 0;
  const msgs = t("chat_messages");
  const perMsg = msgs.n ? (msgs.bytes + t("chat_channels").bytes + t("chat_reads").bytes) / msgs.n : DEFAULT_MSG_BYTES;
  // nhịp hiện tại: 30 ngày gần nhất
  return { size, dataBytes, overhead, perJob, perMsg, jobsPerMonth: jobs.n30, msgsPerMonth: msgs.n30 };
}

/** Số tháng còn lại tới giới hạn với nhịp jobsPerMonth phiếu và msgsPerMonth tin nhắn mỗi tháng */
export function monthsUntilFull(a: ReturnType<typeof analyzeStorage>, limit: number, jobsPerMonth: number, msgsPerMonth: number): number {
  const perMonth = (a.perJob * jobsPerMonth + a.perMsg * msgsPerMonth) * a.overhead;
  if (perMonth <= 0) return Infinity;
  return Math.max(0, (limit - a.size) / perMonth);
}

export const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2).replace(".", ",")} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export function fmtMonths(m: number) {
  if (!Number.isFinite(m)) return "không đầy (chưa có dữ liệu phát sinh)";
  if (m < 1) return "dưới 1 tháng";
  if (m < 24) return `khoảng ${Math.round(m)} tháng`;
  const y = m / 12;
  return y >= 100 ? "hơn 100 năm" : `khoảng ${y >= 10 ? Math.round(y) : y.toFixed(1).replace(".", ",")} năm`;
}

/** Thống kê từ dữ liệu trong trình duyệt (chế độ demo) */
export function statsFromData(data: Record<string, { created_at?: string }[]>): StorageInfo {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const tables = Object.entries(data).map(([tbl, rows]) => {
    let bytes = 0, n30 = 0, bytes30 = 0, n90 = 0;
    for (const r of rows) {
      const b = new TextEncoder().encode(JSON.stringify(r)).length;
      bytes += b;
      if ((r.created_at ?? "") >= since30) { n30++; bytes30 += b; }
      if ((r.created_at ?? "") >= since90) n90++;
    }
    return { tbl, n: rows.length, bytes, n30, bytes30, n90 };
  });
  return { size_bytes: null, limit_bytes: FREE_LIMIT, tables };
}

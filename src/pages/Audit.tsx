import { useMemo, useState } from "react";
import { useData, useIndex, useTable } from "@/app/data";
import { Button, Empty, Field, Input, Loading, Modal, PageHeader, Select } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

const PAGE = 50;
const ACTION_LABEL: Record<string, string> = {
  create: "Tạo mới", update: "Cập nhật", delete: "Xoá", assign: "Phân công", save_readings: "Lưu số liệu", submit: "Nộp soát xét",
  review_ok: "Soát xét đạt", review_return: "Trả lại (soát xét)", approval_return: "Trả lại (phê duyệt)", issue: "Phát hành",
  return_device: "Trả thiết bị", cancel: "Không thực hiện", replace: "Thay thế GCN", revoke: "Thu hồi GCN", auto_lock: "Tự khoá chuẩn", assign_seals: "Cấp tem",
};
const TABLE_LABEL: Record<string, string> = {
  settings: "Cài đặt", branches: "Chi nhánh", users: "Nhân sự", authorizations: "Ủy quyền", fields: "Lĩnh vực", instrument_types: "Loại PTĐ", procedures: "Quy trình",
  standards: "Chuẩn", customers: "Khách hàng", devices: "Thiết bị", orders: "Đơn hàng", jobs: "Phiếu", certificates: "GCN", seal_batches: "Lô tem", seals: "Tem",
  notifications: "Thông báo", audit_logs: "Nhật ký",
};

function Diff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).filter((k) => k !== "history");
  const changed = new Set(keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])));
  const fmt = (v: unknown) => (v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v, null, 1) : String(v));
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className={changed.has(k) ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
            <td className="font-mono text-xs">{k}</td>
            <td className="max-w-xs whitespace-pre-wrap break-all font-mono text-xs">{fmt(b[k])}</td>
            <td className="max-w-xs whitespace-pre-wrap break-all font-mono text-xs">{fmt(a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

export default function Audit() {
  const { users } = useData();
  const { rows, loading } = useTable("audit_logs", { orderBy: { field: "created_at", dir: "desc" } });
  const userIdx = useIndex("users");
  const [table, setTable] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<AuditLog | null>(null);

  const filtered = useMemo(() => rows.filter((r) =>
    (!table || r.table === table) && (!user || r.user_id === user) && (!action || r.action === action) && (!q || r.row_id.toLowerCase().includes(q.toLowerCase())),
  ), [rows, table, user, action, q]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);
  const tables = useMemo(() => Array.from(new Set(rows.map((r) => r.table))).sort(), [rows]);
  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  return (
    <>
      <PageHeader title="Nhật ký thao tác" subtitle="Ai sửa gì, lúc nào, giá trị trước và sau. Không sửa, không xoá được." />
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Select value={table} onChange={(e) => { setTable(e.target.value); setPage(0); }}><option value="">Mọi bảng</option>{tables.map((t) => <option key={t} value={t}>{TABLE_LABEL[t] ?? t}</option>)}</Select>
        <Select value={user} onChange={(e) => { setUser(e.target.value); setPage(0); }}><option value="">Mọi người</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}><option value="">Mọi hành động</option>{actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}</Select>
        <Input placeholder="Tìm theo id dòng…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty text="Không có dòng nhật ký nào khớp bộ lọc." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Thời gian</th><th>Người</th><th>Hành động</th><th>Bảng</th><th>Id</th><th></th></tr></thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.created_at)}</td>
                  <td>{r.user_id ? userIdx[r.user_id]?.full_name ?? r.user_id : <span className="text-slate-400">Hệ thống</span>}</td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td>{TABLE_LABEL[r.table] ?? r.table}</td>
                  <td className="font-mono text-xs text-slate-500" title={r.row_id}>{r.row_id.slice(0, 8)}…</td>
                  <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setView(r)}>Xem</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
            <span>{filtered.length} dòng</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Trước</Button>
              <span className="tabular-nums">Trang {page + 1}/{pages}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        </div>
      )}
      <Modal open={!!view} onClose={() => setView(null)} size="xl" title={view ? `${ACTION_LABEL[view.action] ?? view.action} · ${TABLE_LABEL[view.table] ?? view.table}` : ""}>
        {view && (
          <>
            <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
              <Field label="Thời gian"><div>{fmtDateTime(view.created_at)}</div></Field>
              <Field label="Người"><div>{view.user_id ? userIdx[view.user_id]?.full_name ?? view.user_id : "Hệ thống"}</div></Field>
              <Field label="Id dòng"><div className="break-all font-mono text-xs">{view.row_id}</div></Field>
            </div>
            <div className="overflow-x-auto"><Diff before={view.before} after={view.after} /></div>
          </>
        )}
      </Modal>
    </>
  );
}

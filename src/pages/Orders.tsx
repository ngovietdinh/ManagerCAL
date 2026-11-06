import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Input, PageHeader, Tabs, useUi } from "@/components/ui";
import { matches } from "@/components/aHelpers";
import { fmtDate, money, todayStr } from "@/lib/format";
import { JOB_STATUS_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/labels";
import type { Job, JobStatus } from "@/lib/types";

const DOT: Record<JobStatus, string> = {
  received: "bg-slate-400", assigned: "bg-sky-500", in_progress: "bg-cyan-500", review: "bg-amber-500", approval: "bg-orange-500", issued: "bg-emerald-500", returned: "bg-violet-500", cancelled: "bg-red-500",
};

type Tab = "open" | "done" | "all";

/** Tóm tắt phiếu của đơn: chấm màu theo trạng thái + "n/N đã phát hành" */
export function JobDots({ jobs }: { jobs: Job[] }) {
  const done = jobs.filter((j) => ["issued", "returned"].includes(j.status)).length;
  const groups = Object.entries(jobs.reduce<Record<string, number>>((m, j) => { m[j.status] = (m[j.status] ?? 0) + 1; return m; }, {}));
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">{done}/{jobs.length} đã phát hành</span>
      <span className="flex gap-0.5">
        {groups.map(([s, n]) => <span key={s} title={`${JOB_STATUS_LABEL[s as JobStatus]}: ${n}`} className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[s as JobStatus]}`} />)}
      </span>
    </div>
  );
}

export default function Orders() {
  const { svc, can } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const { rows: orders, loading } = useTable("orders", { orderBy: { field: "received_at", dir: "desc" } });
  const { rows: jobs } = useTable("jobs");
  const customers = useIndex("customers");
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");

  const jobsByOrder = useMemo(() => {
    const m: Record<string, Job[]> = {};
    for (const j of jobs) (m[j.order_id] ??= []).push(j);
    return m;
  }, [jobs]);

  const list = orders.filter((o) => (tab === "all" || (tab === "open" ? o.status === "open" : o.status === "done")) && matches(q, o.code, customers[o.customer_id]?.name, customers[o.customer_id]?.code, o.contact_name));

  const markPaid = async (id: string, paid: boolean) => {
    try { await svc.setOrderPaid(id, paid, todayStr()); ui.toast(paid ? "Đã ghi nhận thu tiền" : "Đã bỏ đánh dấu thu tiền"); } catch (e) { ui.error(e); }
  };

  return (
    <>
      <PageHeader title="Đơn hàng, tiếp nhận" subtitle={`${orders.filter((o) => o.status === "open").length} đơn đang xử lý`}
        actions={can("orders") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav("/orders/new")}>Tiếp nhận đơn mới</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "open", label: "Đang xử lý", count: orders.filter((o) => o.status === "open").length }, { value: "done", label: "Hoàn thành" }, { value: "all", label: "Tất cả" },
        ]} />
        <Input placeholder="Tìm mã đơn, khách hàng…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Card bodyClass="p-0">
        {loading ? null : list.length === 0 ? <Empty text="Không có đơn hàng nào." action={can("orders") && <Button size="sm" onClick={() => nav("/orders/new")}>Tiếp nhận đơn mới</Button>} /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày nhận</th><th>Hẹn trả</th><th>Nơi làm</th><th>Phiếu</th><th className="num">Tổng tiền</th><th>Thu tiền</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {list.map((o) => {
                  const js = jobsByOrder[o.id] ?? [];
                  const late = o.status === "open" && o.expected_at && o.expected_at < todayStr();
                  return (
                    <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/orders/${o.id}`)}>
                      <td className="font-medium">{o.code}{js.some((j) => j.priority === "urgent") && <Badge tone="red" className="ml-1">Gấp</Badge>}</td>
                      <td className="max-w-64 truncate">{customers[o.customer_id]?.name ?? "–"}</td>
                      <td>{fmtDate(o.received_at)}</td>
                      <td className={late ? "font-medium text-red-700" : ""}>{fmtDate(o.expected_at)}</td>
                      <td>{o.onsite ? <Badge tone="cyan">Hiện trường</Badge> : <span className="text-slate-500">Tại PTN</span>}</td>
                      <td><JobDots jobs={js} /></td>
                      <td className="num">{money(o.total_amount)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {o.paid ? <Badge tone="green">Đã thu {fmtDate(o.paid_at)}</Badge> : can("finance") ? <Button size="sm" variant="secondary" className="min-h-7" onClick={() => markPaid(o.id, true)}>Ghi đã thu</Button> : <Badge tone="amber">Chưa thu</Badge>}
                      </td>
                      <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

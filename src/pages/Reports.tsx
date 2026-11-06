import { Download } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Stat, Tabs } from "@/components/ui";
import { exportXlsx, type SheetSpec } from "@/lib/excel";
import { dayjs, fmtDate, todayStr, vnd } from "@/lib/format";
import { CERT_STATUS_LABEL, CERT_STATUS_TONE, JOB_STATUS_LABEL, JOB_STATUS_TONE, SEAL_STATUS_LABEL } from "@/lib/labels";
import type { Certificate, Job } from "@/lib/types";

type Tab = "certs" | "seals" | "passrate" | "revenue" | "productivity" | "progress" | "due" | "debt" | "authority";
const TABS: { value: Tab; label: string }[] = [
  { value: "certs", label: "Sổ cấp GCN" },
  { value: "seals", label: "Sổ sử dụng tem" },
  { value: "passrate", label: "Đạt / Không đạt" },
  { value: "revenue", label: "Doanh thu" },
  { value: "productivity", label: "Năng suất KĐV" },
  { value: "progress", label: "Tiến độ" },
  { value: "due", label: "Thiết bị đến hạn" },
  { value: "debt", label: "Công nợ" },
  { value: "authority", label: "Báo cáo cơ quan quản lý" },
];

const C_BRAND = "#1e56a0", C_PASS = "#1d6b52", C_FAIL = "#b3261e", C_AXIS = "#64748b", C_GRID = "#e2e8f0";
const DONE = ["issued", "returned"];

/** Bảng + nút xuất Excel dùng chung cho mọi báo cáo */
function ReportTable<R extends Record<string, unknown>>({ title, file, columns, rows, footer }: {
  title: string; file: string; rows: R[]; footer?: ReactNode;
  columns: { key: keyof R & string; header: string; num?: boolean; render?: (r: R) => ReactNode; xlsx?: (r: R) => unknown; width?: number }[];
}) {
  const doExport = () => {
    const sheet: SheetSpec = {
      name: title, title,
      columns: columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 })),
      rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.xlsx ? c.xlsx(r) : r[c.key]]))),
    };
    exportXlsx(file, [sheet]);
  };
  return (
    <Card title={title} bodyClass="p-0" actions={<Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={doExport} disabled={!rows.length}>Xuất Excel</Button>}>
      {rows.length === 0 ? <Empty text="Không có dữ liệu trong kỳ đã chọn." /> : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "num" : undefined}>{c.header}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key} className={c.num ? "num" : undefined}>{c.render ? c.render(r) : (r[c.key] as ReactNode) ?? "–"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {footer && <div className="border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">{footer}</div>}
    </Card>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>("certs");
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(todayStr());
  const [branch, setBranch] = useState("");

  const { rows: certsAll } = useTable("certificates");
  const { rows: jobsAll } = useTable("jobs");
  const { rows: ordersAll } = useTable("orders");
  const { rows: sealsAll } = useTable("seals");
  const { rows: devices } = useTable("devices", { where: { status: "active" } });
  const { rows: branches } = useTable("branches");
  const customers = useIndex("customers");
  const types = useIndex("instrument_types");
  const fields = useIndex("fields");
  const users = useIndex("users");
  const ordersIdx = useIndex("orders");
  const certsIdx = useIndex("certificates");

  const inBranch = (b: string | null) => !branch || b === branch;
  const inRange = (d: string | null | undefined) => !!d && d >= from && d <= to;

  // GCN trong kỳ (kể cả bị thay thế/thu hồi: sổ cấp ghi mọi số đã cấp)
  const certs = useMemo(() => certsAll.filter((c) => inRange(c.issued_at) && inBranch(c.branch_id)).sort((a, b) => a.number.localeCompare(b.number)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [certsAll, from, to, branch]);
  // Phiếu đã phát hành trong kỳ: theo ngày cấp GCN gốc của phiếu
  const issuedJobs = useMemo(() => jobsAll.filter((j) => {
    if (!DONE.includes(j.status) || !inBranch(j.branch_id)) return false;
    const c = j.certificate_id ? certsIdx[j.certificate_id] : null;
    return !!c && inRange(c.issued_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [jobsAll, certsIdx, from, to, branch]);

  const custName = (id: string) => customers[id]?.name ?? "–";
  const typeName = (id: string) => types[id]?.name ?? "–";
  const userName = (id: string | null) => (id ? users[id]?.full_name ?? "–" : "–");
  const issuedAt = (j: Job) => (j.certificate_id ? certsIdx[j.certificate_id]?.issued_at ?? null : null);

  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Lọc theo kỳ và chi nhánh; mọi bảng xuất được Excel." />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Từ ngày"><Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label="Đến ngày"><Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
        <Field label="Chi nhánh">
          <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Tất cả</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["Tháng này", dayjs().startOf("month"), dayjs()],
            ["Tháng trước", dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")],
            ["Quý này", dayjs().startOf("month").subtract((dayjs().month() % 3), "month"), dayjs()],
            ["Năm nay", dayjs().startOf("year"), dayjs()],
          ].map(([label, a, b]) => (
            <Button key={label as string} size="sm" variant="ghost" className="min-h-7" onClick={() => { setFrom((a as dayjs.Dayjs).format("YYYY-MM-DD")); setTo((b as dayjs.Dayjs).format("YYYY-MM-DD")); }}>{label as string}</Button>
          ))}
        </div>
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={TABS} />

      {tab === "certs" && (
        <ReportTable title="Sổ cấp giấy chứng nhận kiểm định" file={`so-cap-gcn_${from}_${to}`} rows={certs as (Certificate & Record<string, unknown>)[]}
          columns={[
            { key: "number", header: "Số GCN", render: (c) => <Link className="link" to={`/certificates/${c.id}`}>{c.number}</Link> },
            { key: "issued_at", header: "Ngày cấp", render: (c) => fmtDate(c.issued_at), xlsx: (c) => fmtDate(c.issued_at) },
            { key: "customer_id", header: "Khách hàng", render: (c) => c.snapshot.customer.name, xlsx: (c) => c.snapshot.customer.name, width: 32 },
            { key: "device_id", header: "Phương tiện đo", render: (c) => c.snapshot.device.name, xlsx: (c) => c.snapshot.device.name, width: 24 },
            { key: "snapshot", header: "Số sê-ri", render: (c) => c.snapshot.device.serial ?? "–", xlsx: (c) => c.snapshot.device.serial },
            { key: "kind", header: "Kết luận", render: (c) => <Badge tone={c.kind === "certificate" ? "green" : "red"}>{c.kind === "certificate" ? "Đạt" : "Không đạt"}</Badge>, xlsx: (c) => (c.kind === "certificate" ? "Đạt" : "Không đạt") },
            { key: "valid_to", header: "Hiệu lực đến", render: (c) => fmtDate(c.valid_to), xlsx: (c) => fmtDate(c.valid_to) },
            { key: "seal_no", header: "Số tem", render: (c) => (c.seal_no ? <span className="seal-no">{c.seal_no}</span> : "–") },
            { key: "signer_id", header: "Người ký", render: (c) => c.snapshot.signer.full_name, xlsx: (c) => c.snapshot.signer.full_name },
            { key: "status", header: "Trạng thái", render: (c) => <Badge tone={CERT_STATUS_TONE[c.status]}>{CERT_STATUS_LABEL[c.status]}</Badge>, xlsx: (c) => CERT_STATUS_LABEL[c.status] },
          ]}
          footer={<>Tổng: <b>{certs.length}</b> số đã cấp · {certs.filter((c) => c.kind === "certificate").length} GCN · {certs.filter((c) => c.kind === "fail_notice").length} thông báo không đạt · {certs.filter((c) => c.status !== "valid").length} bị thay thế / thu hồi</>}
        />
      )}

      {tab === "seals" && (() => {
        const used = sealsAll.filter((s) => s.status === "used" && inRange(s.used_at)).sort((a, b) => a.seq - b.seq);
        const count = (st: string) => sealsAll.filter((s) => s.status === st).length;
        return (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(["stock", "assigned", "used", "void"] as const).map((st) => <Stat key={st} label={SEAL_STATUS_LABEL[st]} value={count(st)} />)}
            </div>
            <ReportTable title="Sổ sử dụng tem kiểm định" file={`so-tem_${from}_${to}`} rows={used as never[]}
              columns={[
                { key: "number", header: "Số tem", render: (s) => <span className="seal-no">{(s as { number: string }).number}</span>, xlsx: (s) => (s as { number: string }).number },
                { key: "used_at", header: "Ngày dùng", render: (s) => fmtDate((s as { used_at: string }).used_at), xlsx: (s) => fmtDate((s as { used_at: string }).used_at) },
                { key: "certificate_id", header: "GCN", render: (s) => certsIdx[(s as { certificate_id: string }).certificate_id]?.number ?? "–", xlsx: (s) => certsIdx[(s as { certificate_id: string }).certificate_id]?.number },
                { key: "assigned_to", header: "Người giữ", render: (s) => userName((s as { assigned_to: string | null }).assigned_to), xlsx: (s) => userName((s as { assigned_to: string | null }).assigned_to) },
              ]}
              footer={<>Đã dùng trong kỳ: <b>{used.length}</b> tem</>}
            />
          </div>
        );
      })()}

      {tab === "passrate" && (() => {
        const byType = new Map<string, { type: string; total: number; pass: number; fail: number }>();
        for (const j of issuedJobs) {
          const r = byType.get(j.instrument_type_id) ?? { type: typeName(j.instrument_type_id), total: 0, pass: 0, fail: 0 };
          r.total++; if (j.conclusion === "pass") r.pass++; else r.fail++;
          byType.set(j.instrument_type_id, r);
        }
        const rows = [...byType.values()].sort((a, b) => b.total - a.total).map((r) => ({ ...r, rate: r.total ? Math.round((r.pass / r.total) * 1000) / 10 : 0 }));
        return (
          <div className="grid gap-4">
            {rows.length > 0 && (
              <Card title="Số phương tiện đo theo loại">
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={rows} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={C_GRID} />
                      <XAxis dataKey="type" tick={{ fontSize: 12, fill: C_AXIS }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 12, fill: C_AXIS }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="pass" name="Đạt" stackId="a" fill={C_PASS} />
                      <Bar dataKey="fail" name="Không đạt" stackId="a" fill={C_FAIL} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            <ReportTable title="Thống kê kết quả kiểm định theo loại phương tiện đo" file={`dat-khong-dat_${from}_${to}`} rows={rows}
              columns={[
                { key: "type", header: "Loại phương tiện đo", width: 30 },
                { key: "total", header: "Số lượng", num: true },
                { key: "pass", header: "Đạt", num: true },
                { key: "fail", header: "Không đạt", num: true },
                { key: "rate", header: "Tỷ lệ đạt (%)", num: true, render: (r) => `${r.rate.toLocaleString("vi-VN")} %` },
              ]}
              footer={<>Tổng: <b>{issuedJobs.length}</b> phương tiện đo · đạt {issuedJobs.filter((j) => j.conclusion === "pass").length}</>}
            />
          </div>
        );
      })()}

      {tab === "revenue" && (() => {
        const byCust = new Map<string, { customer: string; jobs: number; amount: number; paid: number; unpaid: number }>();
        const byField = new Map<string, { field: string; jobs: number; amount: number }>();
        for (const j of issuedJobs) {
          const paid = ordersIdx[j.order_id]?.paid ?? false;
          const c = byCust.get(j.customer_id) ?? { customer: custName(j.customer_id), jobs: 0, amount: 0, paid: 0, unpaid: 0 };
          c.jobs++; c.amount += j.price; if (paid) c.paid += j.price; else c.unpaid += j.price;
          byCust.set(j.customer_id, c);
          const fid = types[j.instrument_type_id]?.field_id ?? "";
          const f = byField.get(fid) ?? { field: fields[fid]?.name ?? "–", jobs: 0, amount: 0 };
          f.jobs++; f.amount += j.price; byField.set(fid, f);
        }
        // 12 tháng gần nhất (không phụ thuộc bộ lọc ngày)
        const months = Array.from({ length: 12 }, (_, i) => dayjs().subtract(11 - i, "month").format("YYYY-MM"));
        const monthly = months.map((m) => ({
          month: dayjs(m + "-01").format("MM/YY"),
          amount: jobsAll.filter((j) => DONE.includes(j.status) && inBranch(j.branch_id) && (issuedAt(j) ?? "").startsWith(m)).reduce((s, j) => s + j.price, 0),
        }));
        const total = [...byCust.values()].reduce((s, r) => s + r.amount, 0);
        return (
          <div className="grid gap-4">
            <Card title="Doanh thu 12 tháng gần nhất (theo ngày phát hành GCN)">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={monthly} margin={{ top: 6, right: 8, left: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={C_GRID} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: C_AXIS }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: C_AXIS }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("vi-VN")} tr` : v.toLocaleString("vi-VN"))} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [vnd(v as number), "Doanh thu"]} />
                    <Bar dataKey="amount" fill={C_BRAND} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <ReportTable title="Doanh thu theo khách hàng" file={`doanh-thu-khach_${from}_${to}`} rows={[...byCust.values()].sort((a, b) => b.amount - a.amount)}
              columns={[
                { key: "customer", header: "Khách hàng", width: 36 },
                { key: "jobs", header: "Số PTĐ", num: true },
                { key: "amount", header: "Doanh thu", num: true, render: (r) => vnd(r.amount) },
                { key: "paid", header: "Đã thu", num: true, render: (r) => vnd(r.paid) },
                { key: "unpaid", header: "Chưa thu", num: true, render: (r) => (r.unpaid ? <span className="font-medium text-red-700 dark:text-red-300">{vnd(r.unpaid)}</span> : vnd(0)) },
              ]}
              footer={<>Tổng doanh thu trong kỳ: <b>{vnd(total)}</b></>}
            />
            <ReportTable title="Doanh thu theo lĩnh vực đo" file={`doanh-thu-linh-vuc_${from}_${to}`} rows={[...byField.values()].sort((a, b) => b.amount - a.amount)}
              columns={[
                { key: "field", header: "Lĩnh vực", width: 30 },
                { key: "jobs", header: "Số PTĐ", num: true },
                { key: "amount", header: "Doanh thu", num: true, render: (r) => vnd(r.amount) },
              ]}
            />
          </div>
        );
      })()}

      {tab === "productivity" && (() => {
        const byUser = new Map<string, { name: string; issued: number; pass: number; returned: number; tatSum: number; tatN: number }>();
        for (const j of issuedJobs) {
          if (!j.assignee_id) continue;
          const r = byUser.get(j.assignee_id) ?? { name: userName(j.assignee_id), issued: 0, pass: 0, returned: 0, tatSum: 0, tatN: 0 };
          r.issued++; if (j.conclusion === "pass") r.pass++;
          r.returned += j.history.filter((h) => h.action.includes("Trả lại")).length;
          const rec = ordersIdx[j.order_id]?.received_at, iss = issuedAt(j);
          if (rec && iss) { r.tatSum += dayjs(iss).diff(dayjs(rec), "day"); r.tatN++; }
          byUser.set(j.assignee_id, r);
        }
        const rows = [...byUser.values()].sort((a, b) => b.issued - a.issued).map((r) => ({ ...r, tat: r.tatN ? Math.round((r.tatSum / r.tatN) * 10) / 10 : null }));
        return (
          <ReportTable title="Năng suất kiểm định viên" file={`nang-suat_${from}_${to}`} rows={rows}
            columns={[
              { key: "name", header: "Kiểm định viên", width: 26 },
              { key: "issued", header: "PTĐ đã phát hành", num: true },
              { key: "pass", header: "Đạt", num: true },
              { key: "returned", header: "Số lần bị trả lại", num: true, render: (r) => (r.returned ? <Badge tone="amber">{r.returned}</Badge> : "0") },
              { key: "tat", header: "Thời gian trả TB (ngày)", num: true, render: (r) => (r.tat == null ? "–" : r.tat.toLocaleString("vi-VN")) },
            ]}
          />
        );
      })()}

      {tab === "progress" && (() => {
        const today = todayStr();
        const late = jobsAll.filter((j) => inBranch(j.branch_id) && j.due_date && j.due_date < today && !["issued", "returned", "cancelled"].includes(j.status))
          .map((j) => ({ ...j, late: dayjs(today).diff(dayjs(j.due_date), "day") })).sort((a, b) => b.late - a.late);
        const tatByField = new Map<string, { field: string; n: number; sum: number }>();
        for (const j of issuedJobs) {
          const fid = types[j.instrument_type_id]?.field_id ?? "";
          const rec = ordersIdx[j.order_id]?.received_at, iss = issuedAt(j);
          if (!rec || !iss) continue;
          const r = tatByField.get(fid) ?? { field: fields[fid]?.name ?? "–", n: 0, sum: 0 };
          r.n++; r.sum += dayjs(iss).diff(dayjs(rec), "day"); tatByField.set(fid, r);
        }
        return (
          <div className="grid gap-4">
            <ReportTable title={`Phiếu trễ hạn trả (tính đến ${fmtDate(today)})`} file={`tre-han_${today}`} rows={late}
              columns={[
                { key: "code", header: "Phiếu", render: (j) => <Link className="link" to={`/jobs/${j.id}`}>{j.code}</Link>, xlsx: (j) => j.code },
                { key: "customer_id", header: "Khách hàng", render: (j) => custName(j.customer_id), xlsx: (j) => custName(j.customer_id), width: 30 },
                { key: "instrument_type_id", header: "Loại PTĐ", render: (j) => typeName(j.instrument_type_id), xlsx: (j) => typeName(j.instrument_type_id) },
                { key: "due_date", header: "Hẹn trả", render: (j) => fmtDate(j.due_date), xlsx: (j) => fmtDate(j.due_date) },
                { key: "late", header: "Trễ (ngày)", num: true, render: (j) => <span className="font-semibold text-red-700 dark:text-red-300">{j.late}</span> },
                { key: "assignee_id", header: "KĐV", render: (j) => userName(j.assignee_id), xlsx: (j) => userName(j.assignee_id) },
                { key: "status", header: "Trạng thái", render: (j) => <Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge>, xlsx: (j) => JOB_STATUS_LABEL[j.status] },
              ]}
            />
            <ReportTable title="Thời gian trả kết quả trung bình theo lĩnh vực (trong kỳ)" file={`tat-linh-vuc_${from}_${to}`}
              rows={[...tatByField.values()].map((r) => ({ ...r, avg: Math.round((r.sum / r.n) * 10) / 10 }))}
              columns={[
                { key: "field", header: "Lĩnh vực", width: 30 },
                { key: "n", header: "Số PTĐ", num: true },
                { key: "avg", header: "TB từ tiếp nhận đến phát hành (ngày)", num: true, render: (r) => r.avg.toLocaleString("vi-VN") },
              ]}
            />
          </div>
        );
      })()}

      {tab === "due" && <DueReport devices={devices} custName={custName} typeName={typeName} types={types} userName={userName} customers={customers} />}

      {tab === "debt" && (() => {
        const today = todayStr();
        const unpaid = ordersAll.filter((o) => !o.paid && o.status !== "cancelled" && inBranch(o.branch_id) && o.total_amount > 0)
          .map((o) => ({ ...o, age: dayjs(today).diff(dayjs(o.received_at), "day") })).sort((a, b) => b.age - a.age);
        const total = unpaid.reduce((s, o) => s + o.total_amount, 0);
        return (
          <ReportTable title={`Công nợ chưa thu (tính đến ${fmtDate(today)})`} file={`cong-no_${today}`} rows={unpaid}
            columns={[
              { key: "code", header: "Đơn hàng", render: (o) => <Link className="link" to={`/orders/${o.id}`}>{o.code}</Link>, xlsx: (o) => o.code },
              { key: "customer_id", header: "Khách hàng", render: (o) => custName(o.customer_id), xlsx: (o) => custName(o.customer_id), width: 34 },
              { key: "received_at", header: "Ngày nhận", render: (o) => fmtDate(o.received_at), xlsx: (o) => fmtDate(o.received_at) },
              { key: "status", header: "Đơn", render: (o) => (o.status === "done" ? "Hoàn thành" : "Đang xử lý"), xlsx: (o) => (o.status === "done" ? "Hoàn thành" : "Đang xử lý") },
              { key: "total_amount", header: "Số tiền", num: true, render: (o) => vnd(o.total_amount) },
              { key: "age", header: "Số ngày", num: true, render: (o) => <Badge tone={o.age > 30 ? "red" : o.age > 15 ? "amber" : "gray"}>{o.age}</Badge>, xlsx: (o) => o.age },
            ]}
            footer={<>Tổng công nợ: <b>{vnd(total)}</b> · {unpaid.length} đơn</>}
          />
        );
      })()}

      {tab === "authority" && (() => {
        const byType = new Map<string, { code: string; type: string; total: number; pass: number; fail: number }>();
        for (const j of issuedJobs) {
          const t = types[j.instrument_type_id];
          const r = byType.get(j.instrument_type_id) ?? { code: t?.code ?? "", type: t?.name ?? "–", total: 0, pass: 0, fail: 0 };
          r.total++; if (j.conclusion === "pass") r.pass++; else r.fail++;
          byType.set(j.instrument_type_id, r);
        }
        const rows = [...byType.values()].sort((a, b) => a.code.localeCompare(b.code)).map((r, i) => ({ stt: i + 1, ...r }));
        return (
          <ReportTable title={`Tổng hợp kết quả kiểm định phương tiện đo từ ${fmtDate(from)} đến ${fmtDate(to)}`} file={`bao-cao-dinh-ky_${from}_${to}`} rows={rows}
            columns={[
              { key: "stt", header: "STT", num: true, width: 6 },
              { key: "type", header: "Tên phương tiện đo", width: 32 },
              { key: "total", header: "Số lượng kiểm định", num: true },
              { key: "pass", header: "Đạt", num: true },
              { key: "fail", header: "Không đạt", num: true },
            ]}
            footer={<span className="text-slate-500">Mẫu biểu theo hướng dẫn hiện hành của cơ quan quản lý đo lường – chỉnh cột khi có mẫu chính thức. Tổng: <b className="text-slate-800 dark:text-slate-100">{issuedJobs.length}</b> phương tiện đo.</span>}
          />
        );
      })()}
    </>
  );
}

function DueReport({ devices, custName, typeName, types, userName, customers }: {
  devices: { id: string; customer_id: string; instrument_type_id: string; name: string; serial: string | null; next_due: string | null }[];
  custName: (id: string) => string; typeName: (id: string) => string; userName: (id: string | null) => string;
  types: Record<string, { default_price: number }>; customers: Record<string, { sales_user_id: string | null }>;
}) {
  const [days, setDays] = useState(30);
  const today = todayStr();
  const limit = dayjs().add(days, "day").format("YYYY-MM-DD");
  const rows = devices.filter((d) => d.next_due && d.next_due <= limit).sort((a, b) => a.next_due!.localeCompare(b.next_due!))
    .map((d) => ({ ...d, price: types[d.instrument_type_id]?.default_price ?? 0, overdue: d.next_due! < today }));
  const potential = rows.reduce((s, r) => s + r.price, 0);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-300">Đến hạn trong</span>
        {[30, 60, 90].map((n) => <Button key={n} size="sm" variant={days === n ? "primary" : "secondary"} className="min-h-7" onClick={() => setDays(n)}>{n} ngày</Button>)}
        <span className="text-sm text-slate-500">(gồm cả thiết bị đã quá hạn)</span>
      </div>
      <ReportTable title="Thiết bị của khách đến hạn kiểm định" file={`den-han_${days}-ngay_${today}`} rows={rows}
        columns={[
          { key: "customer_id", header: "Khách hàng", render: (d) => <Link className="link" to={`/customers/${d.customer_id}`}>{custName(d.customer_id)}</Link>, xlsx: (d) => custName(d.customer_id), width: 34 },
          { key: "name", header: "Thiết bị", width: 24 },
          { key: "instrument_type_id", header: "Loại PTĐ", render: (d) => typeName(d.instrument_type_id), xlsx: (d) => typeName(d.instrument_type_id) },
          { key: "serial", header: "Số sê-ri" },
          { key: "next_due", header: "Hạn", render: (d) => <Badge tone={d.overdue ? "red" : "amber"}>{fmtDate(d.next_due)}</Badge>, xlsx: (d) => fmtDate(d.next_due) },
          { key: "id", header: "NV kinh doanh", render: (d) => userName(customers[d.customer_id]?.sales_user_id ?? null), xlsx: (d) => userName(customers[d.customer_id]?.sales_user_id ?? null) },
          { key: "price", header: "Đơn giá tham khảo", num: true, render: (d) => vnd(d.price) },
        ]}
        footer={<>{rows.length} thiết bị ({rows.filter((r) => r.overdue).length} đã quá hạn) · Doanh thu tiềm năng: <b>{vnd(potential)}</b></>}
      />
    </div>
  );
}

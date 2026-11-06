import { Download, Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, NumberInput, PageHeader, Select, Stat, Tabs, Textarea, useUi } from "@/components/ui";
import { exportXlsx } from "@/lib/excel";
import { fmtDate, todayStr } from "@/lib/format";
import { SEAL_STATUS_LABEL, SEAL_STATUS_TONE } from "@/lib/labels";
import type { Seal, SealStatus } from "@/lib/types";

type Tab = "book" | "batches" | "assign";
const PAGE = 100;

export default function Seals() {
  const ui = useUi();
  const { svc, can, users } = useData();
  const { rows: seals, loading } = useTable("seals", { orderBy: { field: "seq" } });
  const { rows: batches } = useTable("seal_batches", { orderBy: { field: "received_at", dir: "desc" } });
  const certs = useIndex("certificates");
  const userIdx = useIndex("users");
  const [tab, setTab] = useState<Tab>("book");
  const [status, setStatus] = useState<SealStatus | "">("");
  const [batch, setBatch] = useState("");
  const [holder, setHolder] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [voidSeal, setVoidSeal] = useState<Seal | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [nb, setNb] = useState({ prefix: "KĐV-", from_no: 1, to_no: 100, received_at: todayStr(), note: "" });
  const [busy, setBusy] = useState(false);
  // cấp tem
  const [asgUser, setAsgUser] = useState("");
  const [asgMode, setAsgMode] = useState<"range" | "count">("count");
  const [asgFrom, setAsgFrom] = useState(1);
  const [asgTo, setAsgTo] = useState(10);
  const [asgCount, setAsgCount] = useState(20);

  const counts = useMemo(() => {
    const c: Record<SealStatus, number> = { stock: 0, assigned: 0, used: 0, void: 0 };
    for (const s of seals) c[s.status]++;
    return c;
  }, [seals]);
  const batchIdx = useMemo(() => Object.fromEntries(batches.map((b) => [b.id, b])), [batches]);
  const filtered = useMemo(() => seals.filter((s) =>
    (!status || s.status === status) && (!batch || s.batch_id === batch) && (!holder || s.assigned_to === holder) && (!q || s.number.toLowerCase().includes(q.trim().toLowerCase()))),
  [seals, status, batch, holder, q]);
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const holders = users.filter((u) => u.active && (u.roles.includes("signer") || u.roles.includes("technician") || u.roles.includes("admin")));

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); ui.toast(ok); return true; } catch (e) { ui.error(e); return false; } finally { setBusy(false); }
  };

  const exportBook = () => exportXlsx("so-tem", [{
    name: "Sổ tem", title: "SỔ THEO DÕI TEM KIỂM ĐỊNH",
    columns: [{ header: "Số tem", key: "number", width: 16 }, { header: "Lô", key: "batch", width: 18 }, { header: "Trạng thái", key: "status", width: 12 }, { header: "Người giữ", key: "holder", width: 22 }, { header: "GCN", key: "cert", width: 18 }, { header: "Ngày dùng", key: "used", width: 12 }, { header: "Lý do huỷ", key: "reason", width: 30 }],
    rows: filtered.map((s) => ({ number: s.number, batch: batchIdx[s.batch_id] ? `${batchIdx[s.batch_id].prefix}${batchIdx[s.batch_id].from_no}–${batchIdx[s.batch_id].to_no}` : "", status: SEAL_STATUS_LABEL[s.status], holder: s.assigned_to ? userIdx[s.assigned_to]?.full_name ?? "" : "", cert: s.certificate_id ? certs[s.certificate_id]?.number ?? "" : "", used: fmtDate(s.used_at), reason: s.void_reason ?? "" })),
  }]).catch(ui.error);

  const doAssign = async (toStock: boolean) => {
    if (!toStock && !asgUser) { ui.toast("Chọn người được cấp tem.", "error"); return; }
    let ids: string[];
    if (asgMode === "range") ids = seals.filter((s) => s.seq >= asgFrom && s.seq <= asgTo && (toStock ? s.status === "assigned" : s.status === "stock")).map((s) => s.id);
    else ids = seals.filter((s) => (toStock ? s.status === "assigned" && s.assigned_to === asgUser : s.status === "stock")).slice(0, asgCount).map((s) => s.id);
    if (!ids.length) { ui.toast("Không có tem phù hợp trong dải/số lượng đã chọn.", "error"); return; }
    await run(() => svc.assignSeals(ids, toStock ? null : asgUser), toStock ? `Đã thu ${ids.length} tem về kho.` : `Đã cấp ${ids.length} tem.`);
  };

  return (
    <>
      <PageHeader title="Tem kiểm định" subtitle="Nhập lô tem, cấp cho người ký, theo dõi sử dụng và huỷ"
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportBook} disabled={!filtered.length}>Xuất Excel</Button>
          {can("seals") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setBatchOpen(true)}>Nhập lô tem</Button>}
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trong kho" value={counts.stock} tone="gray" onClick={() => { setTab("book"); setStatus("stock"); setPage(0); }} active={tab === "book" && status === "stock"} />
        <Stat label="Đã cấp" value={counts.assigned} tone="blue" onClick={() => { setTab("book"); setStatus("assigned"); setPage(0); }} active={tab === "book" && status === "assigned"} />
        <Stat label="Đã dùng" value={counts.used} tone="green" onClick={() => { setTab("book"); setStatus("used"); setPage(0); }} active={tab === "book" && status === "used"} />
        <Stat label="Huỷ" value={counts.void} tone="red" onClick={() => { setTab("book"); setStatus("void"); setPage(0); }} active={tab === "book" && status === "void"} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: "book", label: "Sổ tem" }, { value: "batches", label: "Lô tem", count: batches.length }, ...(can("seals") ? [{ value: "assign" as Tab, label: "Cấp tem" }] : [])]} />

      {tab === "book" && (
        <>
          <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
            <Input className="max-w-48" placeholder="Tìm số tem…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Tìm số tem" />
            <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value as SealStatus | ""); setPage(0); }} aria-label="Trạng thái">
              <option value="">Mọi trạng thái</option>{(Object.keys(SEAL_STATUS_LABEL) as SealStatus[]).map((k) => <option key={k} value={k}>{SEAL_STATUS_LABEL[k]}</option>)}
            </Select>
            <Select className="w-auto" value={batch} onChange={(e) => { setBatch(e.target.value); setPage(0); }} aria-label="Lô">
              <option value="">Mọi lô</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.prefix}{b.from_no}–{b.to_no}</option>)}
            </Select>
            <Select className="w-auto" value={holder} onChange={(e) => { setHolder(e.target.value); setPage(0); }} aria-label="Người giữ">
              <option value="">Mọi người giữ</option>{holders.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </Select>
            <span className="ml-auto text-xs text-slate-500">{filtered.length} tem · trang {page + 1}/{pages}</span>
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Sau</Button>
          </div>
          {loading ? <Loading /> : pageRows.length === 0 ? <div className="card"><Empty text={seals.length ? "Không có tem khớp bộ lọc." : "Chưa có tem – nhập lô tem đầu tiên."} /></div> : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Số tem</th><th>Lô</th><th>Trạng thái</th><th>Người giữ</th><th>GCN</th><th>Ngày dùng</th><th>Lý do huỷ</th><th></th></tr></thead>
                <tbody>
                  {pageRows.map((s) => (
                    <tr key={s.id}>
                      <td><span className="seal-no">{s.number}</span></td>
                      <td className="text-xs text-slate-500">{batchIdx[s.batch_id] ? `${batchIdx[s.batch_id].prefix}${batchIdx[s.batch_id].from_no}–${batchIdx[s.batch_id].to_no}` : "–"}</td>
                      <td><Badge tone={SEAL_STATUS_TONE[s.status]}>{SEAL_STATUS_LABEL[s.status]}</Badge></td>
                      <td>{s.assigned_to ? userIdx[s.assigned_to]?.full_name ?? "–" : "–"}</td>
                      <td>{s.certificate_id && certs[s.certificate_id] ? <Link className="link" to={`/certificates/${s.certificate_id}`}>{certs[s.certificate_id].number}</Link> : "–"}</td>
                      <td className="tabular-nums">{fmtDate(s.used_at)}</td>
                      <td className="max-w-56 truncate text-xs text-slate-500">{s.void_reason ?? "–"}</td>
                      <td className="text-right">{can("seals") && (s.status === "stock" || s.status === "assigned") && <Button size="sm" variant="ghost" onClick={() => { setVoidSeal(s); setVoidReason(""); }}>Huỷ tem</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "batches" && (
        batches.length === 0 ? <div className="card"><Empty text="Chưa có lô tem nào." action={can("seals") ? <Button size="sm" onClick={() => setBatchOpen(true)}>Nhập lô tem</Button> : undefined} /></div> : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Tiền tố</th><th>Từ – đến</th><th>Ngày nhận</th><th className="num">Tổng</th><th className="num">Đã dùng</th><th className="num">Đã cấp</th><th className="num">Còn trong kho</th><th className="num">Huỷ</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {batches.map((b) => {
                  const mine = seals.filter((s) => s.batch_id === b.id);
                  const n = (st: SealStatus) => mine.filter((s) => s.status === st).length;
                  return (
                    <tr key={b.id}>
                      <td className="font-medium">{b.prefix}</td><td className="tabular-nums">{b.from_no} – {b.to_no}</td><td className="tabular-nums">{fmtDate(b.received_at)}</td>
                      <td className="num">{mine.length}</td><td className="num">{n("used")}</td><td className="num">{n("assigned")}</td><td className="num">{n("stock")}</td><td className="num">{n("void")}</td>
                      <td className="text-xs text-slate-500">{b.note ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "assign" && can("seals") && (
        <Card title="Cấp tem cho người ký / kiểm định viên">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Người được cấp"><Select value={asgUser} onChange={(e) => setAsgUser(e.target.value)}><option value="">Chọn…</option>{holders.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</Select></Field>
            <Field label="Cách chọn tem"><Select value={asgMode} onChange={(e) => setAsgMode(e.target.value as "range" | "count")}><option value="count">N tem đầu còn trong kho</option><option value="range">Theo dải số</option></Select></Field>
            {asgMode === "count" ? (
              <Field label="Số lượng"><NumberInput value={asgCount} onChange={setAsgCount} /></Field>
            ) : (
              <>
                <Field label="Từ số"><NumberInput value={asgFrom} onChange={setAsgFrom} /></Field>
                <Field label="Đến số"><NumberInput value={asgTo} onChange={setAsgTo} /></Field>
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => doAssign(false)} icon={<Package className="h-4 w-4" />}>Cấp tem</Button>
            <Button variant="secondary" loading={busy} onClick={() => doAssign(true)}>Thu về kho</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Người giữ tem hiện tại: {holders.map((u) => `${u.full_name} (${seals.filter((s) => s.assigned_to === u.id && s.status === "assigned").length})`).join(" · ")}</p>
        </Card>
      )}

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Nhập lô tem" size="sm"
        footer={<><Button variant="secondary" onClick={() => setBatchOpen(false)}>Huỷ</Button><Button loading={busy} onClick={async () => {
          if (await run(() => svc.createSealBatch({ prefix: nb.prefix, from_no: nb.from_no, to_no: nb.to_no, received_at: nb.received_at, note: nb.note || null }), `Đã nhập ${nb.to_no - nb.from_no + 1} tem.`)) setBatchOpen(false);
        }}>Nhập</Button></>}>
        <div className="grid gap-3">
          <Field label="Tiền tố số tem" hint="Số tem = tiền tố + số thứ tự 6 chữ số, ví dụ KĐV-000123"><Input value={nb.prefix} onChange={(e) => setNb({ ...nb, prefix: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ số"><NumberInput value={nb.from_no} onChange={(v) => setNb({ ...nb, from_no: v })} /></Field>
            <Field label="Đến số"><NumberInput value={nb.to_no} onChange={(v) => setNb({ ...nb, to_no: v })} /></Field>
          </div>
          <Field label="Ngày nhận"><Input type="date" value={nb.received_at} onChange={(e) => setNb({ ...nb, received_at: e.target.value })} /></Field>
          <Field label="Ghi chú"><Textarea rows={2} value={nb.note} onChange={(e) => setNb({ ...nb, note: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!voidSeal} onClose={() => setVoidSeal(null)} title={`Huỷ tem ${voidSeal?.number ?? ""}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setVoidSeal(null)}>Đóng</Button><Button variant="danger" loading={busy} onClick={async () => {
          if (!voidReason.trim()) { ui.toast("Cần ghi lý do huỷ.", "error"); return; }
          if (!voidSeal || !(await ui.confirm({ title: `Huỷ tem ${voidSeal.number}?`, message: "Tem huỷ không dùng lại được.", danger: true, confirmText: "Huỷ tem" }))) return;
          if (await run(() => svc.voidSeal(voidSeal.id, voidReason.trim()), "Đã huỷ tem.")) setVoidSeal(null);
        }}>Huỷ tem</Button></>}>
        <Field label="Lý do huỷ"><Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Ví dụ: rách khi dán, in lỗi" /></Field>
      </Modal>
    </>
  );
}

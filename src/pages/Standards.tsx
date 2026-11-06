import { AlertTriangle, Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Empty, Field, Input, Loading, Modal, PageHeader, Select, Textarea, useUi } from "@/components/ui";
import { exportXlsx } from "@/lib/excel";
import { dayjs, fmtDate, todayStr } from "@/lib/format";
import { STANDARD_STATUS_LABEL, STANDARD_STATUS_TONE } from "@/lib/labels";
import type { Certificate, Standard, StandardStatus } from "@/lib/types";

type Form = Omit<Standard, "id" | "created_at">;
const empty = (): Form => ({ code: "", name: "", field_id: "", manufacturer: null, model: null, serial: null, range_text: null, accuracy_text: null, cal_cert_no: null, cal_by: null, cal_date: null, cal_due: null, status: "ok", branch_id: null, note: null });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const SOON = 45;

export default function Standards() {
  const ui = useUi();
  const { svc, can } = useData();
  const { rows: stds, loading } = useTable("standards", { orderBy: { field: "code" } });
  const { rows: fields } = useTable("fields", { orderBy: { field: "code" } });
  const { rows: branches } = useTable("branches");
  const customers = useIndex("customers");
  const [field, setField] = useState("");
  const [status, setStatus] = useState<StandardStatus | "">("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; form: Form } | null>(null);
  const [recal, setRecal] = useState<Standard | null>(null);
  const [rc, setRc] = useState({ cal_cert_no: "", cal_by: "", cal_date: todayStr(), cal_due: dayjs().add(12, "month").format("YYYY-MM-DD") });
  const [impact, setImpact] = useState<Standard | null>(null);
  const [since, setSince] = useState(dayjs().subtract(12, "month").format("YYYY-MM-DD"));
  const [impactRows, setImpactRows] = useState<Certificate[] | null>(null);
  const [busy, setBusy] = useState(false);

  const today = todayStr();
  const soon = dayjs().add(SOON, "day").format("YYYY-MM-DD");
  const fieldIdx = useMemo(() => Object.fromEntries(fields.map((f) => [f.id, f])), [fields]);
  const overdue = stds.filter((s) => s.status === "locked" || (s.status === "ok" && s.cal_due && s.cal_due < today));
  const dueSoon = stds.filter((s) => s.status === "ok" && s.cal_due && s.cal_due >= today && s.cal_due <= soon);
  const list = useMemo(() => {
    const k = norm(q.trim());
    return stds.filter((s) => (!field || s.field_id === field) && (!status || s.status === status) && (!k || norm([s.code, s.name, s.serial ?? "", s.model ?? "", s.manufacturer ?? ""].join(" ")).includes(k)));
  }, [stds, field, status, q]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); ui.toast(ok); return true; } catch (e) { ui.error(e); return false; } finally { setBusy(false); }
  };
  const dueClass = (s: Standard) => !s.cal_due ? "text-slate-500" : s.cal_due < today ? "font-semibold text-red-700" : s.cal_due <= soon ? "font-semibold text-amber-700" : "";

  const save = async () => {
    if (!edit) return;
    const f = edit.form;
    if (!f.code.trim() || !f.name.trim() || !f.field_id) { ui.toast("Cần mã, tên và lĩnh vực.", "error"); return; }
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" && !["code", "name", "field_id", "status"].includes(k) ? null : v])) as Form;
    const ok = await run(() => edit.id ? svc.patch("standards", "standards", edit.id, clean) : svc.create("standards", "standards", clean), "Đã lưu chuẩn.");
    if (ok) setEdit(null);
  };
  const runImpact = async () => {
    if (!impact) return;
    setBusy(true);
    try { setImpactRows(await svc.certificatesUsingStandard(impact.id, since)); } catch (e) { ui.error(e); } finally { setBusy(false); }
  };
  const exportList = () => exportXlsx("chuan-do-luong", [{
    name: "Chuẩn", title: "DANH MỤC CHUẨN ĐO LƯỜNG",
    columns: [{ header: "Mã", key: "code", width: 12 }, { header: "Tên", key: "name", width: 40 }, { header: "Lĩnh vực", key: "field", width: 18 }, { header: "Kiểu / Sê-ri", key: "serial", width: 22 }, { header: "Phạm vi", key: "range", width: 18 }, { header: "Độ chính xác", key: "acc", width: 18 }, { header: "Số GCN HC", key: "cert", width: 18 }, { header: "Nơi HC", key: "by", width: 24 }, { header: "Ngày HC", key: "date", width: 12 }, { header: "Hạn HC", key: "due", width: 12 }, { header: "Trạng thái", key: "status", width: 14 }],
    rows: list.map((s) => ({ code: s.code, name: s.name, field: fieldIdx[s.field_id]?.name ?? "", serial: [s.model, s.serial].filter(Boolean).join(" / "), range: s.range_text ?? "", acc: s.accuracy_text ?? "", cert: s.cal_cert_no ?? "", by: s.cal_by ?? "", date: fmtDate(s.cal_date), due: fmtDate(s.cal_due), status: STANDARD_STATUS_LABEL[s.status] })),
  }]).catch(ui.error);

  // hàm thường (không phải component) để ô nhập không bị dựng lại, mất focus khi gõ
  const F = (label: string, k: keyof Form, type?: string) => edit ? (
    <Field label={label}><Input type={type} value={(edit.form[k] as string | null) ?? ""} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, [k]: e.target.value } })} /></Field>
  ) : null;

  return (
    <>
      <PageHeader title="Chuẩn đo lường" subtitle="Chuẩn và thiết bị đo của phòng thí nghiệm; chuẩn quá hạn hiệu chuẩn tự bị khoá và không chọn được trong biên bản"
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportList} disabled={!list.length}>Xuất Excel</Button>
          {can("standards") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: { ...empty(), field_id: fields[0]?.id ?? "" } })}>Thêm chuẩn</Button>}
        </>} />
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {overdue.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><b>{overdue.length} chuẩn quá hạn hiệu chuẩn / bị khoá:</b> {overdue.map((s) => s.code).join(", ")}. Không dùng được cho đến khi hiệu chuẩn lại.</div>
            </div>
          )}
          {dueSoon.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><b>{dueSoon.length} chuẩn sắp hết hạn trong {SOON} ngày:</b> {dueSoon.map((s) => `${s.code} (${fmtDate(s.cal_due)})`).join(", ")}. Lên lịch gửi hiệu chuẩn.</div>
            </div>
          )}
        </div>
      )}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Input className="max-w-xs" placeholder="Tìm mã, tên, sê-ri…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
        <Select className="w-auto" value={field} onChange={(e) => setField(e.target.value)} aria-label="Lĩnh vực"><option value="">Mọi lĩnh vực</option>{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as StandardStatus | "")} aria-label="Trạng thái"><option value="">Mọi trạng thái</option>{(Object.keys(STANDARD_STATUS_LABEL) as StandardStatus[]).map((k) => <option key={k} value={k}>{STANDARD_STATUS_LABEL[k]}</option>)}</Select>
        <span className="ml-auto text-xs text-slate-500">{list.length} / {stds.length} chuẩn</span>
      </div>
      {loading ? <Loading /> : list.length === 0 ? <div className="card"><Empty text={stds.length ? "Không có chuẩn khớp bộ lọc." : "Chưa có chuẩn nào – thêm chuẩn đầu tiên."} /></div> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Mã</th><th>Tên</th><th>Lĩnh vực</th><th>Kiểu / Sê-ri</th><th>Phạm vi</th><th>Độ chính xác</th><th>GCN hiệu chuẩn</th><th>Nơi HC</th><th>Ngày HC</th><th>Hạn HC</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.code}</td>
                  <td className="max-w-64">{s.name}{s.note && <div className="text-xs text-slate-500">{s.note}</div>}</td>
                  <td>{fieldIdx[s.field_id]?.name ?? "–"}</td>
                  <td className="text-xs">{[s.model, s.serial].filter(Boolean).join(" / ") || "–"}</td>
                  <td className="text-xs">{s.range_text ?? "–"}</td>
                  <td className="text-xs">{s.accuracy_text ?? "–"}</td>
                  <td className="text-xs">{s.cal_cert_no ?? "–"}</td>
                  <td className="text-xs">{s.cal_by ?? "–"}</td>
                  <td className="tabular-nums">{fmtDate(s.cal_date)}</td>
                  <td className={`tabular-nums ${dueClass(s)}`}>{fmtDate(s.cal_due)}</td>
                  <td><Badge tone={STANDARD_STATUS_TONE[s.status]}>{STANDARD_STATUS_LABEL[s.status]}</Badge></td>
                  <td className="whitespace-nowrap text-right">
                    {can("standards") && <>
                      <Button size="sm" variant="ghost" onClick={() => setEdit({ id: s.id, form: { ...empty(), ...s } })}>Sửa</Button>
                      {s.status !== "retired" && <Button size="sm" variant="ghost" onClick={() => { setRecal(s); setRc({ cal_cert_no: "", cal_by: s.cal_by ?? "", cal_date: todayStr(), cal_due: dayjs().add(12, "month").format("YYYY-MM-DD") }); }}>Hiệu chuẩn lại</Button>}
                    </>}
                    <Button size="sm" variant="ghost" icon={<Search className="h-3.5 w-3.5" />} onClick={() => { setImpact(s); setImpactRows(null); setSince(s.cal_date ?? dayjs().subtract(12, "month").format("YYYY-MM-DD")); }}>Ảnh hưởng</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Sửa chuẩn ${edit.form.code}` : "Thêm chuẩn"} size="lg"
        footer={<>
          {edit?.id && edit.form.status !== "retired" && (
            <Button variant="danger" className="mr-auto" disabled={busy} onClick={async () => {
              if (!(await ui.confirm({ title: "Đổi trạng thái chuẩn?", message: "Chuẩn hỏng hoặc thanh lý không chọn được trong biên bản.", danger: true, confirmText: "Đồng ý" }))) return;
              const st = edit.form.status === "broken" ? "retired" : "broken";
              if (await run(() => svc.patch("standards", "standards", edit.id!, { status: st }), `Đã đánh dấu ${STANDARD_STATUS_LABEL[st].toLowerCase()}.`)) setEdit(null);
            }}>{edit.form.status === "broken" ? "Thanh lý" : "Đánh dấu hỏng"}</Button>
          )}
          <Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button loading={busy} onClick={save}>Lưu</Button>
        </>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            {F("Mã chuẩn", "code")}
            <Field label="Lĩnh vực"><Select value={edit.form.field_id} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, field_id: e.target.value } })}><option value="">Chọn…</option>{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
            <div className="sm:col-span-2">{F("Tên chuẩn", "name")}</div>
            {F("Hãng sản xuất", "manufacturer")}{F("Kiểu", "model")}{F("Số sê-ri", "serial")}{F("Phạm vi đo", "range_text")}
            {F("Cấp chính xác / ĐKĐBĐ", "accuracy_text")}
            <Field label="Chi nhánh"><Select value={edit.form.branch_id ?? ""} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, branch_id: e.target.value || null } })}><option value="">–</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            {F("Số GCN hiệu chuẩn", "cal_cert_no")}{F("Nơi hiệu chuẩn", "cal_by")}
            {F("Ngày hiệu chuẩn", "cal_date", "date")}{F("Hạn hiệu chuẩn", "cal_due", "date")}
            {edit.id && <Field label="Trạng thái"><Select value={edit.form.status} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, status: e.target.value as StandardStatus } })}>{(Object.keys(STANDARD_STATUS_LABEL) as StandardStatus[]).map((k) => <option key={k} value={k}>{STANDARD_STATUS_LABEL[k]}</option>)}</Select></Field>}
            <div className="sm:col-span-2"><Field label="Ghi chú"><Textarea rows={2} value={edit.form.note ?? ""} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, note: e.target.value } })} /></Field></div>
          </div>
        )}
      </Modal>

      <Modal open={!!recal} onClose={() => setRecal(null)} title={`Hiệu chuẩn lại ${recal?.code ?? ""}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setRecal(null)}>Huỷ</Button><Button loading={busy} onClick={async () => {
          if (!recal) return;
          if (!rc.cal_cert_no.trim() || !rc.cal_date || !rc.cal_due) { ui.toast("Cần số GCN, ngày và hạn hiệu chuẩn.", "error"); return; }
          if (await run(() => svc.recalibrateStandard(recal.id, { ...rc, cal_cert_no: rc.cal_cert_no.trim() }), recal.status === "locked" ? "Đã cập nhật và mở khoá chuẩn." : "Đã cập nhật hiệu chuẩn.")) setRecal(null);
        }}>Lưu</Button></>}>
        <div className="grid gap-3">
          {recal?.status === "locked" && <p className="text-sm text-amber-800">Chuẩn đang bị khoá vì quá hạn; lưu kết quả hiệu chuẩn mới sẽ mở khoá.</p>}
          <Field label="Số GCN hiệu chuẩn"><Input value={rc.cal_cert_no} onChange={(e) => setRc({ ...rc, cal_cert_no: e.target.value })} /></Field>
          <Field label="Nơi hiệu chuẩn"><Input value={rc.cal_by} onChange={(e) => setRc({ ...rc, cal_by: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày hiệu chuẩn"><Input type="date" value={rc.cal_date} onChange={(e) => setRc({ ...rc, cal_date: e.target.value })} /></Field>
            <Field label="Hạn hiệu chuẩn"><Input type="date" value={rc.cal_due} onChange={(e) => setRc({ ...rc, cal_due: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal open={!!impact} onClose={() => setImpact(null)} title={`Đánh giá ảnh hưởng – ${impact?.code ?? ""}`} size="lg"
        footer={<>
          {impactRows && impactRows.length > 0 && <Button variant="secondary" className="mr-auto" icon={<Download className="h-4 w-4" />} onClick={() => exportXlsx(`anh-huong-${impact?.code}`, [{ name: "GCN", title: `GCN đã dùng chuẩn ${impact?.code} kể từ ${fmtDate(since)}`, columns: [{ header: "Số GCN", key: "number", width: 18 }, { header: "Khách hàng", key: "customer", width: 36 }, { header: "Thiết bị", key: "device", width: 28 }, { header: "Sê-ri", key: "serial", width: 16 }, { header: "Ngày cấp", key: "issued", width: 12 }, { header: "Trạng thái", key: "status", width: 14 }], rows: impactRows.map((c) => ({ number: c.number, customer: c.snapshot.customer.name, device: c.snapshot.device.name, serial: c.snapshot.device.serial ?? "", issued: fmtDate(c.issued_at), status: c.status })) }]).catch(ui.error)}>Xuất Excel</Button>}
          <Button variant="secondary" onClick={() => setImpact(null)}>Đóng</Button>
        </>}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Khi phát hiện chuẩn sai, liệt kê mọi giấy chứng nhận đã dùng chuẩn này kể từ lần hiệu chuẩn tốt gần nhất để xem xét thu hồi hoặc kiểm định lại.</p>
        <div className="mb-3 flex items-end gap-2">
          <Field label="Kể từ ngày"><Input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></Field>
          <Button loading={busy} onClick={runImpact}>Liệt kê</Button>
        </div>
        {impactRows && (impactRows.length === 0 ? <Empty text="Không có giấy chứng nhận nào dùng chuẩn này trong khoảng thời gian đã chọn." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Số GCN</th><th>Khách hàng</th><th>Thiết bị</th><th>Ngày cấp</th><th>Trạng thái</th></tr></thead>
              <tbody>{impactRows.map((c) => (
                <tr key={c.id}>
                  <td><Link className="link" to={`/certificates/${c.id}`}>{c.number}</Link></td>
                  <td>{customers[c.customer_id]?.name ?? c.snapshot.customer.name}</td>
                  <td>{c.snapshot.device.name} <span className="text-xs text-slate-500">{c.snapshot.device.serial ?? ""}</span></td>
                  <td className="tabular-nums">{fmtDate(c.issued_at)}</td>
                  <td><Badge tone={c.status === "valid" ? "green" : c.status === "revoked" ? "red" : "amber"}>{c.status === "valid" ? "Hiệu lực" : c.status === "revoked" ? "Đã thu hồi" : "Bị thay thế"}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </Modal>
    </>
  );
}

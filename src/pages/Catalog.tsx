import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useData, useIndex, useTable } from "@/app/data";
import CatTemplateEditor from "@/components/CatTemplateEditor";
import { Badge, Button, Checkbox, Empty, Field, Input, Loading, Modal, NumberInput, PageHeader, Select, Tabs, Textarea, Toggle, useUi } from "@/components/ui";
import { fmtDate, todayStr, vnd } from "@/lib/format";
import { PROCEDURE_STATUS_LABEL, PROCEDURE_STATUS_TONE } from "@/lib/labels";
import type { Branch, Field as FieldRow, InstrumentType, Procedure, ProcedureStatus } from "@/lib/types";

type Tab = "fields" | "types" | "procedures" | "branches";

export default function Catalog() {
  const [tab, setTab] = useState<Tab>("types");
  return (
    <>
      <PageHeader title="Danh mục, quy trình" subtitle="Lĩnh vực đo, loại phương tiện đo, quy trình kiểm định kèm mẫu biên bản, chi nhánh" />
      <Tabs value={tab} onChange={setTab} className="mb-4 w-fit max-w-full" items={[
        { value: "fields", label: "Lĩnh vực đo" }, { value: "types", label: "Loại phương tiện đo" }, { value: "procedures", label: "Quy trình kiểm định" }, { value: "branches", label: "Chi nhánh" },
      ]} />
      <LibraryBanner />
      {tab === "fields" && <FieldsTab />}
      {tab === "types" && <TypesTab />}
      {tab === "procedures" && <ProceduresTab />}
      {tab === "branches" && <BranchesTab />}
    </>
  );
}

// ---------------------------------------------------------------------------
/** Thư viện quy trình đi kèm phần mềm có mục mới (vd. quan trắc tự động) → thêm vào danh mục đang dùng */
function LibraryBanner() {
  const { svc, can, version } = useData();
  const ui = useUi();
  const [miss, setMiss] = useState<{ fields: number; procedures: number; types: number; names: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    svc.libraryMissing().then((m) => setMiss({ fields: m.fields.length, procedures: m.procedures.length, types: m.types.length, names: m.procedures.map((p) => p.code) }))
      .catch(() => setMiss(null));
  }, [svc, version]);
  if (!miss || miss.procedures + miss.types + miss.fields === 0) return null;
  const run = async () => {
    setBusy(true);
    try {
      const r = await svc.importLibrary();
      ui.toast(`Đã thêm ${r.procedures} quy trình, ${r.types} loại phương tiện đo, ${r.fields} lĩnh vực`);
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  };
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-[240px] flex-1 text-sm">
        <div className="font-semibold">Thư viện có {miss.procedures} quy trình, {miss.types} loại phương tiện đo mới chưa có trong danh mục</div>
        <div className="mt-0.5 text-[var(--ink-3)]">{[...new Set(miss.names)].join(", ")}. Chỉ thêm mục còn thiếu, không sửa mục bạn đã chỉnh.</div>
      </div>
      {can("catalog") ? <Button loading={busy} onClick={run}>Thêm vào danh mục</Button> : <span className="text-xs text-[var(--ink-3)]">Cần quyền Quản lý chất lượng hoặc Quản trị</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function FieldsTab() {
  const { svc, can } = useData();
  const ui = useUi();
  const { rows, loading } = useTable("fields", { orderBy: { field: "code" } });
  type F = Omit<FieldRow, "id" | "created_at">;
  const [edit, setEdit] = useState<{ id: string | null; form: F } | null>(null);
  const editable = can("catalog");
  const save = async () => {
    if (!edit || !edit.form.code.trim() || !edit.form.name.trim()) { ui.toast("Cần mã và tên", "error"); return; }
    try {
      if (edit.id) await svc.patch("catalog", "fields", edit.id, edit.form); else await svc.create("catalog", "fields", edit.form);
      ui.toast("Đã lưu"); setEdit(null);
    } catch (e) { ui.error(e); }
  };
  return (
    <>
      <div className="mb-3 flex justify-end">{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: { code: "", name: "", active: true } })}>Thêm lĩnh vực</Button>}</div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Chưa có lĩnh vực đo." /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Mã</th><th>Tên lĩnh vực</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{rows.map((f) => (
            <tr key={f.id}><td className="font-mono text-xs">{f.code}</td><td className="font-medium">{f.name}</td>
              <td><Badge tone={f.active ? "green" : "gray"}>{f.active ? "Hoạt động" : "Ngưng"}</Badge></td>
              <td className="text-right">{editable && <Button size="sm" variant="ghost" onClick={() => setEdit({ id: f.id, form: { code: f.code, name: f.name, active: f.active } })}>Sửa</Button>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Sửa lĩnh vực" : "Thêm lĩnh vực"} size="sm"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button onClick={save}>Lưu</Button></>}>
        {edit && <div className="grid gap-3">
          <Field label="Mã (in trong số GCN với {FIELD})"><Input value={edit.form.code} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, code: e.target.value.toUpperCase() } })} /></Field>
          <Field label="Tên"><Input value={edit.form.name} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} /></Field>
          <Toggle checked={edit.form.active} onChange={(v) => setEdit({ ...edit, form: { ...edit.form, active: v } })} label="Hoạt động" />
        </div>}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
function TypesTab() {
  const { svc, can } = useData();
  const ui = useUi();
  const { rows, loading } = useTable("instrument_types", { orderBy: { field: "name" } });
  const fields = useIndex("fields");
  const { rows: fieldList } = useTable("fields", { orderBy: { field: "code" } });
  const { rows: procedures } = useTable("procedures", { orderBy: { field: "code" } });
  const procIdx = useIndex("procedures");
  type F = Omit<InstrumentType, "id" | "created_at">;
  const empty = (): F => ({ code: "", name: "", field_id: fieldList[0]?.id ?? "", group2: true, cycle_months: 12, procedure_id: null, default_price: 0, active: true, note: null });
  const [edit, setEdit] = useState<{ id: string | null; form: F } | null>(null);
  const editable = can("catalog");
  const setF = (p: Partial<F>) => setEdit((s) => (s ? { ...s, form: { ...s.form, ...p } } : s));
  const save = async () => {
    if (!edit) return;
    const f = edit.form;
    if (!f.code.trim() || !f.name.trim() || !f.field_id) { ui.toast("Cần mã, tên và lĩnh vực", "error"); return; }
    if (!(f.cycle_months > 0)) { ui.toast("Chu kỳ phải lớn hơn 0 tháng", "error"); return; }
    try {
      if (edit.id) await svc.patch("catalog", "instrument_types", edit.id, f); else await svc.create("catalog", "instrument_types", f);
      ui.toast("Đã lưu"); setEdit(null);
    } catch (e) { ui.error(e); }
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">Chu kỳ theo TT 23/2013/TT-BKHCN (sửa đổi TT 07/2019) – đối chiếu lại trước khi dùng.</p>
        {editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: empty() })}>Thêm loại PTĐ</Button>}
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Chưa có loại phương tiện đo." /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Mã</th><th>Tên</th><th>Lĩnh vực</th><th>Nhóm 2</th><th className="num">Chu kỳ (tháng)</th><th>Quy trình mặc định</th><th className="num">Đơn giá</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.id}>
              <td className="font-mono text-xs">{t.code}</td>
              <td className="font-medium">{t.name}{t.note && <div className="text-xs font-normal text-slate-500">{t.note}</div>}</td>
              <td>{fields[t.field_id]?.name ?? "–"}</td>
              <td>{t.group2 ? <Badge tone="blue">Nhóm 2</Badge> : <span className="text-slate-400">–</span>}</td>
              <td className="num">{t.cycle_months}</td>
              <td className="font-mono text-xs">{t.procedure_id ? procIdx[t.procedure_id]?.code ?? "–" : <span className="font-sans text-amber-700">Chưa gắn</span>}</td>
              <td className="num">{vnd(t.default_price)}</td>
              <td><Badge tone={t.active ? "green" : "gray"}>{t.active ? "Hoạt động" : "Ngưng"}</Badge></td>
              <td className="text-right">{editable && <Button size="sm" variant="ghost" onClick={() => { const { id, created_at: _c, ...form } = t; void _c; setEdit({ id, form }); }}>Sửa</Button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Sửa loại phương tiện đo" : "Thêm loại phương tiện đo"} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button onClick={save}>Lưu</Button></>}>
        {edit && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã"><Input value={edit.form.code} onChange={(e) => setF({ code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Tên"><Input value={edit.form.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
          <Field label="Lĩnh vực đo"><Select value={edit.form.field_id} onChange={(e) => setF({ field_id: e.target.value })}>{fieldList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Chu kỳ kiểm định (tháng)"><Input type="number" min={1} value={edit.form.cycle_months} onChange={(e) => setF({ cycle_months: Number(e.target.value) })} /></Field>
          <Field label="Quy trình mặc định" hint="Chỉ quy trình đang áp dụng">
            <Select value={edit.form.procedure_id ?? ""} onChange={(e) => setF({ procedure_id: e.target.value || null })}>
              <option value="">– Chưa gắn –</option>{procedures.filter((p) => p.status === "active" || p.id === edit.form.procedure_id).map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Đơn giá tham khảo (đ)"><NumberInput value={edit.form.default_price} onChange={(v) => setF({ default_price: v })} /></Field>
          <Field label="Ghi chú" className="sm:col-span-2"><Textarea rows={2} value={edit.form.note ?? ""} onChange={(e) => setF({ note: e.target.value || null })} /></Field>
          <Checkbox checked={edit.form.group2} onChange={(v) => setF({ group2: v })} label="Thuộc danh mục phương tiện đo nhóm 2 (phải kiểm định)" />
          <Toggle checked={edit.form.active} onChange={(v) => setF({ active: v })} label="Hoạt động" />
        </div>}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
function ProceduresTab() {
  const { svc, can } = useData();
  const ui = useUi();
  const { rows, loading } = useTable("procedures", { orderBy: { field: "code" } });
  const { rows: types } = useTable("instrument_types");
  const usage = useMemo(() => { const m: Record<string, number> = {}; for (const t of types) if (t.procedure_id) m[t.procedure_id] = (m[t.procedure_id] ?? 0) + 1; return m; }, [types]);
  type F = Omit<Procedure, "id" | "created_at">;
  const empty = (): F => ({ code: "", name: "", version: "1", effective_from: todayStr(), status: "draft", template: { env_limits: {}, sections: [] }, note: null });
  const [edit, setEdit] = useState<{ id: string | null; form: F; original: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloneVersion, setCloneVersion] = useState<string | null>(null);
  const editable = can("catalog");
  const setF = (p: Partial<F>) => setEdit((s) => (s ? { ...s, form: { ...s.form, ...p } } : s));
  const templateChanged = !!edit && edit.id && JSON.stringify(edit.form.template) !== edit.original;

  const save = async () => {
    if (!edit) return;
    const f = edit.form;
    if (!f.code.trim() || !f.name.trim()) { ui.toast("Cần mã và tên quy trình", "error"); return; }
    if (f.template.sections.length === 0) { ui.toast("Mẫu biên bản cần ít nhất một mục", "error"); return; }
    setSaving(true);
    try {
      if (edit.id) await svc.patch("catalog", "procedures", edit.id, f); else await svc.create("catalog", "procedures", f);
      ui.toast("Đã lưu"); setEdit(null);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };
  const clone = async () => {
    if (!edit || !cloneVersion?.trim()) return;
    setSaving(true);
    try {
      await svc.create("catalog", "procedures", { ...edit.form, version: cloneVersion.trim(), status: "draft", effective_from: todayStr() });
      ui.toast(`Đã tạo phiên bản ${cloneVersion} (nháp). Phiên bản cũ giữ nguyên.`);
      setCloneVersion(null); setEdit(null);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };
  const setStatus = async (p: Procedure, status: ProcedureStatus) => {
    const msg = status === "active" ? `Đưa ${p.code} phiên bản ${p.version} vào áp dụng?` : `Ngưng áp dụng ${p.code} phiên bản ${p.version}? ${usage[p.id] ? `Đang có ${usage[p.id]} loại PTĐ gắn quy trình này, phiếu mới sẽ không có quy trình.` : ""}`;
    if (!(await ui.confirm({ title: "Đổi trạng thái quy trình", message: msg, danger: status === "retired" }))) return;
    try { await svc.patch("catalog", "procedures", p.id, { status }); ui.toast("Đã cập nhật"); } catch (e) { ui.error(e); }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">Mỗi quy trình có phiên bản và mẫu biên bản. Phiếu công việc ghi lại đúng phiên bản đã dùng; sửa mẫu của quy trình đang áp dụng nên tạo phiên bản mới.</p>
        {editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: empty(), original: "" })}>Thêm quy trình</Button>}
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Chưa có quy trình kiểm định." /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Mã</th><th>Tên</th><th>Phiên bản</th><th>Hiệu lực từ</th><th>Trạng thái</th><th className="num">Mục biên bản</th><th className="num">Loại PTĐ dùng</th><th></th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs">{p.code}</td>
              <td className="font-medium">{p.name}{p.note && <div className="text-xs font-normal text-slate-500">{p.note}</div>}</td>
              <td>{p.version}</td><td>{fmtDate(p.effective_from)}</td>
              <td><Badge tone={PROCEDURE_STATUS_TONE[p.status]}>{PROCEDURE_STATUS_LABEL[p.status]}</Badge></td>
              <td className="num">{p.template.sections.length}</td>
              <td className="num">{usage[p.id] ?? 0}</td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => { const { id, created_at: _c, ...form } = p; void _c; setEdit({ id, form: structuredClone(form), original: JSON.stringify(form.template) }); }}>{editable ? "Xem, sửa" : "Xem"}</Button>
                {editable && p.status === "draft" && <Button size="sm" variant="ghost" onClick={() => setStatus(p, "active")}>Áp dụng</Button>}
                {editable && p.status === "active" && <Button size="sm" variant="ghost" onClick={() => setStatus(p, "retired")}>Ngưng</Button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `${edit.form.code} – phiên bản ${edit.form.version}` : "Thêm quy trình"} size="xl"
        footer={<>
          {edit?.id && editable && <Button variant="secondary" onClick={() => setCloneVersion(String(Number(edit.form.version) + 1 || `${edit.form.version}-moi`))}>Nhân bản thành phiên bản mới</Button>}
          <span className="flex-1" />
          <Button variant="secondary" onClick={() => setEdit(null)}>Đóng</Button>
          {editable && <Button loading={saving} onClick={save}>Lưu</Button>}
        </>}>
        {edit && (
          <div className="space-y-4">
            {templateChanged && edit.form.status === "active" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Bạn đang sửa mẫu biên bản của quy trình đang áp dụng. Nên dùng "Nhân bản thành phiên bản mới" để phiếu cũ vẫn truy xuất đúng mẫu đã dùng.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Mã quy trình"><Input value={edit.form.code} onChange={(e) => setF({ code: e.target.value })} placeholder="ĐLVN 16:2009" /></Field>
              <Field label="Tên" className="sm:col-span-2"><Input value={edit.form.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
              <Field label="Phiên bản"><Input value={edit.form.version} onChange={(e) => setF({ version: e.target.value })} /></Field>
              <Field label="Hiệu lực từ"><Input type="date" value={edit.form.effective_from} onChange={(e) => setF({ effective_from: e.target.value })} /></Field>
              <Field label="Trạng thái"><Select value={edit.form.status} onChange={(e) => setF({ status: e.target.value as ProcedureStatus })}>{(Object.keys(PROCEDURE_STATUS_LABEL) as ProcedureStatus[]).map((s) => <option key={s} value={s}>{PROCEDURE_STATUS_LABEL[s]}</option>)}</Select></Field>
              <Field label="Ghi chú" className="sm:col-span-2"><Input value={edit.form.note ?? ""} onChange={(e) => setF({ note: e.target.value || null })} /></Field>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Mẫu biên bản</div>
              <CatTemplateEditor value={edit.form.template} onChange={(template) => setF({ template })} />
            </div>
          </div>
        )}
      </Modal>
      <Modal open={cloneVersion !== null} onClose={() => setCloneVersion(null)} title="Nhân bản thành phiên bản mới" size="sm"
        footer={<><Button variant="secondary" onClick={() => setCloneVersion(null)}>Huỷ</Button><Button loading={saving} onClick={clone}>Tạo bản nháp</Button></>}>
        <Field label="Phiên bản mới" hint="Bản sao ở trạng thái Nháp với mẫu biên bản như đang soạn; phiên bản hiện tại không đổi."><Input value={cloneVersion ?? ""} onChange={(e) => setCloneVersion(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
function BranchesTab() {
  const { svc, can } = useData();
  const ui = useUi();
  const { rows, loading } = useTable("branches", { orderBy: { field: "code" } });
  type F = Omit<Branch, "id" | "created_at">;
  const [edit, setEdit] = useState<{ id: string | null; form: F } | null>(null);
  const editable = can("catalog") || can("settings");
  const setF = (p: Partial<F>) => setEdit((s) => (s ? { ...s, form: { ...s.form, ...p } } : s));
  const save = async () => {
    if (!edit || !edit.form.code.trim() || !edit.form.name.trim()) { ui.toast("Cần mã và tên", "error"); return; }
    try {
      if (edit.id) await svc.patch("catalog", "branches", edit.id, edit.form); else await svc.create("catalog", "branches", edit.form);
      ui.toast("Đã lưu"); setEdit(null);
    } catch (e) { ui.error(e); }
  };
  return (
    <>
      <div className="mb-3 flex justify-end">{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: { code: "", name: "", address: null, active: true } })}>Thêm chi nhánh</Button>}</div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Chưa có chi nhánh." /> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>Mã</th><th>Tên</th><th>Địa chỉ</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{rows.map((b) => (
            <tr key={b.id}><td className="font-mono text-xs">{b.code}</td><td className="font-medium">{b.name}</td><td>{b.address ?? "–"}</td>
              <td><Badge tone={b.active ? "green" : "gray"}>{b.active ? "Hoạt động" : "Ngưng"}</Badge></td>
              <td className="text-right">{editable && <Button size="sm" variant="ghost" onClick={() => setEdit({ id: b.id, form: { code: b.code, name: b.name, address: b.address, active: b.active } })}>Sửa</Button>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Sửa chi nhánh" : "Thêm chi nhánh"} size="sm"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button onClick={save}>Lưu</Button></>}>
        {edit && <div className="grid gap-3">
          <Field label="Mã (in trong số GCN với {BR})"><Input value={edit.form.code} onChange={(e) => setF({ code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Tên"><Input value={edit.form.name} onChange={(e) => setF({ name: e.target.value })} /></Field>
          <Field label="Địa chỉ"><Input value={edit.form.address ?? ""} onChange={(e) => setF({ address: e.target.value || null })} /></Field>
          <Toggle checked={edit.form.active} onChange={(v) => setF({ active: v })} label="Hoạt động" />
        </div>}
      </Modal>
    </>
  );
}

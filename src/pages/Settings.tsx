import { useEffect, useRef, useState } from "react";
import { useData, useTable } from "@/app/data";
import { Button, Card, Field, Input, Loading, NumberInput, PageHeader, Select, useUi } from "@/components/ui";
import type { Settings as SettingsRow } from "@/lib/types";
import { EmailCard, StorageCard } from "@/components/SettingsExtra";

const TOKENS: [string, string][] = [
  ["{YYYY}", "năm 4 số"], ["{YY}", "năm 2 số"], ["{MM}", "tháng"], ["{SEQ}", "số thứ tự"], ["{SEQ:5}", "số thứ tự, đệm 0 đủ 5 chữ số"],
  ["{BR}", "mã chi nhánh"], ["{FIELD}", "mã lĩnh vực đo"],
];

export default function Settings() {
  const { svc, repo, mode, resetDemo, api } = useData();
  const ui = useUi();
  const { rows, loading } = useTable("settings");
  const [form, setForm] = useState<SettingsRow | null>(null);
  const [dueText, setDueText] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rows[0] && !form) { setForm(structuredClone(rows[0])); setDueText(rows[0].reminders.due_days.join(", ")); }
  }, [rows, form]);

  if (loading || !form) return <Loading />;
  const setCompany = (p: Partial<SettingsRow["company"]>) => setForm({ ...form, company: { ...form.company, ...p } });

  const save = async () => {
    const due = dueText.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a);
    if (!due.length) { ui.toast("Cần ít nhất một mốc nhắc thiết bị đến hạn", "error"); return; }
    if (!form.numbering.certificate_pattern.includes("{SEQ")) { ui.toast("Mẫu số GCN phải có {SEQ} hoặc {SEQ:n}", "error"); return; }
    setSaving(true);
    try {
      const { id: _i, updated_at: _u, ...patch } = { ...form, reminders: { ...form.reminders, due_days: due } };
      void _i; void _u;
      await svc.saveSettings(patch);
      ui.toast("Đã lưu cài đặt");
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };

  const backup = async () => {
    let data: unknown;
    if (api) {
      try { data = await api.request("/backup"); } catch (e) { ui.error(e); return; }
    } else {
      const r = repo as unknown as { exportAll?: () => unknown };
      if (!r.exportAll) { ui.toast("Chế độ này không hỗ trợ sao lưu", "error"); return; }
      data = r.exportAll();
    }
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `managercal-saoluu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const restore = async (file: File) => {
    const r = repo as unknown as { replaceAll?: (data: unknown, seq: unknown) => Promise<void> };
    if (!api && !r.replaceAll) { ui.toast("Chế độ này không hỗ trợ khôi phục từ tệp", "error"); return; }
    try {
      const parsed = JSON.parse(await file.text()) as { data?: unknown; seq?: unknown };
      if (!parsed.data || typeof parsed.data !== "object") throw new Error("Tệp không đúng định dạng sao lưu của ManagerCAL");
      const where = api ? "trên máy chủ (mọi người dùng chung)" : "trong trình duyệt";
      if (!(await ui.confirm({ title: "Khôi phục từ tệp?", message: `Toàn bộ dữ liệu hiện tại ${where} sẽ bị thay bằng nội dung tệp. Mật khẩu đăng nhập giữ nguyên.`, danger: true, confirmText: "Khôi phục" }))) return;
      if (api) await api.post("/restore", { data: parsed.data, seq: parsed.seq ?? {} });
      else await r.replaceAll!(parsed.data, parsed.seq ?? {});
      ui.toast("Đã khôi phục, tải lại trang…");
      setTimeout(() => location.reload(), 800);
    } catch (e) { ui.error(e); }
  };

  const preview = svc.formatNumber(form.numbering.certificate_pattern, 123, { branch: "HN", field: "KL" });

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Thông tin công ty in trên giấy chứng nhận, quy tắc đánh số, nhắc việc" actions={<Button loading={saving} onClick={save}>Lưu cài đặt</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Thông tin công ty" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tên đầy đủ" className="sm:col-span-2"><Input value={form.company.name} onChange={(e) => setCompany({ name: e.target.value })} /></Field>
            <Field label="Tên viết tắt"><Input value={form.company.short_name} onChange={(e) => setCompany({ short_name: e.target.value })} /></Field>
            <Field label="Địa chỉ" className="sm:col-span-2"><Input value={form.company.address} onChange={(e) => setCompany({ address: e.target.value })} /></Field>
            <Field label="Mã số thuế"><Input value={form.company.tax_code} onChange={(e) => setCompany({ tax_code: e.target.value })} /></Field>
            <Field label="Điện thoại"><Input value={form.company.phone} onChange={(e) => setCompany({ phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.company.email} onChange={(e) => setCompany({ email: e.target.value })} /></Field>
            <Field label="Giám đốc (ký GCN)"><Input value={form.company.director_name} onChange={(e) => setCompany({ director_name: e.target.value })} /></Field>
            <Field label="Số quyết định chỉ định"><Input value={form.company.designation_no} onChange={(e) => setCompany({ designation_no: e.target.value })} /></Field>
            <Field label="Ngày quyết định"><Input type="date" value={form.company.designation_date} onChange={(e) => setCompany({ designation_date: e.target.value as SettingsRow["company"]["designation_date"] })} /></Field>
            <Field label="Ký hiệu tổ chức (in trên tem, GCN)"><Input value={form.company.lab_code} onChange={(e) => setCompany({ lab_code: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="Đánh số giấy chứng nhận">
          <Field label="Mẫu số" hint={<>Xem trước: <b className="font-mono">{preview}</b></>}>
            <Input className="font-mono" value={form.numbering.certificate_pattern} onChange={(e) => setForm({ ...form, numbering: { ...form.numbering, certificate_pattern: e.target.value } })} />
          </Field>
          <Field label="Đặt lại số thứ tự" className="mt-3">
            <Select value={form.numbering.reset} onChange={(e) => setForm({ ...form, numbering: { ...form.numbering, reset: e.target.value as "year" | "never" } })}>
              <option value="year">Mỗi năm về 1</option><option value="never">Không bao giờ (tăng liên tục)</option>
            </Select>
          </Field>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {TOKENS.map(([t, d]) => <div key={t} className="contents"><dt className="font-mono">{t}</dt><dd>{d}</dd></div>)}
          </dl>
          <p className="mt-2 text-xs text-slate-500">Số cấp liên tục, không trùng; số đã dùng không thu hồi lại.</p>
        </Card>

        <Card title="Nhắc việc">
          <div className="grid gap-3">
            <Field label="Nhắc thiết bị của khách đến hạn trước (ngày)" hint="Nhiều mốc, cách nhau bằng dấu phẩy"><Input value={dueText} onChange={(e) => setDueText(e.target.value)} placeholder="30, 15, 7" /></Field>
            <Field label="Nhắc chuẩn sắp hết hạn hiệu chuẩn trước (ngày)"><NumberInput value={form.reminders.standard_due_days} onChange={(v) => setForm({ ...form, reminders: { ...form.reminders, standard_due_days: v } })} /></Field>
            <Field label="Nhắc thẻ kiểm định viên sắp hết hạn trước (ngày)"><NumberInput value={form.reminders.card_due_days} onChange={(v) => setForm({ ...form, reminders: { ...form.reminders, card_due_days: v } })} /></Field>
          </div>
        </Card>

        <Card title="Bảng kiểm khi soát xét" actions={<Button size="sm" variant="secondary" onClick={() => setForm({ ...form, review: { checklist: [...form.review.checklist, ""] } })}>Thêm dòng</Button>}>
          {form.review.checklist.length === 0 && <p className="text-sm text-slate-500">Chưa có dòng kiểm nào.</p>}
          <div className="space-y-2">
            {form.review.checklist.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
                <Input value={line} onChange={(e) => { const c = [...form.review.checklist]; c[i] = e.target.value; setForm({ ...form, review: { checklist: c } }); }} />
                <Button size="sm" variant="ghost" aria-label="Xoá dòng" onClick={() => setForm({ ...form, review: { checklist: form.review.checklist.filter((_, j) => j !== i) } })}>Xoá</Button>
              </div>
            ))}
          </div>
        </Card>

        <EmailCard />

        <Card title="Dữ liệu">
          <p className="mb-3 text-sm">Chế độ hiện tại: <b>{mode === "demo" ? "Demo – dữ liệu lưu trong trình duyệt này" : "Máy chủ – dữ liệu lưu trên Cloudflare D1, mọi người dùng chung"}</b>.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={backup}>Sao lưu (tải JSON)</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Khôi phục từ JSON</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
            {mode === "demo" && <Button variant="danger" onClick={async () => { if (await ui.confirm({ title: "Nạp lại dữ liệu demo?", message: "Mọi thay đổi trong trình duyệt này sẽ mất.", danger: true, confirmText: "Nạp lại" })) resetDemo(); }}>Nạp lại dữ liệu demo</Button>}
          </div>
        </Card>

        <StorageCard />
      </div>
    </>
  );
}

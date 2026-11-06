// Trình soạn mẫu biên bản có cấu trúc (Template) – dùng trong Danh mục › Quy trình
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { MpeSpec, Template, TemplatePoint, TemplateSection } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 8);

function numOrNull(v: string): number | null { const n = Number(v.replace(",", ".")); return v.trim() === "" || !Number.isFinite(n) ? null : n; }

export function MpeEditor({ value, onChange, allowNone, label = "Sai số cho phép (MPE)" }: { value: MpeSpec | undefined; onChange: (v: MpeSpec | undefined) => void; allowNone?: boolean; label?: string }) {
  const kind = value?.kind ?? "";
  const setKind = (k: string) => {
    if (k === "") return onChange(undefined);
    if (k === "abs") return onChange({ kind: "abs", value: value && "value" in value ? value.value : 1 });
    if (k === "pct_reading") return onChange({ kind: "pct_reading", value: value && "value" in value ? value.value : 1 });
    if (k === "pct_span") return onChange({ kind: "pct_span", value: value && "value" in value ? value.value : 1, span: 100 });
    return onChange({ kind: "scale_oiml", e: 1, cls: "III", in_service: true });
  };
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <Field label={label}>
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          {allowNone && <option value="">Dùng MPE của mục</option>}
          <option value="abs">± giá trị tuyệt đối</option>
          <option value="pct_reading">± % giá trị đo</option>
          <option value="pct_span">± % phạm vi đo</option>
          <option value="scale_oiml">Cân OIML R76 (theo e, cấp)</option>
        </Select>
      </Field>
      {value && (value.kind === "abs" || value.kind === "pct_reading" || value.kind === "pct_span") && (
        <Field label={value.kind === "abs" ? "Giá trị (±)" : "Phần trăm (±)"}><Input type="number" step="any" value={value.value} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} /></Field>
      )}
      {value?.kind === "pct_span" && <Field label="Phạm vi đo (span)"><Input type="number" step="any" value={value.span} onChange={(e) => onChange({ ...value, span: Number(e.target.value) })} /></Field>}
      {value?.kind === "scale_oiml" && (
        <>
          <Field label="Giá trị độ chia kiểm e"><Input type="number" step="any" value={value.e} onChange={(e) => onChange({ ...value, e: Number(e.target.value) })} /></Field>
          <Field label="Cấp chính xác"><Select value={value.cls} onChange={(e) => onChange({ ...value, cls: e.target.value as "I" | "II" | "III" | "IIII" })}>{["I", "II", "III", "IIII"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <Field label="Trong sử dụng (×2)"><Select value={value.in_service ? "1" : "0"} onChange={(e) => onChange({ ...value, in_service: e.target.value === "1" })}><option value="1">Có (định kỳ)</option><option value="0">Không (ban đầu)</option></Select></Field>
        </>
      )}
    </div>
  );
}

const newSection = (kind: TemplateSection["kind"]): TemplateSection => {
  const id = uid();
  switch (kind) {
    case "checklist": return { id, kind, title: "Kiểm tra bên ngoài", items: [{ id: uid(), label: "" }] };
    case "points": return { id, kind, title: "Kiểm tra sai số", unit: "", decimals: 2, readings: 1, directions: 1, mpe: { kind: "abs", value: 1 }, points: [{ id: uid(), nominal: 0 }] };
    case "repeatability": return { id, kind, title: "Kiểm tra độ lặp lại", unit: "", decimals: 2, nominal: 0, readings: 3, limit: { kind: "abs", value: 1 } };
    case "eccentricity": return { id, kind, title: "Kiểm tra độ lệch tâm", unit: "", decimals: 2, nominal: 0, positions: 5, mpe: { kind: "abs", value: 1 } };
  }
};
const KIND_LABEL: Record<TemplateSection["kind"], string> = { checklist: "Bảng kiểm (đạt/không)", points: "Điểm đo – sai số", repeatability: "Độ lặp lại", eccentricity: "Độ lệch tâm" };

export default function CatTemplateEditor({ value, onChange }: { value: Template; onChange: (t: Template) => void }) {
  const [showJson, setShowJson] = useState(false);
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const env = value.env_limits;
  const setEnv = (k: "temp" | "humidity", i: 0 | 1, v: string) => {
    const cur: [number | null, number | null] = env[k] ? [env[k]![0], env[k]![1]] : [null, null];
    cur[i] = numOrNull(v);
    const next = { ...env };
    if (cur[0] == null && cur[1] == null) delete next[k]; else next[k] = [cur[0] ?? -Infinity, cur[1] ?? Infinity].map((x) => (Number.isFinite(x) ? x : x < 0 ? -1e9 : 1e9)) as [number, number];
    onChange({ ...value, env_limits: next });
  };
  const envVal = (k: "temp" | "humidity", i: 0 | 1) => { const v = env[k]?.[i]; return v == null || Math.abs(v) >= 1e9 ? "" : String(v); };
  const setSection = (i: number, s: TemplateSection) => { const sections = [...value.sections]; sections[i] = s; onChange({ ...value, sections }); };
  const move = (i: number, d: -1 | 1) => { const s = [...value.sections]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; onChange({ ...value, sections: s }); };
  const remove = (i: number) => onChange({ ...value, sections: value.sections.filter((_, j) => j !== i) });
  const applyJson = () => {
    try {
      const t = JSON.parse(json) as Template;
      if (!t || !Array.isArray(t.sections)) throw new Error("Thiếu mảng sections");
      onChange({ env_limits: t.env_limits ?? {}, sections: t.sections });
      setJsonErr(null); setShowJson(false);
    } catch (e) { setJsonErr((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2 text-sm font-semibold">Giới hạn điều kiện môi trường <span className="font-normal text-slate-500">(bỏ trống = không kiểm tra)</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Nhiệt độ từ (°C)"><Input type="number" step="any" value={envVal("temp", 0)} onChange={(e) => setEnv("temp", 0, e.target.value)} /></Field>
          <Field label="đến (°C)"><Input type="number" step="any" value={envVal("temp", 1)} onChange={(e) => setEnv("temp", 1, e.target.value)} /></Field>
          <Field label="Độ ẩm từ (%RH)"><Input type="number" step="any" value={envVal("humidity", 0)} onChange={(e) => setEnv("humidity", 0, e.target.value)} /></Field>
          <Field label="đến (%RH)"><Input type="number" step="any" value={envVal("humidity", 1)} onChange={(e) => setEnv("humidity", 1, e.target.value)} /></Field>
        </div>
      </div>

      {value.sections.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{i + 1}. {KIND_LABEL[s.kind]}</span>
            <Input className="min-w-48 flex-1" value={s.title} onChange={(e) => setSection(i, { ...s, title: e.target.value })} placeholder="Tiêu đề mục" />
            <Button size="sm" variant="ghost" aria-label="Lên" onClick={() => move(i, -1)} icon={<ArrowUp className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" aria-label="Xuống" onClick={() => move(i, 1)} icon={<ArrowDown className="h-4 w-4" />} />
            <Button size="sm" variant="ghost" aria-label="Xoá mục" onClick={() => remove(i)} icon={<Trash2 className="h-4 w-4 text-red-600" />} />
          </div>
          {s.kind === "checklist" && (
            <div className="space-y-1.5">
              {s.items.map((it, k) => (
                <div key={it.id} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs text-slate-400">{k + 1}</span>
                  <Input value={it.label} onChange={(e) => { const items = [...s.items]; items[k] = { ...it, label: e.target.value }; setSection(i, { ...s, items }); }} placeholder="Nội dung kiểm tra" />
                  <Button size="sm" variant="ghost" aria-label="Xoá dòng" onClick={() => setSection(i, { ...s, items: s.items.filter((_, j) => j !== k) })} icon={<Trash2 className="h-4 w-4" />} />
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setSection(i, { ...s, items: [...s.items, { id: uid(), label: "" }] })}>Thêm dòng kiểm tra</Button>
            </div>
          )}
          {s.kind === "points" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Đơn vị"><Input value={s.unit} onChange={(e) => setSection(i, { ...s, unit: e.target.value })} /></Field>
                <Field label="Số thập phân"><Input type="number" min={0} max={6} value={s.decimals} onChange={(e) => setSection(i, { ...s, decimals: Number(e.target.value) })} /></Field>
                <Field label="Số lần đọc mỗi điểm"><Input type="number" min={1} max={10} value={s.readings} onChange={(e) => setSection(i, { ...s, readings: Math.max(1, Number(e.target.value)) })} /></Field>
                <Field label="Chiều đo"><Select value={s.directions} onChange={(e) => setSection(i, { ...s, directions: Number(e.target.value) as 1 | 2 })}><option value={1}>Một chiều</option><option value={2}>Tăng và giảm (có độ trễ)</option></Select></Field>
              </div>
              <MpeEditor value={s.mpe} onChange={(m) => m && setSection(i, { ...s, mpe: m })} />
              {s.directions === 2 && <MpeEditor label="Giới hạn độ trễ (trống = bằng MPE)" allowNone value={s.hysteresis_mpe} onChange={(m) => { const n = { ...s }; if (m) n.hysteresis_mpe = m; else delete n.hysteresis_mpe; setSection(i, n); }} />}
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Nhãn (tuỳ chọn)</th><th>Giá trị danh định</th><th>MPE riêng (tuỳ chọn)</th><th></th></tr></thead>
                <tbody>
                  {s.points.map((p, k) => {
                    const setP = (np: TemplatePoint) => { const points = [...s.points]; points[k] = np; setSection(i, { ...s, points }); };
                    return (
                      <tr key={p.id}>
                        <td><Input className="input-sm" value={p.label ?? ""} onChange={(e) => { const np = { ...p }; if (e.target.value) np.label = e.target.value; else delete np.label; setP(np); }} /></td>
                        <td><Input className="input-sm num" type="number" step="any" value={p.nominal} onChange={(e) => setP({ ...p, nominal: Number(e.target.value) })} /></td>
                        <td><MpeEditor label="MPE riêng" allowNone value={p.mpe} onChange={(m) => { const np = { ...p }; if (m) np.mpe = m; else delete np.mpe; setP(np); }} /></td>
                        <td className="text-right"><Button size="sm" variant="ghost" aria-label="Xoá điểm" onClick={() => setSection(i, { ...s, points: s.points.filter((_, j) => j !== k) })} icon={<Trash2 className="h-4 w-4" />} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setSection(i, { ...s, points: [...s.points, { id: uid(), nominal: 0 }] })}>Thêm điểm đo</Button>
            </div>
          )}
          {s.kind === "repeatability" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Đơn vị"><Input value={s.unit} onChange={(e) => setSection(i, { ...s, unit: e.target.value })} /></Field>
                <Field label="Số thập phân"><Input type="number" min={0} max={6} value={s.decimals} onChange={(e) => setSection(i, { ...s, decimals: Number(e.target.value) })} /></Field>
                <Field label="Tải danh định"><Input type="number" step="any" value={s.nominal} onChange={(e) => setSection(i, { ...s, nominal: Number(e.target.value) })} /></Field>
                <Field label="Số lần đọc"><Input type="number" min={2} max={20} value={s.readings} onChange={(e) => setSection(i, { ...s, readings: Math.max(2, Number(e.target.value)) })} /></Field>
              </div>
              <MpeEditor label="Giới hạn chênh lệch lớn nhất" value={s.limit} onChange={(m) => m && setSection(i, { ...s, limit: m })} />
            </div>
          )}
          {s.kind === "eccentricity" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Đơn vị"><Input value={s.unit} onChange={(e) => setSection(i, { ...s, unit: e.target.value })} /></Field>
                <Field label="Số thập phân"><Input type="number" min={0} max={6} value={s.decimals} onChange={(e) => setSection(i, { ...s, decimals: Number(e.target.value) })} /></Field>
                <Field label="Tải thử"><Input type="number" step="any" value={s.nominal} onChange={(e) => setSection(i, { ...s, nominal: Number(e.target.value) })} /></Field>
                <Field label="Số vị trí"><Input type="number" min={2} max={9} value={s.positions} onChange={(e) => setSection(i, { ...s, positions: Math.max(2, Number(e.target.value)) })} /></Field>
              </div>
              <MpeEditor value={s.mpe} onChange={(m) => m && setSection(i, { ...s, mpe: m })} />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Thêm mục:</span>
        {(Object.keys(KIND_LABEL) as TemplateSection["kind"][]).map((k) => <Button key={k} size="sm" variant="secondary" onClick={() => onChange({ ...value, sections: [...value.sections, newSection(k)] })}>{KIND_LABEL[k]}</Button>)}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => { setJson(JSON.stringify(value, null, 2)); setJsonErr(null); setShowJson((v) => !v); }}>{showJson ? "Ẩn JSON" : "Xem JSON"}</Button>
      </div>
      {showJson && (
        <div>
          <Textarea rows={12} className="font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
          {jsonErr && <p className="mt-1 text-xs text-red-600">JSON không hợp lệ: {jsonErr}</p>}
          <div className="mt-2 flex justify-end"><Button size="sm" variant="secondary" onClick={applyJson}>Áp dụng JSON đã dán</Button></div>
        </div>
      )}
    </div>
  );
}

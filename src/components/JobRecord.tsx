// Biên bản số liệu: nhập (JobRecordEditor) và xem (JobResultView). Tính ngay bằng calc/evaluate.
import clsx from "clsx";
import { useMemo } from "react";
import { Badge } from "@/components/ui";
import { mpeText } from "@/lib/calc";
import type { EvalResult, EvalRow, Readings, Template, TemplateSection } from "@/lib/types";

/** Chuỗi gõ → readings (chấp nhận dấu phẩy thập phân) */
export type RawTexts = Record<string, string>; // key: `${sec}|${point}|${idx}`
export const rawKey = (sec: string, point: string, idx: number) => `${sec}|${point}|${idx}`;

export function parseNum(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Tạo texts ban đầu từ readings đã lưu */
export function textsFromReadings(template: Template, readings: Readings): RawTexts {
  const out: RawTexts = {};
  for (const s of template.sections) {
    if (s.kind === "checklist") continue;
    const d = (readings[s.id] ?? {}) as Record<string, (number | null)[]>;
    for (const [pid, arr] of Object.entries(d)) arr?.forEach((v, i) => { if (v != null) out[rawKey(s.id, pid, i)] = String(v); });
  }
  return out;
}

/** Ghép texts + checklist thành Readings */
export function buildReadings(template: Template, texts: RawTexts, checks: Record<string, Record<string, boolean>>): Readings {
  const out: Readings = {};
  for (const s of template.sections) {
    if (s.kind === "checklist") { out[s.id] = { ...(checks[s.id] ?? {}) }; continue; }
    const r: Record<string, (number | null)[]> = {};
    const put = (pid: string, n: number) => { r[pid] = Array.from({ length: n }, (_, i) => parseNum(texts[rawKey(s.id, pid, i)])); };
    if (s.kind === "points") for (const p of s.points) { put(p.id, s.readings); if (s.directions === 2) put(p.id + ":down", s.readings); if (s.ref_input) put(p.id + ":ref", 1); }
    else if (s.kind === "repeatability" || s.kind === "drift") { put("r", s.readings); if (s.ref_input) put("r:ref", 1); }
    else if (s.kind === "eccentricity") for (let i = 1; i <= s.positions; i++) put(`p${i}`, 1);
    else if (s.kind === "ra") { put("cem", s.pairs); put("rm", s.pairs); if (s.qcvn_sub) put("qcvn", 1); }
    else if (s.kind === "linearity") continue;
    out[s.id] = r;
  }
  return out;
}

export const fmt = (n: number | null | undefined, decimals = 2) => (n == null ? "–" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: decimals + 1, minimumFractionDigits: 0 }).format(n));

function PassBadge({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-slate-400">–</span>;
  return <Badge tone={pass ? "green" : "red"}>{pass ? "Đạt" : "Không đạt"}</Badge>;
}

function NumCell({ value, onChange, step, disabled, label }: { value: string; onChange: (v: string) => void; step: number; disabled?: boolean; label: string }) {
  return (
    <input type="text" inputMode="decimal" aria-label={label} value={value} disabled={disabled} step={step}
      onChange={(e) => onChange(e.target.value)}
      className="input input-sm num w-20 min-w-16" />
  );
}

/** Dòng mô tả giới hạn của mục (đầu mỗi mục biên bản) */
function limitText(s: TemplateSection): string {
  switch (s.kind) {
    case "checklist": return "";
    case "points": return `Sai số cho phép: ${mpeText(s.mpe, s.unit)}${s.ref_input ? " · nhập giá trị chuẩn theo chứng nhận" : ""}`;
    case "repeatability": return `${s.method === "stdev" ? "Độ lệch chuẩn" : "Chênh lệch"} cho phép: ${mpeText(s.limit, s.unit)}`;
    case "eccentricity": return `Sai số cho phép: ${mpeText(s.mpe, s.unit)}`;
    case "drift": return `Đo ${s.readings} lần, cách nhau ${s.interval}; độ trôi cho phép: ${mpeText(s.limit, s.unit)}`;
    case "linearity": return `R² ≥ ${String(s.min_r2).replace(".", ",")}`;
    case "ra": return `≥ 6 cặp số liệu; RA ≤ ${s.limit_pct} %`;
  }
}

export function JobRecordEditor({ template, texts, checks, result, onText, onCheck, disabled }: {
  template: Template; texts: RawTexts; checks: Record<string, Record<string, boolean>>; result: EvalResult;
  onText: (key: string, v: string) => void; onCheck: (sec: string, item: string, v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      {template.sections.map((s, si) => {
        const es = result.sections[si];
        return (
          <section key={s.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">{si + 1}. {s.title}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{limitText(s)}</span>
                <PassBadge pass={es?.pass ?? null} />
              </div>
            </div>
            {s.kind === "checklist" ? (
              <ChecklistEditor s={s} values={checks[s.id] ?? {}} onCheck={(item, v) => onCheck(s.id, item, v)} disabled={disabled} />
            ) : s.kind === "linearity" ? (
              <LinearityView row={es?.rows[0]} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="table">
                  {s.kind === "points" && <PointsEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
                  {s.kind === "repeatability" && <RepeatEditor s={s} texts={texts} row={es?.rows[0]} onText={onText} disabled={disabled} />}
                  {s.kind === "eccentricity" && <EccEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
                  {s.kind === "drift" && <DriftEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
                  {s.kind === "ra" && <RaEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ChecklistEditor({ s, values, onCheck, disabled }: { s: Extract<TemplateSection, { kind: "checklist" }>; values: Record<string, boolean>; onCheck: (item: string, v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {s.items.map((it) => {
        const v = values[it.id];
        return (
          <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{it.label}</span>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
              {[true, false].map((val) => (
                <button key={String(val)} type="button" disabled={disabled} onClick={() => onCheck(it.id, val)}
                  className={clsx("h-7 rounded-md px-3 text-xs font-medium transition disabled:cursor-not-allowed",
                    v === val ? (val ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
                  {val ? "Đạt" : "Không đạt"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PointsEditor({ s, texts, rows, onText, disabled }: { s: Extract<TemplateSection, { kind: "points" }>; texts: RawTexts; rows: EvalRow[]; onText: (k: string, v: string) => void; disabled?: boolean }) {
  const step = 10 ** -s.decimals;
  const two = s.directions === 2;
  const per = two ? 3 : 1;
  const inputs = (pid: string, labelBase: string) => Array.from({ length: s.readings }, (_, i) => (
    <NumCell key={i} value={texts[rawKey(s.id, pid, i)] ?? ""} onChange={(v) => onText(rawKey(s.id, pid, i), v)} step={step} disabled={disabled} label={`${labelBase} lần ${i + 1}`} />
  ));
  const errUnit = s.relative ? "%" : s.unit;
  return (
    <>
      <thead>
        <tr>
          <th>Điểm đo</th>
          {s.ref_input && <th>Giá trị chuẩn ({s.unit})</th>}
          <th>{two ? "Số đọc (tăng)" : `Số đọc (${s.unit})`}</th>
          {two && <th>Số đọc (giảm)</th>}
          <th className="num">TB{two ? " tăng / giảm" : ""}</th>
          <th className="num">Sai số{two ? " tăng / giảm" : ""}{s.relative ? " (%)" : ""}</th>
          {two && <th className="num">Độ trễ</th>}
          <th className="num">MPE (±{errUnit === "%" ? " %" : ""})</th>
          <th>Kết luận</th>
        </tr>
      </thead>
      <tbody>
        {s.points.map((p, i) => {
          const up = rows[i * per], down = two ? rows[i * per + 1] : undefined, hys = two ? rows[i * per + 2] : undefined;
          const label = p.label ?? `${fmt(p.nominal, s.decimals)} ${s.unit}`;
          const pass = two ? ([up?.pass, down?.pass, hys?.pass].some((x) => x === false) ? false : [up?.pass, down?.pass, hys?.pass].some((x) => x == null) ? null : true) : up?.pass ?? null;
          return (
            <tr key={p.id}>
              <td className="whitespace-nowrap font-medium">{label}</td>
              {s.ref_input && <td><NumCell value={texts[rawKey(s.id, p.id + ":ref", 0)] ?? ""} onChange={(v) => onText(rawKey(s.id, p.id + ":ref", 0), v)} step={step} disabled={disabled} label={`${label} giá trị chuẩn`} /></td>}
              <td><div className="flex flex-wrap gap-1">{inputs(p.id, label + (two ? " tăng" : ""))}</div></td>
              {two && <td><div className="flex flex-wrap gap-1">{inputs(p.id + ":down", label + " giảm")}</div></td>}
              <td className="num whitespace-nowrap">{fmt(up?.mean, s.decimals)}{two && ` / ${fmt(down?.mean, s.decimals)}`}</td>
              <td className={clsx("num whitespace-nowrap", (up?.pass === false || down?.pass === false) && "font-semibold text-red-700 dark:text-red-400")}>
                {fmt(up?.error, s.decimals)}{two && ` / ${fmt(down?.error, s.decimals)}`}
              </td>
              {two && <td className={clsx("num", hys?.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(hys?.error, s.decimals)}</td>}
              <td className="num whitespace-nowrap">{fmt(up?.mpe, s.relative ? 1 : s.decimals)}</td>
              <td><PassBadge pass={pass} /></td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

function RepeatEditor({ s, texts, row, onText, disabled }: { s: Extract<TemplateSection, { kind: "repeatability" }>; texts: RawTexts; row?: EvalRow; onText: (k: string, v: string) => void; disabled?: boolean }) {
  const step = 10 ** -s.decimals;
  return (
    <>
      <thead><tr><th>{s.ref_input ? `Giá trị chuẩn (${s.unit})` : "Tải"}</th><th>Số đọc ({s.unit}), {s.readings} lần</th><th className="num">TB</th><th className="num">{s.method === "stdev" ? "Độ lệch chuẩn s" : "Chênh lệch lớn nhất"}</th><th className="num">Giới hạn</th><th>Kết luận</th></tr></thead>
      <tbody>
        <tr>
          <td className="whitespace-nowrap font-medium">{s.ref_input
            ? <NumCell value={texts[rawKey(s.id, "r:ref", 0)] ?? ""} onChange={(v) => onText(rawKey(s.id, "r:ref", 0), v)} step={step} disabled={disabled} label="Độ lặp lại giá trị chuẩn" />
            : <>{fmt(s.nominal, s.decimals)} {s.unit}</>}</td>
          <td><div className="flex flex-wrap gap-1">{Array.from({ length: s.readings }, (_, i) => (
            <NumCell key={i} value={texts[rawKey(s.id, "r", i)] ?? ""} onChange={(v) => onText(rawKey(s.id, "r", i), v)} step={step} disabled={disabled} label={`Độ lặp lại lần ${i + 1}`} />
          ))}</div></td>
          <td className="num">{fmt(row?.mean, s.decimals)}</td>
          <td className={clsx("num", row?.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(row?.error, s.decimals)}</td>
          <td className="num">{fmt(row?.mpe, s.decimals)}</td>
          <td><PassBadge pass={row?.pass ?? null} /></td>
        </tr>
      </tbody>
    </>
  );
}

function EccEditor({ s, texts, rows, onText, disabled }: { s: Extract<TemplateSection, { kind: "eccentricity" }>; texts: RawTexts; rows: EvalRow[]; onText: (k: string, v: string) => void; disabled?: boolean }) {
  const step = 10 ** -s.decimals;
  return (
    <>
      <thead><tr><th>Vị trí</th><th>Tải ({s.unit})</th><th>Số đọc</th><th className="num">Sai số</th><th className="num">MPE (±)</th><th>Kết luận</th></tr></thead>
      <tbody>
        {Array.from({ length: s.positions }, (_, i) => {
          const row = rows[i];
          const pid = `p${i + 1}`;
          return (
            <tr key={pid}>
              <td className="font-medium">Vị trí {i + 1}</td>
              <td className="num">{fmt(s.nominal, s.decimals)}</td>
              <td><NumCell value={texts[rawKey(s.id, pid, 0)] ?? ""} onChange={(v) => onText(rawKey(s.id, pid, 0), v)} step={step} disabled={disabled} label={`Vị trí ${i + 1}`} /></td>
              <td className={clsx("num", row?.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(row?.error, s.decimals)}</td>
              <td className="num">{fmt(row?.mpe, s.decimals)}</td>
              <td><PassBadge pass={row?.pass ?? null} /></td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

function DriftEditor({ s, texts, rows, onText, disabled }: { s: Extract<TemplateSection, { kind: "drift" }>; texts: RawTexts; rows: EvalRow[]; onText: (k: string, v: string) => void; disabled?: boolean }) {
  const step = 10 ** -s.decimals;
  const later = rows.filter((r) => r.label !== "Lần đo đầu");
  return (
    <>
      <thead><tr><th>Lần đo</th><th>Số đọc ({s.unit})</th><th className="num">Sai lệch so với lần đầu</th><th className="num">Giới hạn (±)</th><th>Kết luận</th></tr></thead>
      <tbody>
        {s.ref_input && (
          <tr><td className="font-medium">Giá trị chuẩn</td><td><NumCell value={texts[rawKey(s.id, "r:ref", 0)] ?? ""} onChange={(v) => onText(rawKey(s.id, "r:ref", 0), v)} step={step} disabled={disabled} label="Độ trôi giá trị chuẩn" /></td><td /><td /><td /></tr>
        )}
        {Array.from({ length: s.readings }, (_, i) => {
          const row = i === 0 ? undefined : later[i - 1];
          return (
            <tr key={i}>
              <td className="whitespace-nowrap font-medium">{i === 0 ? "Lần đầu (t = 0)" : `Sau ${i} × ${s.interval}`}</td>
              <td><NumCell value={texts[rawKey(s.id, "r", i)] ?? ""} onChange={(v) => onText(rawKey(s.id, "r", i), v)} step={step} disabled={disabled} label={`Độ trôi lần ${i + 1}`} /></td>
              <td className={clsx("num", row?.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{i === 0 ? "–" : fmt(row?.error, s.decimals)}</td>
              <td className="num">{i === 0 ? "–" : fmt(row?.mpe, s.decimals)}</td>
              <td>{i === 0 ? null : <PassBadge pass={row?.pass ?? null} />}</td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}

function LinearityView({ row }: { row?: EvalRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-[var(--line-2)] px-4 py-3 text-sm">
      <span>Tính tự động từ các điểm của phép kiểm sai số (giá trị chuẩn – giá trị đo trung bình).</span>
      <span>R² = <b className="tabular-nums">{row?.error == null ? "–" : fmt(row.error, 4)}</b></span>
      <span>Yêu cầu ≥ <b className="tabular-nums">{fmt(row?.mpe, 4)}</b></span>
      <PassBadge pass={row?.pass ?? null} />
    </div>
  );
}

function RaEditor({ s, texts, rows, onText, disabled }: { s: Extract<TemplateSection, { kind: "ra" }>; texts: RawTexts; rows: EvalRow[]; onText: (k: string, v: string) => void; disabled?: boolean }) {
  const step = 10 ** -s.decimals;
  const val = (k: string, i: number) => parseNum(texts[rawKey(s.id, k, i)]);
  const summary = rows[rows.length - 1];
  return (
    <>
      <thead><tr><th>Lần</th><th>Hệ thống (CEM, {s.unit})</th><th>Đối chứng (RM, {s.unit})</th><th className="num">dᵢ = CEM − RM</th></tr></thead>
      <tbody>
        {Array.from({ length: s.pairs }, (_, i) => {
          const c = val("cem", i), r = val("rm", i);
          return (
            <tr key={i}>
              <td className="font-medium">{i + 1}</td>
              <td><NumCell value={texts[rawKey(s.id, "cem", i)] ?? ""} onChange={(v) => onText(rawKey(s.id, "cem", i), v)} step={step} disabled={disabled} label={`CEM lần ${i + 1}`} /></td>
              <td><NumCell value={texts[rawKey(s.id, "rm", i)] ?? ""} onChange={(v) => onText(rawKey(s.id, "rm", i), v)} step={step} disabled={disabled} label={`RM lần ${i + 1}`} /></td>
              <td className="num">{c != null && r != null ? fmt(c - r, s.decimals + 1) : "–"}</td>
            </tr>
          );
        })}
        {s.qcvn_sub && (
          <tr><td colSpan={2} className="text-sm">Giới hạn QCVN áp dụng cho cơ sở ({s.unit}) – dùng làm mẫu số khi RM̄ &lt; 50 % giới hạn</td>
            <td><NumCell value={texts[rawKey(s.id, "qcvn", 0)] ?? ""} onChange={(v) => onText(rawKey(s.id, "qcvn", 0), v)} step={step} disabled={disabled} label="Giới hạn QCVN" /></td><td /></tr>
        )}
        <tr>
          <td colSpan={3} className="text-sm">{summary?.label ?? "RA"}</td>
          <td className={clsx("num font-semibold", summary?.pass === false && "text-red-700 dark:text-red-400")}>{summary?.error == null ? "–" : `${fmt(summary.error, 1)} %`} <span className="ml-2"><PassBadge pass={summary?.pass ?? null} /></span></td>
        </tr>
      </tbody>
    </>
  );
}

/** Xem kết quả chỉ đọc (từ job.result hoặc snapshot) */
export function JobResultView({ result, template }: { result: EvalResult; template?: Template | null }) {
  const unitOf = useMemo(() => Object.fromEntries((template?.sections ?? []).map((s) => [s.id, "unit" in s ? s.unit : ""])), [template]);
  return (
    <div className="space-y-4">
      {result.sections.map((s, si) => (
        <section key={s.id}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h4 className="font-semibold">{si + 1}. {s.title}</h4>
            <PassBadge pass={s.pass} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="table">
              {s.kind === "checklist" ? (
                <tbody>{s.rows.map((r, i) => <tr key={i}><td>{r.label}</td><td className="w-32"><PassBadge pass={r.pass} /></td></tr>)}</tbody>
              ) : s.kind === "linearity" ? (
                <tbody><tr>
                  <td>{s.rows[0]?.label}</td>
                  <td className="num whitespace-nowrap">R² = <b>{fmt(s.rows[0]?.error, 4)}</b></td>
                  <td className="num whitespace-nowrap">≥ {fmt(s.rows[0]?.mpe, 4)}</td>
                  <td className="w-28"><PassBadge pass={s.pass} /></td>
                </tr></tbody>
              ) : s.kind === "ra" ? (
                <>
                  <thead><tr><th>Lần</th><th className="num">Hệ thống (CEM)</th><th className="num">Đối chứng (RM)</th><th className="num">dᵢ</th></tr></thead>
                  <tbody>
                    {s.rows.slice(0, -1).map((r, i) => (
                      <tr key={i}><td>{r.label}</td><td className="num">{fmt(r.readings[0], s.decimals ?? 2)}</td><td className="num">{fmt(r.readings[1], s.decimals ?? 2)}</td><td className="num">{fmt(r.error, (s.decimals ?? 2) + 1)}</td></tr>
                    ))}
                    <tr><td colSpan={3} className="text-sm">{s.rows.at(-1)?.label}</td>
                      <td className="num whitespace-nowrap font-semibold">{s.rows.at(-1)?.error == null ? "–" : `${fmt(s.rows.at(-1)!.error, 1)} % ≤ ${fmt(s.rows.at(-1)!.mpe, 0)} %`} <span className="ml-1"><PassBadge pass={s.pass} /></span></td></tr>
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th>Điểm / mục</th><th>Số đọc{unitOf[s.id] ? ` (${unitOf[s.id]})` : ""}</th><th className="num">TB</th><th className="num">Sai số</th><th className="num">MPE (±)</th><th>Kết luận</th></tr></thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{r.label}</td>
                        <td className="tabular-nums">{r.readings.length ? r.readings.map((x) => fmt(x, s.decimals ?? 2)).join("; ") : "–"}</td>
                        <td className="num">{fmt(r.mean, s.decimals ?? 2)}</td>
                        <td className={clsx("num", r.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(r.error, r.unit === "%" ? 1 : s.decimals ?? 2)}{r.unit === "%" && r.error != null ? " %" : ""}</td>
                        <td className="num">{r.mpe == null ? "–" : `${r.cmp ?? "±"} ${fmt(r.mpe, r.unit === "%" ? 1 : s.decimals ?? 2)}${r.unit === "%" ? " %" : ""}`}</td>
                        <td><PassBadge pass={r.pass} /></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

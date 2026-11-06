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
    if (s.kind === "points") for (const p of s.points) { put(p.id, s.readings); if (s.directions === 2) put(p.id + ":down", s.readings); }
    else if (s.kind === "repeatability") put("r", s.readings);
    else for (let i = 1; i <= s.positions; i++) put(`p${i}`, 1);
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
                {s.kind !== "checklist" && <span>Sai số cho phép: {mpeText(s.kind === "repeatability" ? s.limit : s.mpe, s.unit)}</span>}
                <PassBadge pass={es?.pass ?? null} />
              </div>
            </div>
            {s.kind === "checklist" ? (
              <ChecklistEditor s={s} values={checks[s.id] ?? {}} onCheck={(item, v) => onCheck(s.id, item, v)} disabled={disabled} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="table">
                  {s.kind === "points" && <PointsEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
                  {s.kind === "repeatability" && <RepeatEditor s={s} texts={texts} row={es?.rows[0]} onText={onText} disabled={disabled} />}
                  {s.kind === "eccentricity" && <EccEditor s={s} texts={texts} rows={es?.rows ?? []} onText={onText} disabled={disabled} />}
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
  return (
    <>
      <thead>
        <tr>
          <th>Điểm đo</th>
          <th>{two ? "Số đọc (tăng)" : `Số đọc (${s.unit})`}</th>
          {two && <th>Số đọc (giảm)</th>}
          <th className="num">TB{two ? " tăng / giảm" : ""}</th>
          <th className="num">Sai số{two ? " tăng / giảm" : ""}</th>
          {two && <th className="num">Độ trễ</th>}
          <th className="num">MPE (±)</th>
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
              <td><div className="flex flex-wrap gap-1">{inputs(p.id, label + (two ? " tăng" : ""))}</div></td>
              {two && <td><div className="flex flex-wrap gap-1">{inputs(p.id + ":down", label + " giảm")}</div></td>}
              <td className="num whitespace-nowrap">{fmt(up?.mean, s.decimals)}{two && ` / ${fmt(down?.mean, s.decimals)}`}</td>
              <td className={clsx("num whitespace-nowrap", (up?.pass === false || down?.pass === false) && "font-semibold text-red-700 dark:text-red-400")}>
                {fmt(up?.error, s.decimals)}{two && ` / ${fmt(down?.error, s.decimals)}`}
              </td>
              {two && <td className={clsx("num", hys?.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(hys?.error, s.decimals)}</td>}
              <td className="num whitespace-nowrap">{fmt(up?.mpe, s.decimals)}</td>
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
      <thead><tr><th>Tải</th><th>Số đọc ({s.unit}), {s.readings} lần</th><th className="num">TB</th><th className="num">Chênh lệch lớn nhất</th><th className="num">Giới hạn</th><th>Kết luận</th></tr></thead>
      <tbody>
        <tr>
          <td className="whitespace-nowrap font-medium">{fmt(s.nominal, s.decimals)} {s.unit}</td>
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

/** Xem kết quả chỉ đọc (từ job.result hoặc snapshot) */
export function JobResultView({ result, template }: { result: EvalResult; template?: Template | null }) {
  const unitOf = useMemo(() => Object.fromEntries((template?.sections ?? []).map((s) => [s.id, s.kind === "checklist" ? "" : s.unit])), [template]);
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
              ) : (
                <>
                  <thead><tr><th>Điểm / mục</th><th>Số đọc{unitOf[s.id] ? ` (${unitOf[s.id]})` : ""}</th><th className="num">TB</th><th className="num">Sai số</th><th className="num">MPE (±)</th><th>Kết luận</th></tr></thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{r.label}</td>
                        <td className="tabular-nums">{r.readings.length ? r.readings.map((x) => fmt(x, s.decimals ?? 2)).join("; ") : "–"}</td>
                        <td className="num">{fmt(r.mean, s.decimals ?? 2)}</td>
                        <td className={clsx("num", r.pass === false && "font-semibold text-red-700 dark:text-red-400")}>{fmt(r.error, s.decimals ?? 2)}</td>
                        <td className="num">{fmt(r.mpe, s.decimals ?? 2)}</td>
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

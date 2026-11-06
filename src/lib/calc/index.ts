// =============================================================================
// BỘ MÁY TÍNH SAI SỐ – thuần TypeScript, không phụ thuộc giao diện.
// Đầu vào: mẫu biên bản (Template) + số đọc (Readings). Đầu ra: EvalResult.
// Chạy giống nhau trên trình duyệt (khi nhập) và khi phát hành (tính lại để đối chiếu).
// =============================================================================
import type { EvalResult, EvalRow, EvalSection, MpeSpec, Readings, Template, TemplateSection } from "../types";

/** Sai số cho phép (MPE) tại một giá trị danh định, trả về giá trị dương (±) */
export function mpeAt(spec: MpeSpec, nominal: number): number {
  switch (spec.kind) {
    case "abs": return Math.abs(spec.value);
    case "pct_reading": return Math.abs(nominal) * spec.value / 100;
    case "pct_span": return Math.abs(spec.span) * spec.value / 100;
    case "scale_oiml": return oimlMpe(spec, nominal);
  }
}

/** OIML R76 / ĐLVN: MPE của cân không tự động theo số khoảng chia kiểm e = m/e */
function oimlMpe(spec: Extract<MpeSpec, { kind: "scale_oiml" }>, load: number): number {
  const m = Math.abs(load) / spec.e; // số bội của e
  // ngưỡng số bội của e theo cấp chính xác (kiểm định ban đầu)
  const limits: Record<typeof spec.cls, [number, number]> = {
    I: [50_000, 200_000],
    II: [5_000, 20_000],
    III: [500, 2_000],
    IIII: [50, 200],
  };
  const [a, b] = limits[spec.cls];
  let k = m <= a ? 0.5 : m <= b ? 1 : 1.5;
  if (spec.in_service) k *= 2; // kiểm định định kỳ / trong sử dụng: gấp đôi
  return k * spec.e;
}

export function mpeText(spec: MpeSpec, unit: string): string {
  switch (spec.kind) {
    case "abs": return `± ${fmtNum(spec.value)} ${unit}`;
    case "pct_reading": return `± ${fmtNum(spec.value)} % giá trị đo`;
    case "pct_span": return `± ${fmtNum(spec.value)} % phạm vi (${fmtNum(spec.span)} ${unit})`;
    case "scale_oiml": return `theo cấp ${spec.cls}, e = ${fmtNum(spec.e)} ${unit}${spec.in_service ? " (trong sử dụng)" : ""}`;
  }
}

function fmtNum(n: number, decimals?: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: decimals ?? 6, minimumFractionDigits: decimals ?? 0 }).format(n);
}

export function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

const nums = (arr: (number | null)[] | undefined, n: number): (number | null)[] =>
  Array.from({ length: n }, (_, i) => (arr && typeof arr[i] === "number" && Number.isFinite(arr[i]) ? (arr[i] as number) : null));
const mean = (arr: (number | null)[]) => {
  const v = arr.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const allFilled = (arr: (number | null)[]) => arr.every((x) => x != null);

/** Đánh giá toàn bộ biên bản */
export function evaluate(template: Template, readings: Readings): EvalResult {
  const done: Record<string, EvalSection> = {};
  const sections: EvalSection[] = template.sections.map((s) => {
    const r = evaluateSection(s, readings[s.id], done);
    done[s.id] = r;
    return r;
  });
  const missing = sections.flatMap((s) => s.rows.filter((r) => r.pass === null).map((r) => `${s.title}: ${r.label}`));
  const complete = missing.length === 0;
  const pass = complete ? sections.every((s) => s.pass === true) : sections.some((s) => s.pass === false) ? false : null;
  return { sections, pass, complete, missing };
}

/** Giá trị chuẩn của một điểm: nhập tay (key `${id}:ref`) nếu mẫu yêu cầu, ngược lại là giá trị danh định */
function refOf(data: Record<string, (number | null)[]>, id: string, refInput: boolean | undefined, nominal: number): number | null {
  if (!refInput) return nominal;
  const v = data[`${id}:ref`]?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Độ lệch chuẩn mẫu (n − 1) */
export function stdev(v: number[]): number {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** Hệ số xác định R² của hồi quy tuyến tính y = a + bx */
export function rSquared(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  if (sxx === 0 || syy === 0) return syy === 0 && sxx === 0 ? 1 : 0;
  return (sxy * sxy) / (sxx * syy);
}

/** Hệ số t (0,025; n − 1) – bảng của TT 10/2021/TT-BTNMT Phụ lục 12 (n − 1 = 5…14), ngoài bảng dùng giá trị Student */
export function t025(df: number): number {
  const T: Record<number, number> = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 25: 2.06, 30: 2.042 };
  if (T[df]) return T[df];
  const keys = Object.keys(T).map(Number).filter((k) => k <= df);
  return df > 30 ? 1.96 : T[Math.max(...keys)];
}

/**
 * Độ chính xác tương đối RA (TT 10/2021/TT-BTNMT, Phụ lục 12):
 *   d̄ = Σdi/n, di = CEMi − RMi;  Stdev = √[(Σdi² − (Σdi)²/n)/(n − 1)];  cc = t0,025 · Stdev/√n;
 *   RA = (|d̄| + |cc|) / RM̄ × 100.  Khí (SO2, NO2, CO, H2S, NH3, Hg): RM̄ < 50 % giới hạn QCVN → mẫu số = giới hạn QCVN.
 */
export function relativeAccuracy(cem: number[], rm: number[], qcvnLimit?: number | null) {
  const n = cem.length;
  const d = cem.map((c, i) => c - rm[i]);
  const sum = d.reduce((a, b) => a + b, 0);
  const dMean = sum / n;
  const sd = Math.sqrt((d.reduce((a, b) => a + b * b, 0) - (sum * sum) / n) / (n - 1));
  const cc = t025(n - 1) * sd / Math.sqrt(n);
  const rmMean = rm.reduce((a, b) => a + b, 0) / n;
  const sub = qcvnLimit != null && qcvnLimit > 0 && rmMean < 0.5 * qcvnLimit;
  const denom = sub ? qcvnLimit! : rmMean;
  const ra = denom === 0 ? Infinity : ((Math.abs(dMean) + Math.abs(cc)) / Math.abs(denom)) * 100;
  return { n, d, dMean, sd, cc, rmMean, denom, substituted: sub, ra };
}

function evaluateSection(s: TemplateSection, data: Readings[string] | undefined, done: Record<string, EvalSection>): EvalSection {
  const base = { id: s.id, title: s.title, kind: s.kind };
  switch (s.kind) {
    case "checklist": {
      const d = (data ?? {}) as Record<string, boolean>;
      const rows: EvalRow[] = s.items.map((it) => ({
        label: it.label, nominal: null, readings: [], mean: null, error: null, mpe: null,
        pass: typeof d[it.id] === "boolean" ? d[it.id] : null,
      }));
      return { ...base, rows, pass: rowsPass(rows) };
    }
    case "points": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const rows: EvalRow[] = [];
      for (const p of s.points) {
        const spec = p.mpe ?? s.mpe;
        const ref = refOf(d, p.id, s.ref_input, p.nominal);
        const label = p.label ?? `${fmtNum(p.nominal, s.decimals)} ${s.unit}`;
        const up = nums(d[p.id], s.readings);
        const upMean = mean(up);
        if (ref == null) {
          rows.push({ label, nominal: null, readings: up, mean: upMean == null ? null : round(upMean, s.decimals + 1), error: null, mpe: null, pass: null, note: "chưa nhập giá trị chuẩn" });
          continue;
        }
        const mpe = round(mpeAt(spec, ref), s.decimals + 2);
        const upRow = evalPoint(s.directions === 2 ? `${label} (tăng)` : label, ref, up, upMean, mpe, s.decimals);
        if (s.relative) toRelative(upRow, ref);
        rows.push(upRow);
        if (s.directions === 2) {
          const down = nums(d[p.id + ":down"], s.readings);
          const downMean = mean(down);
          rows.push(evalPoint(`${label} (giảm)`, ref, down, downMean, mpe, s.decimals));
          const hLimit = round(mpeAt(s.hysteresis_mpe ?? spec, ref), s.decimals + 2);
          const h = upMean != null && downMean != null && allFilled(up) && allFilled(down) ? round(Math.abs(upMean - downMean), s.decimals + 1) : null;
          rows.push({ label: `${label} – độ trễ`, nominal: null, readings: [], mean: null, error: h, mpe: hLimit, pass: h == null ? null : h <= hLimit });
        }
      }
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
    case "repeatability": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const arr = nums(d.r, s.readings);
      const ref = refOf(d, "r", s.ref_input, s.nominal);
      const v = arr.filter((x): x is number => x != null);
      const byStd = s.method === "stdev";
      const limit = ref == null ? null : round(mpeAt(s.limit, ref), s.decimals + 3);
      const spread = allFilled(arr) && v.length > 1 ? round(byStd ? stdev(v) : Math.max(...v) - Math.min(...v), s.decimals + 2) : null;
      const rows: EvalRow[] = [{
        label: `${ref == null ? "Giá trị chuẩn ?" : `${fmtNum(ref, s.decimals)} ${s.unit}`}, ${s.readings} lần`, nominal: ref, readings: arr,
        mean: mean(arr) == null ? null : round(mean(arr)!, s.decimals + 1),
        error: spread, mpe: limit, pass: spread == null || limit == null ? null : spread <= limit,
        note: byStd ? "độ lệch chuẩn s" : "chênh lệch lớn nhất giữa các lần đọc",
      }];
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
    case "eccentricity": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const mpe = round(mpeAt(s.mpe, s.nominal), s.decimals + 2);
      const rows: EvalRow[] = Array.from({ length: s.positions }, (_, i) => {
        const v = nums(d[`p${i + 1}`], 1)[0];
        const err = v == null ? null : round(v - s.nominal, s.decimals + 1);
        return { label: `Vị trí ${i + 1}`, nominal: s.nominal, readings: [v], mean: v, error: err, mpe, pass: err == null ? null : Math.abs(err) <= mpe };
      });
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
    case "drift": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const arr = nums(d.r, s.readings);
      const ref = refOf(d, "r", s.ref_input, s.nominal);
      const limit = ref == null ? null : round(mpeAt(s.limit, ref), s.decimals + 2);
      const first = arr[0];
      const rows: EvalRow[] = arr.slice(1).map((v, i) => {
        const err = v == null || first == null ? null : round(v - first, s.decimals + 1);
        return { label: `Sau ${i + 1} × ${s.interval}`, nominal: ref, readings: [first, v], mean: v, error: err, mpe: limit, pass: err == null || limit == null ? null : Math.abs(err) <= limit };
      });
      if (first == null) rows.unshift({ label: "Lần đo đầu", nominal: ref, readings: [null], mean: null, error: null, mpe: null, pass: null });
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
    case "linearity": {
      const src = done[s.source];
      const pts = (src?.rows ?? []).filter((r) => r.nominal != null && r.mean != null && !r.label.endsWith("độ trễ")).map((r) => [r.nominal!, r.mean!] as const);
      const enough = pts.length >= 3 && src?.rows.every((r) => r.mean != null || r.label.endsWith("độ trễ"));
      const r2 = enough ? round(rSquared(pts.map((p) => p[0]), pts.map((p) => p[1])), 5) : null;
      const rows: EvalRow[] = [{
        label: `Hệ số xác định R² từ ${pts.length} điểm của mục "${src?.title ?? s.source}"`, nominal: null, readings: [], mean: null,
        error: r2, mpe: s.min_r2, pass: r2 == null ? null : r2 >= s.min_r2, unit: "", cmp: "≥",
      }];
      return { ...base, rows, pass: rowsPass(rows), decimals: 4 };
    }
    case "ra": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const cemArr = nums(d.cem, s.pairs), rmArr = nums(d.rm, s.pairs);
      const pairs = cemArr.map((c, i) => [c, rmArr[i]] as const).filter((p): p is readonly [number, number] => p[0] != null && p[1] != null);
      const qcvn = s.qcvn_sub ? nums(d.qcvn, 1)[0] : null;
      const rows: EvalRow[] = pairs.map(([c, r], i) => ({ label: `Lần ${i + 1}`, nominal: r, readings: [c, r], mean: c, error: round(c - r, s.decimals + 2), mpe: null, pass: true }));
      if (pairs.length >= 6 && (!s.qcvn_sub || qcvn != null)) {
        const res = relativeAccuracy(pairs.map((p) => p[0]), pairs.map((p) => p[1]), qcvn);
        rows.push({
          label: `RA (n = ${res.n}; d̄ = ${fmtNum(res.dMean, s.decimals + 2)}; Stdev = ${fmtNum(res.sd, s.decimals + 2)}; cc = ${fmtNum(res.cc, s.decimals + 2)}; mẫu số = ${fmtNum(res.denom, s.decimals + 2)}${res.substituted ? " (giới hạn QCVN)" : " (RM̄)"})`,
          nominal: null, readings: [], mean: null, error: round(res.ra, 2), mpe: s.limit_pct, pass: res.ra <= s.limit_pct, unit: "%",
        });
      } else {
        rows.push({ label: s.qcvn_sub && qcvn == null && pairs.length >= 6 ? "RA – cần nhập giới hạn QCVN áp dụng" : `RA – cần tối thiểu 6 cặp số liệu (đã có ${pairs.length})`, nominal: null, readings: [], mean: null, error: null, mpe: s.limit_pct, pass: null, unit: "%" });
      }
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
  }
}

/** Đổi sai số tuyệt đối thành sai số tương đối (%) theo giá trị chuẩn */
function toRelative(row: EvalRow, ref: number) {
  if (ref === 0) return;
  row.error = row.error == null ? null : round((row.error / ref) * 100, 2);
  row.mpe = row.mpe == null ? null : round((row.mpe / Math.abs(ref)) * 100, 2);
  row.unit = "%";
}

function evalPoint(label: string, nominal: number, arr: (number | null)[], m: number | null, mpe: number, decimals: number): EvalRow {
  const filled = allFilled(arr) && m != null;
  const err = filled ? round(m! - nominal, decimals + 1) : null;
  return { label, nominal, readings: arr, mean: m == null ? null : round(m, decimals + 1), error: err, mpe, pass: err == null ? null : Math.abs(err) <= mpe };
}

function rowsPass(rows: EvalRow[]): boolean | null {
  if (rows.some((r) => r.pass === false)) return false;
  if (rows.some((r) => r.pass === null)) return null;
  return true;
}

/** Kiểm tra điều kiện môi trường so với giới hạn của quy trình. Trả về danh sách vi phạm (rỗng = đạt). */
export function checkEnv(template: Template, env: { temp: number | null; humidity: number | null }): string[] {
  const out: string[] = [];
  const { temp, humidity } = template.env_limits;
  if (temp) {
    if (env.temp == null) out.push("Chưa ghi nhiệt độ môi trường");
    else if (env.temp < temp[0] || env.temp > temp[1]) out.push(`Nhiệt độ ${env.temp} °C ngoài giới hạn ${temp[0]}–${temp[1]} °C`);
  }
  if (humidity) {
    if (env.humidity == null) out.push("Chưa ghi độ ẩm môi trường");
    else if (env.humidity < humidity[0] || env.humidity > humidity[1]) out.push(`Độ ẩm ${env.humidity} %RH ngoài giới hạn ${humidity[0]}–${humidity[1]} %RH`);
  }
  return out;
}

/** So sánh hai kết quả (máy khách vs tính lại) – dùng trước khi phát hành */
export function sameResult(a: EvalResult | null, b: EvalResult | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Băm đơn giản (FNV-1a 64 bit dạng hex) cho ảnh chụp GCN – đủ để phát hiện sửa đổi, không dùng làm chữ ký */
export function fnv1a(str: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c * 31 + i), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export async function sha256Hex(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fnv1a(str);
}

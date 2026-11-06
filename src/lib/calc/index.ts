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
  const sections: EvalSection[] = template.sections.map((s) => evaluateSection(s, readings[s.id]));
  const missing = sections.flatMap((s) => s.rows.filter((r) => r.pass === null).map((r) => `${s.title}: ${r.label}`));
  const complete = missing.length === 0;
  const pass = complete ? sections.every((s) => s.pass === true) : sections.some((s) => s.pass === false) ? false : null;
  return { sections, pass, complete, missing };
}

function evaluateSection(s: TemplateSection, data: Readings[string] | undefined): EvalSection {
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
        const mpe = round(mpeAt(spec, p.nominal), s.decimals + 2);
        const label = p.label ?? `${fmtNum(p.nominal, s.decimals)} ${s.unit}`;
        const up = nums(d[p.id], s.readings);
        const upMean = mean(up);
        const upRow = evalPoint(s.directions === 2 ? `${label} (tăng)` : label, p.nominal, up, upMean, mpe, s.decimals);
        rows.push(upRow);
        if (s.directions === 2) {
          const down = nums(d[p.id + ":down"], s.readings);
          const downMean = mean(down);
          rows.push(evalPoint(`${label} (giảm)`, p.nominal, down, downMean, mpe, s.decimals));
          const hLimit = round(mpeAt(s.hysteresis_mpe ?? spec, p.nominal), s.decimals + 2);
          const h = upMean != null && downMean != null && allFilled(up) && allFilled(down) ? round(Math.abs(upMean - downMean), s.decimals + 1) : null;
          rows.push({ label: `${label} – độ trễ`, nominal: null, readings: [], mean: null, error: h, mpe: hLimit, pass: h == null ? null : h <= hLimit });
        }
      }
      return { ...base, rows, pass: rowsPass(rows), unit: s.unit, decimals: s.decimals };
    }
    case "repeatability": {
      const d = (data ?? {}) as Record<string, (number | null)[]>;
      const arr = nums(d.r, s.readings);
      const limit = round(mpeAt(s.limit, s.nominal), s.decimals + 2);
      const v = arr.filter((x): x is number => x != null);
      const spread = allFilled(arr) ? round(Math.max(...v) - Math.min(...v), s.decimals + 1) : null;
      const rows: EvalRow[] = [{
        label: `Tải ${fmtNum(s.nominal, s.decimals)} ${s.unit}, ${s.readings} lần`, nominal: s.nominal, readings: arr, mean: mean(arr) == null ? null : round(mean(arr)!, s.decimals + 1),
        error: spread, mpe: limit, pass: spread == null ? null : spread <= limit, note: "sai số = chênh lệch lớn nhất giữa các lần đọc",
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
  }
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

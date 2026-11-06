import { describe, expect, it } from "vitest";
import { evaluate, relativeAccuracy, rSquared, stdev } from "@/lib/calc";
import { PROCEDURES_QT, INSTRUMENT_TYPES_QT } from "@/lib/seed/monitoring";
import { genReadings } from "@/lib/seed/demo";
import { LocalRepo } from "@/lib/store/local";
import { seedDemo } from "@/lib/seed/demo";
import type { Template } from "@/lib/types";

describe("công thức theo văn bản", () => {
  it("RA theo TT 10/2021 Phụ lục 12 (tính tay: 8,97 %)", () => {
    const r = relativeAccuracy([10, 12, 11, 13, 9, 10], [10, 11, 11, 12, 10, 10]);
    expect(r.dMean).toBeCloseTo(0.16667, 4);
    expect(r.sd).toBeCloseTo(0.75277, 4);
    expect(r.cc).toBeCloseTo(2.571 * 0.75277 / Math.sqrt(6), 4);
    expect(r.ra).toBeCloseTo(8.97, 2);
  });
  it("RA khí: RM̄ < 50 % giới hạn QCVN → mẫu số là giới hạn QCVN", () => {
    const r = relativeAccuracy([10, 12, 11, 13, 9, 10], [10, 11, 11, 12, 10, 10], 500);
    expect(r.substituted).toBe(true);
    expect(r.denom).toBe(500);
    expect(r.ra).toBeCloseTo(((0.16667 + 0.79013) / 500) * 100, 2);
    expect(relativeAccuracy([10, 12, 11, 13, 9, 10], [10, 11, 11, 12, 10, 10], 15).substituted).toBe(false);
  });
  it("độ lệch chuẩn mẫu và R²", () => {
    expect(stdev([7.0, 7.01, 7.0, 7.02, 7.01])).toBeCloseTo(0.008367, 5);
    expect(rSquared([100, 250, 400], [101, 249, 402])).toBeGreaterThan(0.9999);
    expect(rSquared([100, 250, 400], [100, 300, 400])).toBeLessThan(0.99);
  });
});

const tpl: Template = {
  env_limits: {},
  sections: [
    { id: "err", kind: "points", title: "Sai số", unit: "mg/L", decimals: 1, readings: 3, directions: 1, mpe: { kind: "pct_reading", value: 5 }, ref_input: true, relative: true,
      points: [{ id: "a", nominal: 100 }, { id: "b", nominal: 250 }, { id: "c", nominal: 400 }] },
    { id: "lin", kind: "linearity", title: "Tuyến tính", source: "err", min_r2: 0.99 },
    { id: "rep", kind: "repeatability", title: "Lặp lại", unit: "pH", decimals: 2, nominal: 7, readings: 5, method: "stdev", limit: { kind: "abs", value: 0.025 } },
    { id: "dr", kind: "drift", title: "Trôi", unit: "pH", decimals: 2, nominal: 7, readings: 3, interval: "2 giờ", limit: { kind: "abs", value: 0.05 } },
  ],
};

describe("mục biên bản mới", () => {
  it("sai số tương đối theo giá trị chuẩn nhập tay, tuyến tính, lặp lại theo s", () => {
    const r = evaluate(tpl, {
      err: { "a:ref": [98.5], a: [101, 102, 100], "b:ref": [251], b: [250, 252, 251], "c:ref": [399], c: [402, 401, 400] },
      rep: { r: [7.0, 7.01, 7.0, 7.02, 7.01] },
      dr: { r: [7.0, 7.02, 7.04] },
    });
    const err = r.sections[0];
    expect(err.rows[0].unit).toBe("%");
    expect(err.rows[0].error).toBeCloseTo(((101 - 98.5) / 98.5) * 100, 1); // 2,54 %
    expect(err.rows[0].mpe).toBe(5);
    expect(err.pass).toBe(true);
    expect(r.sections[1].rows[0].error).toBeGreaterThan(0.999);
    expect(r.sections[2].rows[0].error).toBeCloseTo(0.0084, 3);
    expect(r.sections[2].pass).toBe(true);
    expect(r.sections[3].pass).toBe(true);
    expect(r.pass).toBe(true);
  });
  it("thiếu giá trị chuẩn → chưa kết luận; vượt 5 % → không đạt; trôi vượt → không đạt", () => {
    const missingRef = evaluate(tpl, { err: { a: [101, 102, 100] } });
    expect(missingRef.sections[0].rows[0].pass).toBeNull();
    const bad = evaluate(tpl, { err: { "a:ref": [100], a: [106, 106, 106] }, dr: { r: [7.0, 7.03, 7.06] } });
    expect(bad.sections[0].rows[0].pass).toBe(false);
    expect(bad.sections[3].rows[1].pass).toBe(false);
  });
  it("RA cần ít nhất 6 cặp; đủ thì tính và so giới hạn", () => {
    const t: Template = { env_limits: {}, sections: [{ id: "ra", kind: "ra", title: "RA", unit: "mg/L", decimals: 1, pairs: 9, limit_pct: 20 }] };
    expect(evaluate(t, { ra: { cem: [10, 12, 11], rm: [10, 11, 11] } }).complete).toBe(false);
    const ok = evaluate(t, { ra: { cem: [10, 12, 11, 13, 9, 10], rm: [10, 11, 11, 12, 10, 10] } });
    const last = ok.sections[0].rows.at(-1)!;
    expect(last.error).toBeCloseTo(8.97, 1);
    expect(ok.pass).toBe(true);
  });
});

describe("thư viện quan trắc tự động", () => {
  it("mọi quy trình đánh giá đạt với số liệu mẫu hợp lệ và có đủ căn cứ", () => {
    for (const p of PROCEDURES_QT) {
      const r = evaluate(p.template, genReadings(p.template));
      expect(r.complete, p.id + " " + r.missing.join("; ")).toBe(true);
      expect(r.pass, p.id).toBe(true);
      expect(p.legal, p.id).toBeTruthy();
    }
  });
  it("mỗi loại phương tiện đo trỏ tới quy trình có thật, chu kỳ 12 tháng", () => {
    const ids = new Set(PROCEDURES_QT.map((p) => p.id));
    for (const t of INSTRUMENT_TYPES_QT) {
      expect(ids.has(t.procedure_id!), t.id).toBe(true);
      expect(t.cycle_months).toBe(12);
    }
  });
  it("dữ liệu mẫu: GCN đầu đo pH có tem; biên bản RA không có tem", async () => {
    const repo = new LocalRepo({ memoryOnly: true });
    await seedDemo(repo);
    const certs = await repo.list("certificates", { where: { customer_id: "c-1" } });
    const ra = certs.find((c) => c.snapshot.procedure?.doc_kind === "ra_report")!;
    const ph = certs.find((c) => c.snapshot.procedure?.code === "ĐLVN 381:2021")!;
    expect(ra.kind).toBe("certificate");
    expect(ra.seal_no).toBeNull();
    expect(ph.seal_no).toMatch(/^KĐV-/);
  });
});

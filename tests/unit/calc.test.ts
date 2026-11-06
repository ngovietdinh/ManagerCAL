import { describe, expect, it } from "vitest";
import { evaluate, mpeAt, checkEnv } from "@/lib/calc";
import type { Template } from "@/lib/types";

describe("mpeAt", () => {
  it("tuyệt đối, % giá trị đo, % phạm vi", () => {
    expect(mpeAt({ kind: "abs", value: 3 }, 100)).toBe(3);
    expect(mpeAt({ kind: "pct_reading", value: 2 }, 50)).toBe(1);
    expect(mpeAt({ kind: "pct_span", value: 1.6, span: 10 }, 4)).toBeCloseTo(0.16);
  });
  it("cân OIML cấp III: 0,5e / 1e / 1,5e, gấp đôi khi trong sử dụng", () => {
    const s = { kind: "scale_oiml" as const, e: 20, cls: "III" as const };
    expect(mpeAt(s, 1000)).toBe(10);      // 50e → 0,5e
    expect(mpeAt(s, 20000)).toBe(20);     // 1000e → 1e
    expect(mpeAt(s, 60000)).toBe(30);     // 3000e → 1,5e
    expect(mpeAt({ ...s, in_service: true }, 60000)).toBe(60);
  });
});

const tpl: Template = {
  env_limits: { temp: [15, 30] },
  sections: [
    { id: "ck", kind: "checklist", title: "Bên ngoài", items: [{ id: "a", label: "Nhãn" }] },
    { id: "err", kind: "points", title: "Sai số", unit: "bar", decimals: 2, readings: 1, directions: 2, mpe: { kind: "abs", value: 0.1 }, points: [{ id: "p1", nominal: 2 }] },
    { id: "rep", kind: "repeatability", title: "Lặp", unit: "kg", decimals: 1, nominal: 50, readings: 3, limit: { kind: "abs", value: 0.2 } },
  ],
};

describe("evaluate", () => {
  it("thiếu số liệu → chưa hoàn tất, chưa kết luận", () => {
    const r = evaluate(tpl, {});
    expect(r.complete).toBe(false);
    expect(r.pass).toBeNull();
    expect(r.missing.length).toBeGreaterThan(0);
  });
  it("đủ số liệu trong MPE → đạt, kèm độ trễ", () => {
    const r = evaluate(tpl, { ck: { a: true }, err: { p1: [2.05], "p1:down": [2.08] }, rep: { r: [50, 50.1, 49.9] } });
    expect(r.complete).toBe(true);
    expect(r.pass).toBe(true);
    const err = r.sections[1];
    expect(err.rows).toHaveLength(3);
    expect(err.rows[2].error).toBeCloseTo(0.03);
  });
  it("một điểm vượt MPE → không đạt ngay cả khi chưa đủ", () => {
    const r = evaluate(tpl, { ck: { a: true }, err: { p1: [2.3] } });
    expect(r.pass).toBe(false);
  });
  it("kiểm tra môi trường", () => {
    expect(checkEnv(tpl, { temp: 25, humidity: null })).toEqual([]);
    expect(checkEnv(tpl, { temp: 35, humidity: null })[0]).toMatch(/ngoài giới hạn/);
    expect(checkEnv(tpl, { temp: null, humidity: null })[0]).toMatch(/Chưa ghi/);
  });
});

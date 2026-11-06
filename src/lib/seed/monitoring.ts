// =============================================================================
// THƯ VIỆN QUY TRÌNH – THIẾT BỊ QUAN TRẮC MÔI TRƯỜNG TỰ ĐỘNG, LIÊN TỤC
//
// Căn cứ (đã đọc nguyên văn, 11/2026):
//  - ĐLVN 380:2021 … 389:2021 (Tổng cục TCĐLCL ban hành, Tổng cục Môi trường đề nghị): quy trình kiểm định
//    phương tiện đo của trạm quan trắc khí thải (380), môi trường nước (381 pH, 382 TDS, 383 EC, 384 độ đục,
//    385 DO, 386 amoni, 387 COD, 388 TSS) và không khí xung quanh (389). Chu kỳ kiểm định: 12 tháng.
//  - ĐLVN 90:2017: phương tiện đo hàm lượng bụi tổng trong không khí.
//  - Thông tư 10/2021/TT-BTNMT: Điều 34/37 (đặc tính kỹ thuật – Bảng 3, 5), Điều 35/38 (kiểm định, hiệu chuẩn theo
//    pháp luật đo lường; kiểm tra bằng chất chuẩn ≥ 1 lần/tháng; kiểm soát chất lượng 1 lần/năm bởi đơn vị độc lập,
//    đánh giá độ chính xác tương đối RA – Bảng 4 và Phụ lục 12).
//  - NĐ 08/2022/NĐ-CP (Điều 97, 98), sửa đổi bởi NĐ 05/2025/NĐ-CP và NĐ 48/2026/NĐ-CP: đối tượng phải quan trắc
//    tự động, liên tục; hồ sơ thiết bị kèm phiếu kiểm định, hiệu chuẩn.
//
// Sai số điểm "0" phụ thuộc độ phân giải của PTĐ: mẫu dưới đây chọn độ phân giải thường gặp; nếu thiết bị có
// độ phân giải khác, sửa MPE điểm "0" trong Danh mục › Quy trình (bảng tra ghi ở `legal`).
// =============================================================================
import type { Field, InstrumentType, MpeSpec, Procedure, Template, TemplateSection } from "../types";

const T0 = "2026-11-06T00:00:00.000Z";
const rel = (pct: number): MpeSpec => ({ kind: "pct_reading", value: pct });
const abs = (v: number): MpeSpec => ({ kind: "abs", value: v });

export const FIELDS_QT: Field[] = [
  { id: "f-qtn", code: "QTN", name: "Quan trắc môi trường nước", active: true, created_at: T0 },
  { id: "f-qtk", code: "QTK", name: "Quan trắc khí thải, không khí", active: true, created_at: T0 },
];

/** Kiểm tra bên ngoài + kỹ thuật (mục 7.1, 7.2 của ĐLVN 38x) + yêu cầu của TT 10/2021 */
const outside = (extra: string[] = []): TemplateSection => ({
  id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài và kỹ thuật",
  items: [
    { id: "c1", label: "Hình dáng, hiển thị, nguồn điện, nhãn hiệu, phụ kiện phù hợp tài liệu kỹ thuật" },
    { id: "c2", label: "Trạng thái hoạt động bình thường theo tài liệu của nhà sản xuất" },
    { id: "c3", label: "Cấu trúc: vật liệu chế tạo, phương pháp đo, đầu đo / điện cực / khoang đo" },
    { id: "c4", label: "Bộ phận hiển thị: phạm vi đo, giá trị độ chia, cơ cấu hiệu chỉnh được bảo mật / niêm phong" },
    ...extra.map((label, i) => ({ id: `t${i + 1}`, label })),
  ],
});
const TT10_STATION = [
  "Có ít nhất 01 khoảng đo ≥ 3 lần giới hạn QCVN áp dụng cho cơ sở (TT 10/2021, Điều 34/37)",
  "Lưu và kết xuất trạng thái thiết bị: đang đo, hiệu chuẩn, báo lỗi (TT 10/2021)",
];

/** Khung chung ĐLVN 382/384/386/387/388/380/389: điểm 0, sai số 3 điểm (≈20/50/80 % phạm vi), tuyến tính, lặp lại, trôi */
function analyzerTemplate(o: {
  unit: string; decimals: number; zeroMpe: number | null; testMpePct: number; range: number;
  linearity: boolean; repeatFactor: number; drift: { readings: number; interval: string; zero?: boolean };
  env: Template["env_limits"]; extraChecks?: string[];
}): Template {
  const r = o.range;
  const sections: TemplateSection[] = [outside(o.extraChecks ?? TT10_STATION)];
  if (o.zeroMpe != null) sections.push({
    id: "zero", kind: "points", title: "Kiểm tra điểm “0”", unit: o.unit, decimals: o.decimals, readings: 3, directions: 1,
    mpe: abs(o.zeroMpe), points: [{ id: "z", label: "Điểm “0”", nominal: 0 }],
  });
  sections.push({
    id: "err", kind: "points", title: "Kiểm tra sai số (dung dịch / khí chuẩn được chứng nhận)", unit: o.unit, decimals: o.decimals,
    readings: 3, directions: 1, mpe: rel(o.testMpePct), ref_input: true, relative: true,
    points: [
      { id: "p20", label: "Điểm 1 (≈ 20 % phạm vi)", nominal: round(r * 0.2) },
      { id: "p50", label: "Điểm 2 (≈ 50 % phạm vi)", nominal: round(r * 0.5) },
      { id: "p80", label: "Điểm 3 (≈ 80 % phạm vi)", nominal: round(r * 0.8) },
    ],
  });
  if (o.linearity) sections.push({ id: "lin", kind: "linearity", title: "Kiểm tra độ tuyến tính toàn thang đo", source: "err", min_r2: 0.99 });
  sections.push({
    id: "rep", kind: "repeatability", title: "Kiểm tra độ lặp lại (≥ 5 lần đo liên tiếp)", unit: o.unit, decimals: o.decimals,
    nominal: round(r * 0.5), readings: 5, method: "stdev", ref_input: true, limit: rel(round(o.testMpePct * o.repeatFactor)),
  });
  if (o.drift.zero && o.zeroMpe != null) sections.push({
    id: "zd", kind: "drift", title: `Kiểm tra độ trôi điểm “0” sau ${o.drift.interval}`, unit: o.unit, decimals: o.decimals,
    nominal: 0, readings: o.drift.readings, interval: o.drift.interval, limit: abs(o.zeroMpe),
  });
  sections.push({
    id: "drift", kind: "drift", title: `Kiểm tra độ trôi điểm nồng độ (mỗi ${o.drift.interval})`, unit: o.unit, decimals: o.decimals,
    nominal: round(r * 0.8), readings: o.drift.readings, interval: o.drift.interval, ref_input: true, limit: rel(o.testMpePct),
  });
  return { env_limits: o.env, sections };
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const ENV_LAB: Template["env_limits"] = { temp: [20, 30], humidity: [0, 80] };

const proc = (p: Omit<Procedure, "created_at" | "status" | "effective_from"> & { effective_from?: string }): Procedure =>
  ({ status: "active", effective_from: "2021-12-31", created_at: T0, ...p });

export const PROCEDURES_QT: Procedure[] = [
  // ---------------------------------------------------------------- nước (ĐLVN 381–388:2021)
  proc({
    id: "pr-qt-ph", code: "ĐLVN 381:2021", name: "Phương tiện đo pH của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "MPE theo giá trị độ chia: 0,01 pH → ± 0,05 pH; 0,1 pH → ± 0,2 pH (mẫu đang đặt cho độ chia 0,01). Độ lặp lại s ≤ ½|MPE| (độ chia 0,01) hoặc ≤ 1/3|MPE| (0,1). Độ trôi: 3 lần đo cách nhau 2 giờ ≤ MPE. Dung dịch chuẩn pH 4; 7 (6,86); 10 (9,18), ĐKĐBĐ ≤ 1/3|MPE|, ổn nhiệt 25 ± 0,1 °C. Chu kỳ 12 tháng.",
    note: "Phạm vi (0 ÷ 14) pH; áp dụng được cho trạm nước mặt, nước thải, nước ngầm, nước biển.",
    template: {
      env_limits: ENV_LAB,
      sections: [
        outside(["Lưu và kết xuất trạng thái thiết bị: đang đo, hiệu chuẩn, báo lỗi (TT 10/2021)"]),
        { id: "err", kind: "points", title: "Kiểm tra sai số tại 25 °C (dung dịch chuẩn pH)", unit: "pH", decimals: 2, readings: 3, directions: 1, mpe: abs(0.05), ref_input: true,
          points: [{ id: "p4", label: "pH 4", nominal: 4 }, { id: "p7", label: "pH 7 (6,86)", nominal: 7 }, { id: "p10", label: "pH 10 (9,18)", nominal: 10 }] },
        { id: "rep", kind: "repeatability", title: "Kiểm tra độ lặp lại (≥ 5 lần)", unit: "pH", decimals: 2, nominal: 7, readings: 5, method: "stdev", ref_input: true, limit: abs(0.025) },
        { id: "drift", kind: "drift", title: "Kiểm tra độ trôi (mỗi 2 giờ)", unit: "pH", decimals: 2, nominal: 7, readings: 3, interval: "2 giờ", ref_input: true, limit: abs(0.05) },
      ],
    },
  }),
  proc({
    id: "pr-qt-tds", code: "ĐLVN 382:2021", name: "Phương tiện đo tổng chất rắn hòa tan của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 200 000 mg/L. MPE điểm “0” theo độ phân giải: 0,01 → ± 0,1; 0,1 → ± 1; 1 → ± 2 mg/L (mẫu: độ phân giải 1 mg/L). MPE tại điểm kiểm ± 5 %; tuyến tính R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Dung dịch chuẩn ĐKĐB ≤ 1,5 %. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "mg/L", decimals: 0, zeroMpe: 2, testMpePct: 5, range: 2000, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-ec", code: "ĐLVN 383:2021", name: "Phương tiện đo độ dẫn điện của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 500 mS/cm. MPE tại điểm kiểm ± 5 %; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE (không có phép điểm “0” và tuyến tính). Dung dịch chuẩn ĐKĐB ≤ 1/3 MPE (≤ 20 µS/cm: < ½ MPE). Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "µS/cm", decimals: 1, zeroMpe: null, testMpePct: 5, range: 2000, linearity: false, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-turb", code: "ĐLVN 384:2021", name: "Phương tiện đo độ đục của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 4000 NTU. MPE điểm “0”: 0,01 → ± 0,1; 0,1 → ± 1; 1 → ± 2 NTU (mẫu: 0,1 NTU). Điểm kiểm (20 ± 10) %, (50 ± 10) %, (80 ± 10) % phạm vi; MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "NTU", decimals: 1, zeroMpe: 1, testMpePct: 5, range: 1000, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-do", code: "ĐLVN 385:2021", name: "Phương tiện đo nồng độ oxy hòa tan của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 20 mg/L (hoặc 200 % bão hòa). MPE điểm “0” ± 0,2 mg/L; MPE tại điểm kiểm ± 6 %; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE (không có phép tuyến tính). Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "mg/L", decimals: 2, zeroMpe: 0.2, testMpePct: 6, range: 20, linearity: false, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-nh4", code: "ĐLVN 386:2021", name: "Phương tiện đo hàm lượng amoni (theo N) trong nước của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 200 mg/L. MPE điểm “0”: 0,01 → ± 0,1; 0,1 → ± 1; 1 → ± 2 mg/L (mẫu: 0,01 mg/L). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Dung dịch chuẩn ĐKĐB ≤ 1,5 %. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "mg/L", decimals: 2, zeroMpe: 0.1, testMpePct: 5, range: 50, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-cod", code: "ĐLVN 387:2021", name: "Phương tiện đo nhu cầu oxy hóa học (COD) của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 500 mg/L. MPE điểm “0”: 0,01 → ± 0,1; 0,1 → ± 1; 1 → ± 2 mg/L (mẫu: 0,1 mg/L). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Dung dịch chuẩn COD ĐKĐB ≤ 1,5 %. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "mg/L", decimals: 1, zeroMpe: 1, testMpePct: 5, range: 500, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-tss", code: "ĐLVN 388:2021", name: "Phương tiện đo tổng chất rắn lơ lửng (TSS) của trạm quan trắc môi trường nước – Quy trình kiểm định", version: "2021",
    legal: "Phạm vi đến 500 mg/L. MPE điểm “0”: 0,01 → ± 0,1; 0,1 → ± 1; 1 → ± 2 mg/L (mẫu: 0,1 mg/L). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Dung dịch chuẩn TSS ĐKĐB ≤ 2 %. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "mg/L", decimals: 1, zeroMpe: 1, testMpePct: 5, range: 500, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  // ---------------------------------------------------------------- khí thải (ĐLVN 380:2021)
  proc({
    id: "pr-qt-gas", code: "ĐLVN 380:2021", name: "Phương tiện đo nồng độ khí của trạm quan trắc khí thải (CO, SO2, NO, NO2, HCl, NH3, HF, H2S) – Quy trình kiểm định", version: "2021 · ppm",
    legal: "Phạm vi: CO đến 0,5 %V; SO2 đến 0,2 %V; NO đến 0,4 %V; NO2 đến 0,2 %V; HCl 0,02; NH3 0,04; HF 0,03; H2S 0,05 %V. MPE điểm “0” theo độ phân giải: 0,1 ppm → ± 1 ppm; 1 ppm → ± 5 ppm (mẫu: 1 ppm, theo yêu cầu độ phân giải của TT 10/2021 Bảng 5). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Khí chuẩn trong N2, khí “không” N2 ≥ 99,995 %V. Chu kỳ 12 tháng.",
    note: "Mỗi kênh khí (một chất) là một phương tiện đo; ghi tên chất ở tên thiết bị.",
    template: analyzerTemplate({ unit: "ppm", decimals: 0, zeroMpe: 5, testMpePct: 5, range: 1000, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB, extraChecks: [...TT10_STATION, "Ống dẫn mẫu được gia nhiệt, không co thắt hoặc gấp khúc < 90° (TT 10/2021, Điều 37)"] }),
  }),
  proc({
    id: "pr-qt-o2", code: "ĐLVN 380:2021", name: "Phương tiện đo nồng độ O2, CO2 của trạm quan trắc khí thải – Quy trình kiểm định", version: "2021 · %V",
    legal: "Phạm vi O2, CO2 đến 30 %V. MPE điểm “0”: 0,01 %V → ± 0,05 %V; 0,1 %V → ± 0,5 %V (mẫu: 0,1 %V, theo TT 10/2021 Bảng 5). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; trôi 2 giờ ≤ MPE. Chu kỳ 12 tháng.",
    note: null,
    template: analyzerTemplate({ unit: "%V", decimals: 1, zeroMpe: 0.5, testMpePct: 5, range: 25, linearity: true, repeatFactor: 1 / 3, drift: { readings: 3, interval: "2 giờ" }, env: ENV_LAB }),
  }),
  // ---------------------------------------------------------------- không khí xung quanh (ĐLVN 389:2021, ĐLVN 90:2017)
  proc({
    id: "pr-qt-amb", code: "ĐLVN 389:2021", name: "Phương tiện đo nồng độ khí của trạm quan trắc chất lượng không khí xung quanh – Quy trình kiểm định", version: "2021",
    legal: "Thông số: CO đến 100 ppm; SO2, NO, NO2, NH3, H2S đến 10 ppm; O3 đến 5 ppm; THC đến 100 ppm; VOCs đến 1 ppm. MPE điểm “0” theo độ phân giải: 0,0001 ppm → ± 0,001; 0,001 → ± 0,01; 0,01 → ± 0,05; 0,1 → ± 0,5 ppm (mẫu: 0,001 ppm). MPE ± 5 %; R² ≥ 0,99; s ≤ 1/3|MPE|; độ trôi sau 24 giờ: điểm “0” (24ZD) ≤ MPE điểm “0”, điểm nồng độ (24SD) ≤ MPE. Khí “không” N2 ≥ 99,999 %V. Chu kỳ 12 tháng.",
    note: "Mỗi kênh khí là một phương tiện đo.",
    template: analyzerTemplate({ unit: "ppm", decimals: 3, zeroMpe: 0.01, testMpePct: 5, range: 1, linearity: true, repeatFactor: 1 / 3, drift: { readings: 2, interval: "24 giờ", zero: true }, env: ENV_LAB }),
  }),
  proc({
    id: "pr-qt-dust", code: "ĐLVN 90:2017", name: "Phương tiện đo hàm lượng bụi tổng trong không khí – Quy trình kiểm định", version: "2017",
    legal: "Phạm vi (0 ÷ 200) mg/m3. Điểm “không” (3 lần): độ chia 0,1 → 0,3; 0,01 → 0,05; 0,001 → 0,05 mg/m3 (mẫu: 0,01). Điểm kiểm (30 ± 15) % và (80 ± 15) % phạm vi, mỗi điểm ≥ 3 lần, sai số ≤ ± 10 % giá trị đọc. Độ lặp lại ≥ 5 lần, s ≤ 1/3 MPE. Điều kiện (25 ± 3) °C, ≤ 80 %RH.",
    note: null,
    template: {
      env_limits: { temp: [22, 28], humidity: [0, 80] },
      sections: [
        outside(),
        { id: "zero", kind: "points", title: "Kiểm tra điểm “không”", unit: "mg/m3", decimals: 2, readings: 3, directions: 1, mpe: abs(0.05), points: [{ id: "z", label: "Mẫu “không”", nominal: 0 }] },
        { id: "err", kind: "points", title: "Kiểm tra sai số", unit: "mg/m3", decimals: 2, readings: 3, directions: 1, mpe: rel(10), ref_input: true, relative: true,
          points: [{ id: "p30", label: "Điểm 1 (≈ 30 % phạm vi)", nominal: 60 }, { id: "p80", label: "Điểm 2 (≈ 80 % phạm vi)", nominal: 160 }] },
        { id: "rep", kind: "repeatability", title: "Kiểm tra độ lặp lại (≥ 5 lần)", unit: "mg/m3", decimals: 2, nominal: 60, readings: 5, method: "stdev", ref_input: true, limit: rel(round(10 / 3)) },
      ],
    },
  }),
  // ---------------------------------------------------------------- kiểm soát chất lượng hệ thống (TT 10/2021, RA)
  proc({
    id: "pr-qt-ra-nuoc", code: "TT 10/2021/TT-BTNMT – Điều 35", name: "Kiểm tra đặc tính kỹ thuật và độ chính xác tương đối (RA) – hệ thống quan trắc nước thải tự động, liên tục", version: "2021 · RA ≤ 20 %",
    doc_kind: "ra_report",
    legal: "Kiểm soát chất lượng trước khi vận hành chính thức và định kỳ 01 lần/năm bởi đơn vị độc lập (Khoản 6 Điều 35). Quan trắc đối chứng theo Phụ lục 4.1 hoặc phương pháp US EPA tương đương, riêng từng thông số, tối thiểu 06 mẫu/thông số. RA tính theo Phụ lục 12; giới hạn Bảng 4: pH, độ màu, COD, N-NH4+, tổng P, tổng N, TOC ≤ 20 %; TSS, Clo dư ≤ 30 %. Ghi vào biên bản theo Phụ lục 13.",
    note: "Dùng cho các thông số có giới hạn RA ≤ 20 %. TSS, Clo dư: dùng quy trình RA ≤ 30 %.",
    template: { env_limits: {}, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra vị trí, thành phần, tính năng của hệ thống", items: [
        { id: "c1", label: "Vị trí quan trắc đáp ứng quy định (Điều 33)" },
        { id: "c2", label: "Thu thập, lưu giữ, truyền dữ liệu về Sở TN&MT hoạt động" },
        { id: "c3", label: "Thiết bị có GCN kiểm định / hiệu chuẩn còn hiệu lực" },
        { id: "c4", label: "Có ít nhất 01 khoảng đo ≥ 3 lần giới hạn QCVN (trừ nhiệt độ, pH)" },
        { id: "c5", label: "Lưu trạng thái đang đo / hiệu chuẩn / báo lỗi; data logger có tài khoản, cổng kết nối niêm phong" },
        { id: "c6", label: "Thiết bị lấy và lưu mẫu tự động bảo quản 4 ± 2 °C, niêm phong" },
      ] },
      { id: "ra", kind: "ra", title: "Đánh giá độ chính xác tương đối (RA) – quan trắc đối chứng", unit: "mg/L", decimals: 2, pairs: 9, limit_pct: 20 },
    ] },
  }),
  proc({
    id: "pr-qt-ra-nuoc30", code: "TT 10/2021/TT-BTNMT – Điều 35", name: "Kiểm tra độ chính xác tương đối (RA) – hệ thống quan trắc nước thải tự động (TSS, Clo dư)", version: "2021 · RA ≤ 30 %",
    doc_kind: "ra_report",
    legal: "Như quy trình RA nước thải; giới hạn RA của TSS và Clo dư là ≤ 30 % (Bảng 4, TT 10/2021).",
    note: null,
    template: { env_limits: {}, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra thành phần, tính năng của hệ thống", items: [
        { id: "c1", label: "Vị trí quan trắc, truyền dữ liệu đáp ứng quy định" },
        { id: "c2", label: "Thiết bị có GCN kiểm định / hiệu chuẩn còn hiệu lực" },
      ] },
      { id: "ra", kind: "ra", title: "Đánh giá độ chính xác tương đối (RA) – quan trắc đối chứng", unit: "mg/L", decimals: 2, pairs: 9, limit_pct: 30 },
    ] },
  }),
  proc({
    id: "pr-qt-ra-khi", code: "TT 10/2021/TT-BTNMT – Điều 38", name: "Kiểm tra đặc tính kỹ thuật và độ chính xác tương đối (RA) – hệ thống quan trắc khí thải tự động, liên tục", version: "2021 · RA ≤ 20 %",
    doc_kind: "ra_report",
    legal: "Kiểm soát chất lượng trước khi vận hành chính thức và định kỳ 01 lần/năm bởi đơn vị độc lập (Khoản 6 Điều 38): kiểm tra lỗ quan trắc, ống hút mẫu (thép không gỉ, dài 1 m hoặc 30 % đường kính), ống dẫn mẫu bằng khí chuẩn (≥ 20 phút, sai khác ≤ 5 %), đơn vị mg/m3, truyền dữ liệu; quan trắc đối chứng theo Phụ lục 4.2 hoặc US EPA, ≥ 06 mẫu/thông số, cơ sở hoạt động ≥ 50 % công suất. RA ≤ 20 % (Phụ lục 12; với SO2, NO2, CO, H2S, NH3, Hg: RM̄ < 50 % giới hạn QCVN thì mẫu số là giới hạn QCVN). Biên bản theo Phụ lục 14.",
    note: null,
    template: { env_limits: {}, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra vị trí, ống hút mẫu, ống dẫn mẫu, tính năng", items: [
        { id: "c1", label: "Vị trí lỗ quan trắc đáp ứng Khoản 2 Điều 36" },
        { id: "c2", label: "Ống hút mẫu thép không gỉ, vuông góc thành ống khói, dài 1 m hoặc 30 % đường kính trong" },
        { id: "c3", label: "Kiểm tra ống dẫn mẫu bằng khí chuẩn ≥ 20 phút, sai khác ≤ 5 %" },
        { id: "c4", label: "Đo và trả kết quả theo mg/m3; nhiệt độ, áp suất, bụi, lưu lượng gắn trên thân ống khói" },
        { id: "c5", label: "Thu thập, lưu giữ, truyền dữ liệu; lưu trạng thái đang đo / hiệu chuẩn / báo lỗi" },
        { id: "c6", label: "Cơ sở hoạt động ≥ 50 % công suất thiết kế trong thời gian đối chứng" },
      ] },
      { id: "ra", kind: "ra", title: "Đánh giá độ chính xác tương đối (RA) – quan trắc đối chứng", unit: "mg/m3", decimals: 1, pairs: 9, limit_pct: 20, qcvn_sub: true },
    ] },
  }),
  proc({
    id: "pr-qt-ra-bui", code: "TT 10/2021/TT-BTNMT – Điều 38", name: "Kiểm tra độ chính xác tương đối (RA) – thiết bị đo bụi (PM) khí thải tự động, liên tục", version: "2021 · RA ≤ 20 %",
    doc_kind: "ra_report",
    legal: "Bụi (PM) khí thải không có quy trình ĐLVN và không kiểm tra bằng chất chuẩn (Điều 37 Khoản 2a); đánh giá bằng quan trắc đối chứng (lấy mẫu bụi đẳng động theo Phụ lục 4.2), ≥ 06 mẫu, RA ≤ 20 % (Phụ lục 12, không áp dụng thay mẫu số QCVN). Bảng 5: độ chính xác ± 10 % giá trị đọc hoặc ± 5 % khoảng đo, độ phân giải 0,1 mg/m3, thời gian đáp ứng ≤ 60 giây.",
    note: null,
    template: { env_limits: {}, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra lắp đặt và tính năng", items: [
        { id: "c1", label: "Thiết bị gắn trên thân ống khói, vị trí đáp ứng Khoản 2 Điều 36" },
        { id: "c2", label: "Độ phân giải 0,1 mg/m3; trả kết quả mg/m3; truyền dữ liệu" },
        { id: "c3", label: "Cơ sở hoạt động ≥ 50 % công suất thiết kế trong thời gian đối chứng" },
      ] },
      { id: "ra", kind: "ra", title: "Đánh giá độ chính xác tương đối (RA) – lấy mẫu bụi đối chứng", unit: "mg/m3", decimals: 1, pairs: 9, limit_pct: 20 },
    ] },
  }),
];

const it = (id: string, code: string, name: string, field_id: string, procedure_id: string, price: number, note: string | null, group2 = true): InstrumentType =>
  ({ id, code, name, field_id, group2, cycle_months: 12, procedure_id, default_price: price, active: true, note, created_at: T0 });

export const INSTRUMENT_TYPES_QT: InstrumentType[] = [
  it("it-qt-ph", "QT-PH", "PTĐ pH – trạm quan trắc nước", "f-qtn", "pr-qt-ph", 1200000, "ĐLVN 381:2021"),
  it("it-qt-tds", "QT-TDS", "PTĐ TDS – trạm quan trắc nước", "f-qtn", "pr-qt-tds", 1500000, "ĐLVN 382:2021"),
  it("it-qt-ec", "QT-EC", "PTĐ độ dẫn điện – trạm quan trắc nước", "f-qtn", "pr-qt-ec", 1200000, "ĐLVN 383:2021"),
  it("it-qt-turb", "QT-DUC", "PTĐ độ đục – trạm quan trắc nước", "f-qtn", "pr-qt-turb", 1500000, "ĐLVN 384:2021"),
  it("it-qt-do", "QT-DO", "PTĐ oxy hòa tan (DO) – trạm quan trắc nước", "f-qtn", "pr-qt-do", 1500000, "ĐLVN 385:2021"),
  it("it-qt-nh4", "QT-NH4", "PTĐ amoni – trạm quan trắc nước", "f-qtn", "pr-qt-nh4", 2500000, "ĐLVN 386:2021"),
  it("it-qt-cod", "QT-COD", "PTĐ COD – trạm quan trắc nước", "f-qtn", "pr-qt-cod", 2500000, "ĐLVN 387:2021"),
  it("it-qt-tss", "QT-TSS", "PTĐ TSS – trạm quan trắc nước", "f-qtn", "pr-qt-tss", 2000000, "ĐLVN 388:2021"),
  it("it-qt-gas", "QT-KHI", "PTĐ nồng độ khí (CO, SO2, NOx…) – trạm quan trắc khí thải", "f-qtk", "pr-qt-gas", 3500000, "ĐLVN 380:2021 – mỗi kênh khí"),
  it("it-qt-o2", "QT-O2", "PTĐ O2 / CO2 – trạm quan trắc khí thải", "f-qtk", "pr-qt-o2", 2500000, "ĐLVN 380:2021"),
  it("it-qt-amb", "QT-KXQ", "PTĐ nồng độ khí – trạm quan trắc không khí xung quanh", "f-qtk", "pr-qt-amb", 4500000, "ĐLVN 389:2021 – mỗi kênh khí"),
  it("it-qt-dust", "QT-BUI", "PTĐ hàm lượng bụi tổng trong không khí", "f-qtk", "pr-qt-dust", 3000000, "ĐLVN 90:2017"),
  it("it-qt-ra-nuoc", "RA-NUOC", "Kênh đo trạm nước thải – kiểm tra RA (pH, COD, NH4+, TP, TN, TOC, độ màu)", "f-qtn", "pr-qt-ra-nuoc", 4000000, "TT 10/2021 – 1 lần/năm, không cấp tem", false),
  it("it-qt-ra-nuoc30", "RA-NUOC30", "Kênh đo trạm nước thải – kiểm tra RA (TSS, Clo dư)", "f-qtn", "pr-qt-ra-nuoc30", 4000000, "TT 10/2021 – 1 lần/năm, không cấp tem", false),
  it("it-qt-ra-khi", "RA-KHI", "Kênh đo trạm khí thải – kiểm tra RA (SO2, NOx, CO, H2S, NH3…)", "f-qtk", "pr-qt-ra-khi", 6000000, "TT 10/2021 – 1 lần/năm, không cấp tem", false),
  it("it-qt-ra-bui", "RA-BUI", "Thiết bị đo bụi PM khí thải – kiểm tra RA", "f-qtk", "pr-qt-ra-bui", 8000000, "TT 10/2021 – 1 lần/năm, không cấp tem", false),
];

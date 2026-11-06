// =============================================================================
// DANH MỤC KỸ THUẬT MẶC ĐỊNH: lĩnh vực đo, loại phương tiện đo nhóm 2, quy trình
// kiểm định kèm mẫu biên bản. Chu kỳ và mã quy trình lấy theo TT 23/2013/TT-BKHCN
// (sửa đổi bởi TT 07/2019) và các ĐLVN – PHẢI ĐỐI CHIẾU LẠI với văn bản hiện hành
// trước khi dùng thật; mọi giá trị đều sửa được trong mục Danh mục.
// =============================================================================
import type { Field, InstrumentType, Procedure, Template, TemplatePoint } from "../types";
import { nowIso } from "../store/repo";

const t = nowIso();
const pts = (nominals: number[], mpe?: TemplatePoint["mpe"]): TemplatePoint[] => nominals.map((n, i) => ({ id: `p${i + 1}`, nominal: n, ...(mpe ? { mpe } : {}) }));

export const FIELDS: Field[] = [
  { id: "f-kl", code: "KL", name: "Khối lượng", active: true, created_at: t },
  { id: "f-as", code: "AS", name: "Áp suất", active: true, created_at: t },
  { id: "f-nd", code: "ND", name: "Nhiệt độ", active: true, created_at: t },
  { id: "f-dt", code: "DT", name: "Dung tích – lưu lượng", active: true, created_at: t },
  { id: "f-di", code: "DI", name: "Điện", active: true, created_at: t },
  { id: "f-dl", code: "DL", name: "Độ dài", active: true, created_at: t },
];

const CHECKLIST_KL = { id: "ck", kind: "checklist" as const, title: "Kiểm tra bên ngoài và kỹ thuật", items: [
  { id: "c1", label: "Nhãn mác đầy đủ: kiểu, số hiệu, Max, Min, e, d, cấp chính xác" },
  { id: "c2", label: "Bộ phận chỉ thị, bàn cân, cơ cấu cân bằng hoạt động bình thường" },
  { id: "c3", label: "Vị trí đặt cân chắc chắn, đã cân bằng (bọt thủy)" },
  { id: "c4", label: "Chức năng về 0 và trừ bì hoạt động đúng" },
] };

const scaleTemplate = (opts: { max: number; e: number; cls: "I" | "II" | "III" | "IIII"; unit: string; decimals: number; points: number[]; rep: number; ecc: number }): Template => ({
  env_limits: { temp: [10, 35], humidity: [30, 85] },
  sections: [
    CHECKLIST_KL,
    { id: "err", kind: "points", title: "Kiểm tra sai số các mức tải", unit: opts.unit, decimals: opts.decimals, readings: 1, directions: 2,
      mpe: { kind: "scale_oiml", e: opts.e, cls: opts.cls, in_service: true }, points: pts(opts.points) },
    { id: "rep", kind: "repeatability", title: "Kiểm tra độ lặp lại", unit: opts.unit, decimals: opts.decimals, nominal: opts.rep, readings: 6, limit: { kind: "scale_oiml", e: opts.e, cls: opts.cls, in_service: true } },
    { id: "ecc", kind: "eccentricity", title: "Kiểm tra độ lệch tâm", unit: opts.unit, decimals: opts.decimals, nominal: opts.ecc, positions: 5, mpe: { kind: "scale_oiml", e: opts.e, cls: opts.cls, in_service: true } },
  ],
});

export const PROCEDURES: Procedure[] = [
  { id: "pr-can-pt", code: "ĐLVN 16:2009", name: "Cân phân tích – Quy trình kiểm định", version: "2009", effective_from: "2009-01-01", status: "active", note: "Cân cấp I, Max 220 g, e = 1 mg (ví dụ – chỉnh theo từng cân)", created_at: t,
    template: scaleTemplate({ max: 220, e: 0.001, cls: "I", unit: "g", decimals: 4, points: [0.01, 0.1, 1, 10, 50, 100, 150, 200, 220], rep: 100, ecc: 70 }) },
  { id: "pr-can-kt", code: "ĐLVN 15:2009", name: "Cân kỹ thuật – Quy trình kiểm định", version: "2009", effective_from: "2009-01-01", status: "active", note: "Cân cấp II, Max 3 kg, e = 0,1 g (ví dụ)", created_at: t,
    template: scaleTemplate({ max: 3000, e: 0.1, cls: "II", unit: "g", decimals: 2, points: [1, 10, 100, 500, 1000, 2000, 3000], rep: 1000, ecc: 1000 }) },
  { id: "pr-can-ban", code: "ĐLVN 14:2009", name: "Cân bàn – Quy trình kiểm định", version: "2009", effective_from: "2009-01-01", status: "active", note: "Cân cấp III, Max 100 kg, e = 50 g (ví dụ)", created_at: t,
    template: scaleTemplate({ max: 100, e: 0.05, cls: "III", unit: "kg", decimals: 2, points: [1, 5, 10, 20, 50, 80, 100], rep: 50, ecc: 35 }) },
  { id: "pr-can-oto", code: "ĐLVN 13:2009", name: "Cân ô tô – Quy trình kiểm định", version: "2009", effective_from: "2009-01-01", status: "active", note: "Cân cấp III, Max 80 t, e = 20 kg (ví dụ)", created_at: t,
    template: scaleTemplate({ max: 80000, e: 20, cls: "III", unit: "kg", decimals: 0, points: [1000, 5000, 10000, 20000, 40000, 60000, 80000], rep: 40000, ecc: 20000 }) },
  { id: "pr-ap-ke", code: "ĐLVN 08:2011", name: "Áp kế lò xo và áp kế điện tử – Quy trình kiểm định", version: "2011", effective_from: "2011-01-01", status: "active", note: "Ví dụ áp kế 0–10 bar cấp 1,6", created_at: t,
    template: { env_limits: { temp: [15, 35], humidity: [30, 80] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài và kỹ thuật", items: [
        { id: "c1", label: "Mặt số, kim, thang đo rõ ràng; không nứt vỡ, không đọng hơi" },
        { id: "c2", label: "Ghi đơn vị đo, cấp chính xác, số hiệu" },
        { id: "c3", label: "Kim chỉ về vạch 0 (hoặc trong vùng cho phép)" },
      ] },
      { id: "err", kind: "points", title: "Kiểm tra sai số và độ trễ (tăng áp, giảm áp)", unit: "bar", decimals: 3, readings: 1, directions: 2, mpe: { kind: "pct_span", value: 1.6, span: 10 },
        points: pts([0, 2, 4, 6, 8, 10]) },
    ] } },
  { id: "pr-huyet-ap", code: "ĐLVN 09:2011", name: "Huyết áp kế – Quy trình kiểm định", version: "2011", effective_from: "2011-01-01", status: "active", note: "Sai số cho phép ± 3 mmHg (đối chiếu ĐLVN hiện hành)", created_at: t,
    template: { env_limits: { temp: [15, 30], humidity: [30, 85] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài và kỹ thuật", items: [
        { id: "c1", label: "Bao, ống dẫn, bóng bơm, van xả không rò rỉ" },
        { id: "c2", label: "Thang đo, kim chỉ (hoặc màn hình) rõ ràng" },
        { id: "c3", label: "Độ kín: áp suất giảm không quá 4 mmHg/phút tại 250 mmHg" },
      ] },
      { id: "err", kind: "points", title: "Kiểm tra sai số", unit: "mmHg", decimals: 0, readings: 1, directions: 2, mpe: { kind: "abs", value: 3 }, points: pts([0, 50, 100, 150, 200, 250]) },
    ] } },
  { id: "pr-nk-yh", code: "ĐLVN 94:2002", name: "Nhiệt kế y học điện tử – Quy trình kiểm định", version: "2002", effective_from: "2002-01-01", status: "active", note: "Sai số cho phép ± 0,1 °C trong dải 35,5–42 °C (đối chiếu)", created_at: t,
    template: { env_limits: { temp: [18, 28], humidity: [30, 80] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài", items: [{ id: "c1", label: "Đầu đo, vỏ nguyên vẹn; màn hình hiển thị đủ" }, { id: "c2", label: "Chức năng tự kiểm tra, pin đủ" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số trong bể ổn nhiệt", unit: "°C", decimals: 2, readings: 3, directions: 1, mpe: { kind: "abs", value: 0.1 }, points: pts([36, 37, 38, 39, 41]) },
    ] } },
  { id: "pr-dh-nuoc", code: "ĐLVN 17:2017", name: "Đồng hồ nước lạnh – Quy trình kiểm định", version: "2017", effective_from: "2017-07-01", status: "active", note: "Sai số cho phép ± 5 % (Q1 ≤ Q < Q2), ± 2 % (Q2 ≤ Q ≤ Q4), ví dụ đồng hồ DN15 Q3 = 2,5 m³/h", created_at: t,
    template: { env_limits: { temp: [5, 40] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài và kỹ thuật", items: [{ id: "c1", label: "Nhãn mác, số hiệu, Q3, R, cấp chính xác" }, { id: "c2", label: "Bộ đếm hoạt động, không rò rỉ ở áp suất làm việc" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số tại các lưu lượng (đơn vị: sai số %)", unit: "%", decimals: 2, readings: 1, directions: 1, mpe: { kind: "abs", value: 2 },
        points: [
          { id: "q1", label: "Q1 = 0,016 m³/h", nominal: 0, mpe: { kind: "abs", value: 5 } },
          { id: "q2", label: "Q2 = 0,025 m³/h", nominal: 0, mpe: { kind: "abs", value: 2 } },
          { id: "q3", label: "Q3 = 2,5 m³/h", nominal: 0, mpe: { kind: "abs", value: 2 } },
        ] },
    ] } },
  { id: "pr-cot-xang", code: "ĐLVN 10:2011", name: "Cột đo xăng dầu – Quy trình kiểm định", version: "2011", effective_from: "2011-01-01", status: "active", note: "Sai số cho phép ± 0,5 % (trong sử dụng); đo bằng bình chuẩn 20 L", created_at: t,
    template: { env_limits: {}, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài và kỹ thuật", items: [{ id: "c1", label: "Nhãn mác, chì niêm phong, bộ chỉ thị" }, { id: "c2", label: "Vòi bơm, ống dẫn không rò rỉ" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số (đơn vị: sai số %)", unit: "%", decimals: 2, readings: 3, directions: 1, mpe: { kind: "abs", value: 0.5 },
        points: [{ id: "qmin", label: "Lưu lượng nhỏ nhất", nominal: 0 }, { id: "qmax", label: "Lưu lượng lớn nhất", nominal: 0 }] },
    ] } },
  { id: "pr-cong-to-1p", code: "ĐLVN 07:2019", name: "Công tơ điện xoay chiều 1 pha – Quy trình kiểm định", version: "2019", effective_from: "2019-06-01", status: "active", note: "Cấp 2: sai số cho phép ± 2,0 % (đơn vị ghi là sai số %)", created_at: t,
    template: { env_limits: { temp: [18, 28] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài", items: [{ id: "c1", label: "Nhãn, kiểu, số, hằng số công tơ, cấp chính xác" }, { id: "c2", label: "Vỏ, kính, chì niêm phong nguyên vẹn" }, { id: "c3", label: "Bộ đếm hoạt động, không tự quay khi không tải" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số (đơn vị: sai số %)", unit: "%", decimals: 2, readings: 2, directions: 1, mpe: { kind: "abs", value: 2 },
        points: [{ id: "i1", label: "Imax, cosφ = 1", nominal: 0 }, { id: "i2", label: "Ib, cosφ = 1", nominal: 0 }, { id: "i3", label: "Ib, cosφ = 0,5L", nominal: 0, mpe: { kind: "abs", value: 2 } }, { id: "i4", label: "10 % Ib, cosφ = 1", nominal: 0, mpe: { kind: "abs", value: 2.5 } }] },
    ] } },
  { id: "pr-cong-to-3p", code: "ĐLVN 39:2019", name: "Công tơ điện xoay chiều 3 pha – Quy trình kiểm định", version: "2019", effective_from: "2019-06-01", status: "active", note: "Cấp 1: sai số cho phép ± 1,0 %", created_at: t,
    template: { env_limits: { temp: [18, 28] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài", items: [{ id: "c1", label: "Nhãn, kiểu, số, hằng số công tơ, cấp chính xác" }, { id: "c2", label: "Chì niêm phong nguyên vẹn" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số (đơn vị: sai số %)", unit: "%", decimals: 2, readings: 2, directions: 1, mpe: { kind: "abs", value: 1 },
        points: [{ id: "i1", label: "Imax, cosφ = 1", nominal: 0 }, { id: "i2", label: "Ib, cosφ = 1", nominal: 0 }, { id: "i3", label: "Ib, cosφ = 0,5L", nominal: 0 }, { id: "i4", label: "5 % Ib, cosφ = 1", nominal: 0, mpe: { kind: "abs", value: 1.5 } }] },
    ] } },
  { id: "pr-thuoc-cuon", code: "ĐLVN 05:2011", name: "Thước cuộn – Quy trình kiểm định", version: "2011", effective_from: "2011-01-01", status: "active", note: "Cấp II: sai số cho phép ± (0,3 + 0,2·L) mm, L tính bằng m", created_at: t,
    template: { env_limits: { temp: [15, 25] }, sections: [
      { id: "ck", kind: "checklist", title: "Kiểm tra bên ngoài", items: [{ id: "c1", label: "Vạch chia rõ, không mờ, không gãy, móc đầu thước chắc chắn" }] },
      { id: "err", kind: "points", title: "Kiểm tra sai số so với thước chuẩn", unit: "mm", decimals: 2, readings: 1, directions: 1, mpe: { kind: "abs", value: 0.5 },
        points: [
          { id: "p1", label: "1 m", nominal: 1000, mpe: { kind: "abs", value: 0.5 } },
          { id: "p2", label: "2 m", nominal: 2000, mpe: { kind: "abs", value: 0.7 } },
          { id: "p3", label: "3 m", nominal: 3000, mpe: { kind: "abs", value: 0.9 } },
          { id: "p4", label: "5 m", nominal: 5000, mpe: { kind: "abs", value: 1.3 } },
        ] },
    ] } },
];

export const INSTRUMENT_TYPES: InstrumentType[] = [
  { id: "it-can-pt", code: "CAN-PT", name: "Cân phân tích", field_id: "f-kl", group2: true, cycle_months: 12, procedure_id: "pr-can-pt", default_price: 600000, active: true, note: null, created_at: t },
  { id: "it-can-kt", code: "CAN-KT", name: "Cân kỹ thuật", field_id: "f-kl", group2: true, cycle_months: 12, procedure_id: "pr-can-kt", default_price: 450000, active: true, note: null, created_at: t },
  { id: "it-can-ban", code: "CAN-BAN", name: "Cân bàn", field_id: "f-kl", group2: true, cycle_months: 12, procedure_id: "pr-can-ban", default_price: 350000, active: true, note: null, created_at: t },
  { id: "it-can-oto", code: "CAN-OTO", name: "Cân ô tô", field_id: "f-kl", group2: true, cycle_months: 12, procedure_id: "pr-can-oto", default_price: 4500000, active: true, note: "Kiểm định tại hiện trường, cần xe tải chuẩn", created_at: t },
  { id: "it-ap-ke", code: "AP-KE", name: "Áp kế lò xo", field_id: "f-as", group2: true, cycle_months: 12, procedure_id: "pr-ap-ke", default_price: 250000, active: true, note: null, created_at: t },
  { id: "it-huyet-ap", code: "HA-KE", name: "Huyết áp kế", field_id: "f-as", group2: true, cycle_months: 12, procedure_id: "pr-huyet-ap", default_price: 150000, active: true, note: null, created_at: t },
  { id: "it-nk-yh", code: "NK-YH", name: "Nhiệt kế y học điện tử", field_id: "f-nd", group2: true, cycle_months: 12, procedure_id: "pr-nk-yh", default_price: 120000, active: true, note: null, created_at: t },
  { id: "it-dh-nuoc", code: "DH-NUOC", name: "Đồng hồ nước lạnh", field_id: "f-dt", group2: true, cycle_months: 60, procedure_id: "pr-dh-nuoc", default_price: 90000, active: true, note: "Cơ khí 60 tháng, điện tử 36 tháng (đối chiếu)", created_at: t },
  { id: "it-cot-xang", code: "COT-XD", name: "Cột đo xăng dầu", field_id: "f-dt", group2: true, cycle_months: 12, procedure_id: "pr-cot-xang", default_price: 1200000, active: true, note: "Tại hiện trường", created_at: t },
  { id: "it-cong-to-1p", code: "CT-1P", name: "Công tơ điện 1 pha", field_id: "f-di", group2: true, cycle_months: 60, procedure_id: "pr-cong-to-1p", default_price: 60000, active: true, note: null, created_at: t },
  { id: "it-cong-to-3p", code: "CT-3P", name: "Công tơ điện 3 pha", field_id: "f-di", group2: true, cycle_months: 36, procedure_id: "pr-cong-to-3p", default_price: 180000, active: true, note: null, created_at: t },
  { id: "it-thuoc-cuon", code: "THUOC-C", name: "Thước cuộn", field_id: "f-dl", group2: true, cycle_months: 24, procedure_id: "pr-thuoc-cuon", default_price: 80000, active: true, note: null, created_at: t },
];

export const DEFAULT_SETTINGS = {
  id: "1" as const,
  company: {
    name: "Công ty TNHH Kiểm định Đo lường Việt", short_name: "KĐ Việt", address: "Số 12 Nguyễn Văn Cừ, Long Biên, Hà Nội", phone: "024 3873 0000",
    email: "info@kdviet.vn", tax_code: "0101234567", designation_no: "1234/QĐ-TĐC", designation_date: "2024-03-15", lab_code: "KĐV", director_name: "Nguyễn Văn An",
  },
  numbering: { certificate_pattern: "{SEQ:5}/{YY}/KĐ-{BR}", reset: "year" as const },
  reminders: { due_days: [30, 15, 7], standard_due_days: 45, card_due_days: 60 },
  review: { checklist: [
    "Chuẩn sử dụng đúng lĩnh vực, còn hạn hiệu chuẩn",
    "Điều kiện môi trường trong giới hạn quy trình",
    "Số liệu đầy đủ, hợp lý, không tẩy xoá",
    "Kết luận phù hợp với sai số cho phép",
    "Thông tin khách hàng, thiết bị khớp phiếu tiếp nhận",
  ] },
  updated_at: t,
};

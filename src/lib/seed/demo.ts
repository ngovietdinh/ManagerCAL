// =============================================================================
// DỮ LIỆU DEMO – một công ty kiểm định giả định với đơn hàng ở đủ trạng thái.
// Chạy qua lớp nghiệp vụ (Services) để có lịch sử, nhật ký, thông báo thật.
// Tên người, công ty đều hư cấu.
// =============================================================================
import { dayjs } from "../format";
import { mpeAt } from "../calc";
import type { Authorization, Branch, Customer, Device, JobKind, Readings, Standard, Template, User } from "../types";
import { Services } from "../services";
import type { Repo } from "../store/repo";
import { newId, nowIso } from "../store/repo";
import { DEFAULT_SETTINGS, FIELDS, INSTRUMENT_TYPES, PROCEDURES } from "./catalog";

const t = nowIso();
const d = (daysFromNow: number) => dayjs().add(daysFromNow, "day").format("YYYY-MM-DD");

export const DEMO_BRANCHES: Branch[] = [
  { id: "br-hn", code: "HN", name: "Trụ sở Hà Nội", address: "Số 12 Nguyễn Văn Cừ, Long Biên, Hà Nội", active: true, created_at: t },
  { id: "br-hcm", code: "HCM", name: "Chi nhánh TP. Hồ Chí Minh", address: "45 Lê Văn Việt, TP. Thủ Đức, TP. HCM", active: true, created_at: t },
];

export const DEMO_USERS: User[] = [
  { id: "u-an", code: "NV01", full_name: "Nguyễn Văn An", email: "an@kdviet.vn", phone: "0901 000 001", roles: ["admin", "director", "signer"], branch_id: "br-hn", title: "Giám đốc", inspector_card_no: "KĐV-0101", inspector_card_expiry: d(700), active: true, created_at: t },
  { id: "u-binh", code: "NV02", full_name: "Trần Thị Bình", email: "binh@kdviet.vn", phone: "0901 000 002", roles: ["technician"], branch_id: "br-hn", title: "Kiểm định viên", inspector_card_no: "KĐV-0215", inspector_card_expiry: d(400), active: true, created_at: t },
  { id: "u-cuong", code: "NV03", full_name: "Lê Minh Cường", email: "cuong@kdviet.vn", phone: "0901 000 003", roles: ["technician", "reviewer"], branch_id: "br-hn", title: "Kiểm định viên chính", inspector_card_no: "KĐV-0188", inspector_card_expiry: d(45), active: true, created_at: t },
  { id: "u-dung", code: "NV04", full_name: "Phạm Thu Dung", email: "dung@kdviet.vn", phone: "0901 000 004", roles: ["reviewer", "signer", "qa"], branch_id: "br-hn", title: "Trưởng phòng Kỹ thuật", inspector_card_no: "KĐV-0150", inspector_card_expiry: d(900), active: true, created_at: t },
  { id: "u-em", code: "NV05", full_name: "Hoàng Văn Em", email: "em@kdviet.vn", phone: "0901 000 005", roles: ["intake", "sales"], branch_id: "br-hn", title: "Nhân viên tiếp nhận", inspector_card_no: null, inspector_card_expiry: null, active: true, created_at: t },
  { id: "u-giang", code: "NV06", full_name: "Vũ Thị Giang", email: "giang@kdviet.vn", phone: "0901 000 006", roles: ["accountant"], branch_id: "br-hn", title: "Kế toán", inspector_card_no: null, inspector_card_expiry: null, active: true, created_at: t },
  { id: "u-hung", code: "NV07", full_name: "Đỗ Văn Hùng", email: "hung@kdviet.vn", phone: "0901 000 007", roles: ["technician"], branch_id: "br-hcm", title: "Kiểm định viên", inspector_card_no: "KĐV-0302", inspector_card_expiry: d(300), active: true, created_at: t },
];

const auth = (user_id: string, fields: string[], roles: Authorization["role"][]): Authorization[] =>
  fields.flatMap((field_id) => roles.map((role) => ({ id: newId(), user_id, field_id, role, decision_no: "15/QĐ-KĐV", valid_from: "2025-01-01", valid_to: null, created_at: t })));

export const DEMO_AUTHS: Authorization[] = [
  ...auth("u-an", ["f-kl", "f-as", "f-nd", "f-dt", "f-di", "f-dl"], ["sign", "review"]),
  ...auth("u-binh", ["f-kl", "f-as", "f-nd"], ["perform"]),
  ...auth("u-cuong", ["f-kl", "f-di", "f-dt", "f-dl"], ["perform", "review"]),
  ...auth("u-dung", ["f-kl", "f-as", "f-nd", "f-dt", "f-di", "f-dl"], ["review", "sign"]),
  ...auth("u-hung", ["f-kl", "f-as", "f-dt"], ["perform"]),
];

export const DEMO_STANDARDS: Standard[] = [
  { id: "s-qc-e2", code: "CH-KL-01", name: "Bộ quả cân chuẩn cấp E2 (1 mg – 200 g)", field_id: "f-kl", manufacturer: "Häfner", model: "E2 set", serial: "E2-4471", range_text: "1 mg – 200 g", accuracy_text: "Cấp E2 (OIML R111)", cal_cert_no: "V01.CN.0231.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-200), cal_due: d(165), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-qc-f1", code: "CH-KL-02", name: "Bộ quả cân chuẩn cấp F1 (1 g – 5 kg)", field_id: "f-kl", manufacturer: "Häfner", model: "F1 set", serial: "F1-8812", range_text: "1 g – 5 kg", accuracy_text: "Cấp F1", cal_cert_no: "V01.CN.0232.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-300), cal_due: d(65), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-qc-m1", code: "CH-KL-03", name: "Quả cân chuẩn M1 20 kg × 50", field_id: "f-kl", manufacturer: "Việt Nam", model: "M1-20", serial: "Lô 2023", range_text: "20 kg – 1000 kg", accuracy_text: "Cấp M1", cal_cert_no: "V01.CN.1180.24", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-500), cal_due: d(-20), status: "ok", branch_id: "br-hn", note: "Quá hạn – sẽ tự khoá", created_at: t },
  { id: "s-qc-m1b", code: "CH-KL-04", name: "Quả cân chuẩn M1 20 kg × 60 (xe tải chuẩn)", field_id: "f-kl", manufacturer: "Việt Nam", model: "M1-20", serial: "Lô 2024", range_text: "20 kg – 1200 kg", accuracy_text: "Cấp M1", cal_cert_no: "V01.CN.0410.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-100), cal_due: d(265), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-ap", code: "CH-AS-01", name: "Áp kế chuẩn số", field_id: "f-as", manufacturer: "Fluke", model: "700G08", serial: "3345021", range_text: "0 – 70 bar", accuracy_text: "0,05 % FS", cal_cert_no: "V02.CN.0877.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-150), cal_due: d(215), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-ha", code: "CH-AS-02", name: "Áp kế chuẩn đo huyết áp", field_id: "f-as", manufacturer: "Riester", model: "RBP-100", serial: "RB2210", range_text: "0 – 300 mmHg", accuracy_text: "± 0,5 mmHg", cal_cert_no: "V02.CN.0878.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-150), cal_due: d(215), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-nd", code: "CH-ND-01", name: "Nhiệt kế chuẩn Pt100 + bể ổn nhiệt", field_id: "f-nd", manufacturer: "Fluke", model: "1523 / 7102", serial: "B55121", range_text: "0 – 100 °C", accuracy_text: "± 0,01 °C", cal_cert_no: "V03.CN.0412.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-90), cal_due: d(275), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-dt", code: "CH-DT-01", name: "Bình chuẩn dung tích 20 L hạng 2", field_id: "f-dt", manufacturer: "Việt Nam", model: "BC-20", serial: "BC20-017", range_text: "20 L", accuracy_text: "± 0,05 %", cal_cert_no: "V04.CN.0150.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-60), cal_due: d(305), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-dt2", code: "CH-DT-02", name: "Hệ thống kiểm định đồng hồ nước DN15–DN40", field_id: "f-dt", manufacturer: "Việt Nam", model: "KĐ-ĐHN-40", serial: "HT-01", range_text: "0,01 – 16 m³/h", accuracy_text: "± 0,2 %", cal_cert_no: "V04.CN.0151.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-60), cal_due: d(305), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-di", code: "CH-DI-01", name: "Bàn kiểm công tơ 1 pha 24 vị trí", field_id: "f-di", manufacturer: "MTE", model: "PTS 3.3", serial: "PTS-20198", range_text: "0,05 – 100 A", accuracy_text: "Cấp 0,05", cal_cert_no: "V05.CN.0290.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-120), cal_due: d(245), status: "ok", branch_id: "br-hn", note: null, created_at: t },
  { id: "s-dl", code: "CH-DL-01", name: "Thước chuẩn cấp I 5 m", field_id: "f-dl", manufacturer: "Stabila", model: "BM 50", serial: "DL-5-012", range_text: "0 – 5 m", accuracy_text: "Cấp I", cal_cert_no: "V06.CN.0071.25", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-200), cal_due: d(530), status: "ok", branch_id: "br-hn", note: null, created_at: t },
];

export const DEMO_CUSTOMERS: Customer[] = [
  { id: "c-1", code: "KH-0001", name: "Công ty CP Dược phẩm Thăng Long", tax_code: "0100112233", address: "Khu CN Quang Minh, Mê Linh, Hà Nội", phone: "024 3886 1234", email: "qa@duocthanglong.vn", contact_name: "Chị Lan (QA)", contact_phone: "0912 345 678", sales_user_id: "u-em", note: "Yêu cầu GCN song ngữ", active: true, created_at: t },
  { id: "c-2", code: "KH-0002", name: "Bệnh viện Đa khoa Gia Lâm", tax_code: "0100445566", address: "Trâu Quỳ, Gia Lâm, Hà Nội", phone: "024 3827 0000", email: "vattu@bvgialam.vn", contact_name: "Anh Tuấn (Vật tư)", contact_phone: "0987 654 321", sales_user_id: "u-em", note: null, active: true, created_at: t },
  { id: "c-3", code: "KH-0003", name: "Công ty TNHH Xăng dầu Hoàng Gia", tax_code: "0100778899", address: "Km 9 QL5, Sài Đồng, Long Biên, Hà Nội", phone: "024 3875 5555", email: "kythuat@xdhoanggia.vn", contact_name: "Anh Hải", contact_phone: "0903 111 222", sales_user_id: "u-em", note: "Kiểm định tại cửa hàng", active: true, created_at: t },
  { id: "c-4", code: "KH-0004", name: "Công ty CP Thép Hòa Phúc", tax_code: "0100990011", address: "KCN Phố Nối A, Văn Lâm, Hưng Yên", phone: "0221 3990 000", email: "kho@thephoaphuc.vn", contact_name: "Anh Minh (Kho)", contact_phone: "0978 222 333", sales_user_id: "u-em", note: "Cân ô tô 80 t, cần xe tải chuẩn", active: true, created_at: t },
  { id: "c-5", code: "KH-0005", name: "Công ty TNHH Nước sạch Sông Hồng", tax_code: "0101122334", address: "Ngõ 8 Láng Hạ, Đống Đa, Hà Nội", phone: "024 3776 0000", email: "dongho@nuocsonghong.vn", contact_name: "Chị Hương", contact_phone: "0945 333 444", sales_user_id: "u-em", note: "Lô đồng hồ nước hằng tháng", active: true, created_at: t },
  { id: "c-6", code: "KH-0006", name: "Điện lực Long Biên", tax_code: "0100101010", address: "Số 3 Ngọc Lâm, Long Biên, Hà Nội", phone: "024 3827 1111", email: "kd@evnlongbien.vn", contact_name: "Anh Phong", contact_phone: "0966 444 555", sales_user_id: null, note: null, active: true, created_at: t },
  { id: "c-7", code: "KH-0007", name: "Phòng khám Đa khoa An Sinh", tax_code: "0107654321", address: "88 Trần Duy Hưng, Cầu Giấy, Hà Nội", phone: "024 3555 0000", email: "pkansinh@gmail.com", contact_name: "BS. Hạnh", contact_phone: "0933 555 666", sales_user_id: "u-em", note: null, active: true, created_at: t },
  { id: "c-8", code: "KH-0008", name: "Công ty TNHH Cơ khí Tân Tiến", tax_code: "0108899001", address: "Lô C5 KCN Tân Bình, TP. HCM", phone: "028 3815 0000", email: "qc@cokhitantien.vn", contact_name: "Anh Lộc", contact_phone: "0909 777 888", sales_user_id: null, note: "Chi nhánh HCM phụ trách", active: true, created_at: t },
];

const dev = (id: string, customer_id: string, type: string, name: string, extra: Partial<Device>): Device => ({
  id, customer_id, instrument_type_id: type, name, manufacturer: null, model: null, serial: null, range_text: null, resolution_text: null, accuracy_class: null,
  location: null, customer_code: null, next_due: null, last_cert_id: null, last_result: null, status: "active", note: null, created_at: t, ...extra,
});

export const DEMO_DEVICES: Device[] = [
  dev("d-1", "c-1", "it-can-pt", "Cân phân tích", { manufacturer: "Sartorius", model: "BSA224S", serial: "0034512187", range_text: "0 – 220 g", resolution_text: "d = 0,1 mg; e = 1 mg", accuracy_class: "I", location: "Phòng QC", customer_code: "QC-CAN-01" }),
  dev("d-2", "c-1", "it-can-pt", "Cân phân tích", { manufacturer: "Ohaus", model: "PX224", serial: "B916342211", range_text: "0 – 220 g", resolution_text: "d = 0,1 mg; e = 1 mg", accuracy_class: "I", location: "Phòng QC", customer_code: "QC-CAN-02" }),
  dev("d-3", "c-1", "it-can-kt", "Cân kỹ thuật", { manufacturer: "Ohaus", model: "SPX2201", serial: "B928130077", range_text: "0 – 2200 g", resolution_text: "d = 0,1 g; e = 1 g", accuracy_class: "II", location: "Xưởng pha chế", customer_code: "SX-CAN-05" }),
  dev("d-4", "c-1", "it-ap-ke", "Áp kế lò xo", { manufacturer: "Wika", model: "233.50", serial: "AK-2023-114", range_text: "0 – 10 bar", accuracy_class: "1,6", location: "Nồi hơi số 1", customer_code: "NH-AK-01" }),
  dev("d-5", "c-1", "it-ap-ke", "Áp kế lò xo", { manufacturer: "Wika", model: "233.50", serial: "AK-2023-115", range_text: "0 – 10 bar", accuracy_class: "1,6", location: "Nồi hơi số 2", customer_code: "NH-AK-02" }),
  dev("d-6", "c-2", "it-huyet-ap", "Huyết áp kế đồng hồ", { manufacturer: "ALPK2", model: "500V", serial: "HA-00231", range_text: "0 – 300 mmHg", location: "Khoa Nội", customer_code: "KN-HA-01" }),
  dev("d-7", "c-2", "it-huyet-ap", "Huyết áp kế đồng hồ", { manufacturer: "ALPK2", model: "500V", serial: "HA-00232", range_text: "0 – 300 mmHg", location: "Khoa Nội", customer_code: "KN-HA-02" }),
  dev("d-8", "c-2", "it-huyet-ap", "Huyết áp kế điện tử", { manufacturer: "Omron", model: "HEM-7121", serial: "20230115123", range_text: "0 – 299 mmHg", location: "Khoa Sản", customer_code: "KS-HA-01" }),
  dev("d-9", "c-2", "it-nk-yh", "Nhiệt kế điện tử", { manufacturer: "Microlife", model: "MT-200", serial: "ML-88211", range_text: "32 – 42,9 °C", resolution_text: "0,1 °C", location: "Khoa Nhi", customer_code: "KNH-NK-01" }),
  dev("d-10", "c-2", "it-nk-yh", "Nhiệt kế điện tử", { manufacturer: "Microlife", model: "MT-200", serial: "ML-88212", range_text: "32 – 42,9 °C", resolution_text: "0,1 °C", location: "Khoa Nhi", customer_code: "KNH-NK-02" }),
  dev("d-11", "c-2", "it-can-ban", "Cân sức khoẻ", { manufacturer: "Nhơn Hoà", model: "NHHS-120", serial: "NH-120-5567", range_text: "0 – 120 kg", resolution_text: "e = 100 g", accuracy_class: "III", location: "Khoa Khám bệnh" }),
  dev("d-12", "c-3", "it-cot-xang", "Cột đo xăng dầu", { manufacturer: "Tatsuno", model: "SUNNY-X", serial: "TS-45120", range_text: "5 – 50 L/phút", location: "CHXD số 1, vòi 1", customer_code: "CH1-V1" }),
  dev("d-13", "c-3", "it-cot-xang", "Cột đo xăng dầu", { manufacturer: "Tatsuno", model: "SUNNY-X", serial: "TS-45121", range_text: "5 – 50 L/phút", location: "CHXD số 1, vòi 2", customer_code: "CH1-V2" }),
  dev("d-14", "c-3", "it-cot-xang", "Cột đo xăng dầu", { manufacturer: "Tatsuno", model: "SUNNY-X", serial: "TS-45122", range_text: "5 – 50 L/phút", location: "CHXD số 1, vòi 3", customer_code: "CH1-V3" }),
  dev("d-15", "c-3", "it-cot-xang", "Cột đo xăng dầu", { manufacturer: "Gilbarco", model: "SK700-II", serial: "GB-77301", range_text: "5 – 50 L/phút", location: "CHXD số 2, vòi 1", customer_code: "CH2-V1" }),
  dev("d-16", "c-4", "it-can-oto", "Cân ô tô điện tử 80 t", { manufacturer: "Mettler Toledo", model: "VTS", serial: "VTS-80-2019-03", range_text: "0 – 80 t", resolution_text: "e = 20 kg", accuracy_class: "III", location: "Cổng kho nguyên liệu", customer_code: "CAN-80T" }),
  dev("d-17", "c-4", "it-can-ban", "Cân bàn điện tử", { manufacturer: "Cas", model: "DB-II 150", serial: "DB150-0192", range_text: "0 – 150 kg", resolution_text: "e = 50 g", accuracy_class: "III", location: "Kho thành phẩm" }),
  dev("d-18", "c-4", "it-ap-ke", "Áp kế lò xo", { manufacturer: "Yamamoto", model: "YM-100", serial: "YM-5541", range_text: "0 – 16 bar", accuracy_class: "1,6", location: "Máy nén khí" }),
  ...Array.from({ length: 6 }, (_, i) => dev(`d-n${i + 1}`, "c-5", "it-dh-nuoc", "Đồng hồ nước lạnh DN15", { manufacturer: "Asahi", model: "GMK", serial: `AS22-${10450 + i}`, range_text: "Q3 = 2,5 m³/h", accuracy_class: "2", location: `Khu dân cư Bắc Linh Đàm, số ${20 + i}` })),
  ...Array.from({ length: 5 }, (_, i) => dev(`d-e${i + 1}`, "c-6", "it-cong-to-1p", "Công tơ điện 1 pha", { manufacturer: "Gelex EMIC", model: "CV140", serial: `21${300000 + i * 7}`, range_text: "5(20) A, 220 V", accuracy_class: "2", location: "Tổ 5 Ngọc Lâm" })),
  dev("d-e6", "c-6", "it-cong-to-3p", "Công tơ điện 3 pha", { manufacturer: "Gelex EMIC", model: "MV3E4", serial: "20MV3E-77120", range_text: "3×10(100) A, 3×220/380 V", accuracy_class: "1", location: "Trạm Sài Đồng 2" }),
  dev("d-19", "c-7", "it-huyet-ap", "Huyết áp kế thuỷ ngân", { manufacturer: "Yamasu", model: "605P", serial: "YS-10022", range_text: "0 – 300 mmHg", location: "Phòng khám 1" }),
  dev("d-20", "c-7", "it-nk-yh", "Nhiệt kế điện tử", { manufacturer: "Omron", model: "MC-246", serial: "OM-4451", range_text: "32 – 42 °C", location: "Phòng khám 1" }),
  dev("d-21", "c-7", "it-can-ban", "Cân sức khoẻ điện tử", { manufacturer: "Tanita", model: "HD-382", serial: "TN-20931", range_text: "0 – 150 kg", resolution_text: "e = 100 g", accuracy_class: "III", location: "Phòng khám 1" }),
  dev("d-22", "c-8", "it-can-ban", "Cân bàn điện tử", { manufacturer: "Cas", model: "DB-II 300", serial: "DB300-1120", range_text: "0 – 300 kg", resolution_text: "e = 100 g", accuracy_class: "III", location: "Xưởng A" }),
  dev("d-23", "c-8", "it-thuoc-cuon", "Thước cuộn 5 m", { manufacturer: "Stanley", model: "30-497", serial: "ST-001", range_text: "0 – 5 m", accuracy_class: "II", location: "Phòng QC" }),
  dev("d-24", "c-8", "it-thuoc-cuon", "Thước cuộn 5 m", { manufacturer: "Stanley", model: "30-497", serial: "ST-002", range_text: "0 – 5 m", accuracy_class: "II", location: "Phòng QC" }),
  dev("d-25", "c-8", "it-ap-ke", "Áp kế lò xo", { manufacturer: "Wika", model: "111.10", serial: "WK-990011", range_text: "0 – 10 bar", accuracy_class: "2,5", location: "Máy ép thuỷ lực" }),
];

// ---------------------------------------------------------------------------
// Sinh số đọc giả lập cho mẫu biên bản: đạt (trong MPE) hoặc không đạt (vượt MPE ở một điểm)
// ---------------------------------------------------------------------------
let seedRand = 42;
const rnd = () => { seedRand = (seedRand * 1103515245 + 12345) % 2147483648; return seedRand / 2147483648; };
const jitter = (nominal: number, mpe: number, decimals: number, factor = 0.45) => {
  // factor > 1: cố ý vượt sai số cho phép (số liệu không đạt)
  const v = factor > 1 ? nominal + mpe * factor : nominal + (rnd() * 2 - 1) * mpe * factor;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

export function genReadings(template: Template, fail = false): Readings {
  const out: Readings = {};
  let failed = !fail;
  for (const s of template.sections) {
    if (s.kind === "checklist") { out[s.id] = Object.fromEntries(s.items.map((i) => [i.id, true])); continue; }
    const r: Record<string, (number | null)[]> = {};
    if (s.kind === "points") {
      s.points.forEach((p, idx) => {
        const mpe = mpeAt(p.mpe ?? s.mpe, p.nominal);
        const bad = !failed && idx === s.points.length - 1;
        if (bad) failed = true;
        r[p.id] = Array.from({ length: s.readings }, () => jitter(p.nominal, mpe, s.decimals, bad ? 1.6 : 0.45));
        if (s.directions === 2) r[p.id + ":down"] = Array.from({ length: s.readings }, () => jitter(p.nominal, mpe, s.decimals, bad ? 1.6 : 0.45));
      });
    } else if (s.kind === "repeatability") {
      const mpe = mpeAt(s.limit, s.nominal);
      r.r = Array.from({ length: s.readings }, () => jitter(s.nominal, mpe, s.decimals, 0.3));
    } else {
      const mpe = mpeAt(s.mpe, s.nominal);
      for (let i = 1; i <= s.positions; i++) r[`p${i}`] = [jitter(s.nominal, mpe, s.decimals)];
    }
    out[s.id] = r;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nạp toàn bộ demo
// ---------------------------------------------------------------------------
export async function seedDemo(repo: Repo): Promise<void> {
  let current: User | null = null;
  const svc = new Services(repo, () => current);
  const as = (id: string) => { current = DEMO_USERS.find((u) => u.id === id)!; };

  await repo.insert("settings", DEFAULT_SETTINGS);
  for (const r of DEMO_BRANCHES) await repo.insert("branches", r);
  for (const r of DEMO_USERS) await repo.insert("users", r);
  for (const r of FIELDS) await repo.insert("fields", r);
  for (const r of PROCEDURES) await repo.insert("procedures", r);
  for (const r of INSTRUMENT_TYPES) await repo.insert("instrument_types", r);
  for (const r of DEMO_AUTHS) await repo.insert("authorizations", r);
  for (const r of DEMO_STANDARDS) await repo.insert("standards", r);
  for (const r of DEMO_CUSTOMERS) await repo.insert("customers", r);
  for (const r of DEMO_DEVICES) await repo.insert("devices", r);

  // Tem: 1 lô đã nhận, cấp một phần cho người ký
  as("u-dung");
  await svc.createSealBatch({ prefix: "KĐV-", from_no: 1, to_no: 500, received_at: d(-60), note: "Lô tem năm nay, nhận từ Tổng cục", width: 6 });
  const seals = await repo.list("seals", { orderBy: { field: "seq" }, limit: 100 });
  await svc.assignSeals(seals.slice(0, 50).map((s) => s.id), "u-an");
  await svc.assignSeals(seals.slice(50, 100).map((s) => s.id), "u-dung");

  const procById = Object.fromEntries(PROCEDURES.map((p) => [p.id, p]));
  const typeById = Object.fromEntries(INSTRUMENT_TYPES.map((x) => [x.id, x]));
  const stdFor: Record<string, string[]> = { "f-kl": ["s-qc-e2", "s-qc-f1"], "f-as": ["s-ap"], "f-nd": ["s-nd"], "f-dt": ["s-dt2"], "f-di": ["s-di"], "f-dl": ["s-dl"] };
  const techFor: Record<string, string> = { "f-kl": "u-binh", "f-as": "u-binh", "f-nd": "u-binh", "f-dt": "u-cuong", "f-di": "u-cuong", "f-dl": "u-cuong" };
  const intake = { condition: "Hoạt động bình thường, vỏ ngoài nguyên vẹn", accessories: "Dây nguồn, hộp đựng", note: "" };

  async function order(customer_id: string, deviceIds: string[], received: number, expected: number, onsite = false, prices?: Record<string, number>) {
    as("u-em");
    const items = deviceIds.map((id) => {
      const dv = DEMO_DEVICES.find((x) => x.id === id)!;
      return { device_id: id, kind: "periodic" as JobKind, price: prices?.[id] ?? typeById[dv.instrument_type_id].default_price, priority: "normal" as const, intake };
    });
    const { order, jobs } = await svc.createOrder({ customer_id, branch_id: "br-hn", received_at: d(received), expected_at: d(expected), onsite, contact_name: DEMO_CUSTOMERS.find((c) => c.id === customer_id)!.contact_name, contact_phone: null, note: null, items });
    return { order, jobs };
  }
  async function perform(jobId: string, fail = false, date = d(-1)) {
    const job = (await repo.get("jobs", jobId))!;
    const type = typeById[job.instrument_type_id];
    const proc = procById[type.procedure_id!];
    const tech = techFor[type.field_id];
    as("u-dung");
    await svc.assignJob(jobId, { assignee_id: tech, reviewer_id: null, due_date: job.due_date, priority: job.priority });
    as(tech);
    await svc.saveReadings(jobId, { env: { temp: 23.5, humidity: 58, pressure: 1012 }, readings: genReadings(proc.template, fail), standard_ids: stdFor[type.field_id].filter((s) => s !== "s-qc-m1"), performed_at: date, performed_note: null });
    await svc.submitForReview(jobId);
  }
  async function review(jobId: string, ok = true) {
    as("u-dung");
    const s = await svc.settings();
    await svc.reviewJob(jobId, { ok, note: ok ? null : "Số liệu điểm tải lớn nhất bất thường, đo lại", checks: Object.fromEntries(s.review.checklist.map((_, i) => [String(i), true])) });
  }
  async function issue(jobId: string, date = d(-1)) {
    as("u-an");
    const seal = await svc.nextSealFor("u-an");
    const job = (await repo.get("jobs", jobId))!;
    return svc.approveAndIssue(jobId, { issued_at: date, seal_no: seal?.number ?? null, place: DEMO_CUSTOMERS.find((c) => c.id === job.customer_id)!.address ?? "" });
  }

  // 1. Đơn đã hoàn thành tháng trước (Dược Thăng Long: 2 cân phân tích + 2 áp kế), trả khách
  {
    const { jobs } = await order("c-1", ["d-1", "d-2", "d-4", "d-5"], -40, -33);
    for (const j of jobs) { await perform(j.id, false, d(-36)); await review(j.id); await issue(j.id, d(-35)); as("u-em"); await svc.returnDevice(j.id, d(-34)); }
    as("u-giang");
    await svc.setOrderPaid(jobs[0].order_id, true, d(-30));
  }
  // 2. Bệnh viện Gia Lâm: 6 thiết bị, 1 huyết áp kế không đạt, phần còn lại ở các bước khác nhau
  {
    const { jobs } = await order("c-2", ["d-6", "d-7", "d-8", "d-9", "d-10", "d-11"], -6, 1);
    await perform(jobs[0].id, false, d(-4)); await review(jobs[0].id); await issue(jobs[0].id, d(-3));
    await perform(jobs[1].id, true, d(-4)); await review(jobs[1].id); await issue(jobs[1].id, d(-3)); // không đạt → thông báo
    await perform(jobs[2].id, false, d(-2)); await review(jobs[2].id);                                 // chờ phê duyệt
    await perform(jobs[3].id, false, d(-2));                                                           // chờ soát xét
    await perform(jobs[4].id, false, d(-1)); await review(jobs[4].id, false);                          // bị trả lại
    as("u-dung"); await svc.assignJob(jobs[5].id, { assignee_id: "u-binh", reviewer_id: "u-cuong", due_date: d(1), priority: "normal" }); // đã phân công
  }
  // 3. Xăng dầu Hoàng Gia: hiện trường, chờ phân công, gấp
  {
    const { jobs } = await order("c-3", ["d-12", "d-13", "d-14", "d-15"], -1, 3, true);
    as("u-dung");
    await svc.assignJob(jobs[0].id, { assignee_id: "u-cuong", reviewer_id: null, due_date: d(3), priority: "urgent" });
  }
  // 4. Thép Hòa Phúc: cân ô tô hiện trường – đã phát hành năm ngoái, sắp đến hạn (mô phỏng qua next_due)
  await repo.update("devices", "d-16", { next_due: d(12), last_result: "pass" });
  await repo.update("devices", "d-17", { next_due: d(-5), last_result: "pass" });
  await repo.update("devices", "d-18", { next_due: d(25), last_result: "pass" });
  // 5. Nước Sông Hồng: lô đồng hồ nước, 3 đã phát hành, 3 đang làm
  {
    const ids = DEMO_DEVICES.filter((x) => x.customer_id === "c-5").map((x) => x.id);
    const { jobs } = await order("c-5", ids, -3, 4);
    for (const j of jobs.slice(0, 3)) { await perform(j.id, false, d(-2)); await review(j.id); await issue(j.id, d(-1)); }
    for (const j of jobs.slice(3)) { as("u-dung"); await svc.assignJob(j.id, { assignee_id: "u-cuong", reviewer_id: null, due_date: d(4), priority: "normal" }); }
  }
  // 6. Điện lực Long Biên: công tơ, tất cả chờ phân công (đơn mới hôm nay)
  await order("c-6", DEMO_DEVICES.filter((x) => x.customer_id === "c-6").map((x) => x.id), 0, 7);
  // 7. Phòng khám An Sinh: quá hạn trả, đang thực hiện
  {
    const { jobs } = await order("c-7", ["d-19", "d-20", "d-21"], -10, -2);
    as("u-dung");
    for (const j of jobs) await svc.assignJob(j.id, { assignee_id: "u-binh", reviewer_id: null, due_date: d(-2), priority: "normal" });
    as("u-binh");
    const proc = procById["pr-huyet-ap"];
    const partial = genReadings(proc.template);
    (partial.err as Record<string, (number | null)[]>).p6 = [null];
    await svc.saveReadings(jobs[0].id, { env: { temp: 24, humidity: 60, pressure: null }, readings: partial, standard_ids: ["s-ha"], performed_at: d(0), performed_note: "Đang đo dở" });
  }
  // 8. Cơ khí Tân Tiến: thước cuộn + cân + áp kế ở HCM, đã phát hành, chưa thu tiền
  {
    const { jobs } = await order("c-8", ["d-22", "d-23", "d-24", "d-25"], -20, -14);
    for (const j of jobs) { await perform(j.id, false, d(-16)); await review(j.id); await issue(j.id, d(-15)); }
  }

  as("u-an");
  await svc.runDailyChecks();
}

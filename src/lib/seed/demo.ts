// =============================================================================
// DỮ LIỆU DEMO – một công ty kiểm định THIẾT BỊ QUAN TRẮC MÔI TRƯỜNG TỰ ĐỘNG (hư cấu),
// khách hàng là nhà máy, khu công nghiệp, bệnh viện, trung tâm quan trắc có trạm tự động, liên tục.
// Chạy qua lớp nghiệp vụ (Services) để có lịch sử, nhật ký, thông báo thật.
// Tên người, công ty, số sê-ri đều hư cấu.
// =============================================================================
import { dayjs } from "../format";
import { mpeAt } from "../calc";
import type { Authorization, Branch, Customer, Device, JobKind, Readings, Standard, Template, User } from "../types";
import { Services } from "../services";
import type { Repo } from "../store/repo";
import { nowIso } from "../store/repo";
import { DEFAULT_SETTINGS } from "./catalog";
import { FIELDS_QT, INSTRUMENT_TYPES_QT, PROCEDURES_QT } from "./monitoring";

/** Dữ liệu mẫu được dựng lúc gọi (không dựng khi nạp mã: Cloudflare Workers cấm sinh số ngẫu nhiên
 *  và đứng đồng hồ ở phạm vi toàn cục, nên ngày tháng phải tính tại thời điểm nạp). */
export function buildDemo() {
  const t = nowIso();
  const d = (daysFromNow: number) => dayjs().add(daysFromNow, "day").format("YYYY-MM-DD");

  const DEMO_COMPANY = {
    ...DEFAULT_SETTINGS.company,
    name: "Công ty TNHH Kiểm định Quan trắc Môi trường Việt", short_name: "KĐ QT Việt",
    address: "Số 12 Nguyễn Văn Cừ, Long Biên, Hà Nội", email: "info@kdqtviet.vn", lab_code: "KĐQT",
  };

  const DEMO_BRANCHES: Branch[] = [
    { id: "br-hn", code: "HN", name: "Trụ sở Hà Nội", address: "Số 12 Nguyễn Văn Cừ, Long Biên, Hà Nội", active: true, created_at: t },
    { id: "br-hcm", code: "HCM", name: "Chi nhánh TP. Hồ Chí Minh", address: "45 Lê Văn Việt, TP. Thủ Đức, TP. HCM", active: true, created_at: t },
  ];

  const u = (id: string, code: string, full_name: string, email: string, roles: User["roles"], title: string, card: string | null, cardDays: number | null, branch = "br-hn"): User => ({
    id, code, full_name, email, phone: null, roles, branch_id: branch, title, inspector_card_no: card,
    inspector_card_expiry: cardDays == null ? null : d(cardDays), active: true, created_at: t,
  });
  const DEMO_USERS: User[] = [
    u("u-an", "NV01", "Nguyễn Văn An", "an@kdqtviet.vn", ["admin", "director", "signer"], "Giám đốc", "KĐV-0101", 700),
    u("u-binh", "NV02", "Trần Thị Bình", "binh@kdqtviet.vn", ["technician"], "Kiểm định viên – quan trắc nước", "KĐV-0215", 400),
    u("u-cuong", "NV03", "Lê Minh Cường", "cuong@kdqtviet.vn", ["technician", "reviewer"], "Kiểm định viên chính", "KĐV-0188", 45),
    u("u-dung", "NV04", "Phạm Thu Dung", "dung@kdqtviet.vn", ["reviewer", "signer", "qa"], "Trưởng phòng Kỹ thuật", "KĐV-0150", 900),
    u("u-em", "NV05", "Hoàng Văn Em", "em@kdqtviet.vn", ["intake", "sales"], "Nhân viên kinh doanh, tiếp nhận", null, null),
    u("u-giang", "NV06", "Vũ Thị Giang", "giang@kdqtviet.vn", ["accountant"], "Kế toán", null, null),
    u("u-hung", "NV07", "Đỗ Văn Hùng", "hung@kdqtviet.vn", ["technician"], "Kiểm định viên – khí thải", "KĐV-0302", 300, "br-hcm"),
  ];

  const auth = (user_id: string, fields: string[], roles: Authorization["role"][]): Authorization[] =>
    fields.flatMap((field_id) => roles.map((role) => ({ id: `a-${user_id}-${field_id}-${role}`, user_id, field_id, role, decision_no: "15/QĐ-KĐQT", valid_from: "2025-01-01", valid_to: null, created_at: t })));
  const DEMO_AUTHS: Authorization[] = [
    ...auth("u-an", ["f-qtn", "f-qtk"], ["sign", "review"]),
    ...auth("u-binh", ["f-qtn"], ["perform"]),
    ...auth("u-cuong", ["f-qtn", "f-qtk"], ["perform"]),
    ...auth("u-cuong", ["f-qtn"], ["review"]),
    ...auth("u-dung", ["f-qtn", "f-qtk"], ["review", "sign"]),
    ...auth("u-hung", ["f-qtk"], ["perform"]),
  ];

  const std = (id: string, code: string, name: string, field_id: string, extra: Partial<Standard>): Standard => ({
    id, code, name, field_id, manufacturer: null, model: null, serial: null, range_text: null, accuracy_text: null, cal_cert_no: null, cal_by: null,
    cal_date: d(-60), cal_due: d(300), status: "ok", branch_id: "br-hn", note: null, created_at: t, ...extra,
  });
  const DEMO_STANDARDS: Standard[] = [
    std("s-ph", "CH-QTN-01", "Bộ dung dịch chuẩn pH 4,01 / 7,00 / 10,01 (CRM)", "f-qtn", { manufacturer: "Merck", model: "Certipur", serial: "Lô HC123456", range_text: "pH 4 – 10", accuracy_text: "± 0,02 pH", cal_cert_no: "CoA HC123456", cal_by: "Nhà sản xuất (ISO 17034)", note: "Chất chuẩn – theo hạn dùng" }),
    std("s-ph-cu", "CH-QTN-00", "Bộ dung dịch chuẩn pH lô cũ (CRM)", "f-qtn", { manufacturer: "Merck", model: "Certipur", serial: "Lô HC099887", range_text: "pH 4 – 10", accuracy_text: "± 0,02 pH", cal_cert_no: "CoA HC099887", cal_by: "Nhà sản xuất (ISO 17034)", cal_date: d(-400), cal_due: d(-10), note: "Hết hạn dùng – hệ thống tự khoá" }),
    std("s-cod", "CH-QTN-02", "Dung dịch chuẩn COD (KHP) 1000 mg/L (CRM)", "f-qtn", { manufacturer: "Hach", serial: "Lô A2210", range_text: "0 – 1000 mg/L", accuracy_text: "ĐKĐB ≤ 1,5 %", cal_cert_no: "CoA A2210", cal_by: "Nhà sản xuất (ISO 17034)", cal_due: d(140) }),
    std("s-tss", "CH-QTN-03", "Dung dịch chuẩn TSS / độ đục (formazin) (CRM)", "f-qtn", { manufacturer: "Hach", serial: "Lô F4410", range_text: "TSS 0 – 1000 mg/L; 0 – 4000 NTU", accuracy_text: "ĐKĐB ≤ 2 %", cal_cert_no: "CoA F4410", cal_by: "Nhà sản xuất (ISO 17034)" }),
    std("s-nh4", "CH-QTN-04", "Dung dịch chuẩn amoni 1000 mg/L N (CRM)", "f-qtn", { manufacturer: "Merck", serial: "Lô AM7781", range_text: "0 – 1000 mg/L", accuracy_text: "ĐKĐB ≤ 1,5 %", cal_cert_no: "CoA AM7781", cal_by: "Nhà sản xuất (ISO 17034)", cal_due: d(35) }),
    std("s-bath", "CH-QTN-05", "Bể ổn nhiệt và nhiệt kế chuẩn", "f-qtn", { manufacturer: "Julabo", model: "CORIO CD", serial: "JB-22015", range_text: "0 – 50 °C", accuracy_text: "Độ ổn định ± 0,03 °C", cal_cert_no: "V03.CN.0412.26", cal_by: "Viện Đo lường Việt Nam" }),
    std("s-gas", "CH-QTK-01", "Khí chuẩn SO2 / NO / CO trong N2", "f-qtk", { manufacturer: "Linde", model: "Bình 40 L", serial: "LG-77310", range_text: "SO2 800 ppm; NO 800 ppm; CO 800 ppm", accuracy_text: "± 2 % tương đối", cal_cert_no: "V02.KC.0311.26", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-90), cal_due: d(275) }),
    std("s-o2", "CH-QTK-02", "Khí chuẩn O2 / CO2 trong N2", "f-qtk", { manufacturer: "Linde", model: "Bình 40 L", serial: "LG-77311", range_text: "O2 20 %V; CO2 18 %V", accuracy_text: "± 1 % tương đối", cal_cert_no: "V02.KC.0312.26", cal_by: "Viện Đo lường Việt Nam" }),
    std("s-amb", "CH-QTK-03", "Khí chuẩn nồng độ thấp SO2 / NO2 / CO / O3 cho trạm không khí", "f-qtk", { manufacturer: "Air Liquide", serial: "AL-3301", range_text: "SO2, NO2 10 ppm; CO 100 ppm", accuracy_text: "± 2 % tương đối", cal_cert_no: "V02.KC.0320.26", cal_by: "Viện Đo lường Việt Nam" }),
    std("s-dil", "CH-QTK-04", "Hệ thống pha loãng khí chuẩn và tạo khí \u201ckhông\u201d", "f-qtk", { manufacturer: "Environics", model: "S-4040", serial: "EN-4040-118", range_text: "Tỉ lệ 1:1 – 1:1000", accuracy_text: "± 1 % giá trị đặt", cal_cert_no: "V02.CN.0950.26", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-120), cal_due: d(245) }),
    std("s-iso", "CH-QTK-05", "Bộ lấy mẫu khí thải, bụi đẳng động (quan trắc đối chứng RA)", "f-qtk", { manufacturer: "Apex", model: "XC-572", serial: "APX-5720-09", range_text: "Isokinetic", accuracy_text: "Theo US EPA Method 5", cal_cert_no: "V02.CN.0951.26", cal_by: "Viện Đo lường Việt Nam", cal_date: d(-120), cal_due: d(30) }),
    std("s-dust", "CH-QTK-06", "Chuẩn đo hàm lượng bụi tổng trong không khí", "f-qtk", { manufacturer: "TSI", model: "DustTrak 8533", serial: "TSI-85330-77", range_text: "0 – 150 mg/m3", accuracy_text: "Theo ĐLVN 294:2016", cal_cert_no: "V02.CN.0952.26", cal_by: "Viện Đo lường Việt Nam" }),
  ];

  const cus = (id: string, code: string, name: string, address: string, contact: string, note: string | null, extra: Partial<Customer> = {}): Customer => ({
    id, code, name, tax_code: null, address, phone: null, email: null, contact_name: contact, contact_phone: null, sales_user_id: "u-em", note, active: true, created_at: t, ...extra,
  });
  const DEMO_CUSTOMERS: Customer[] = [
    cus("c-1", "KH-0001", "Công ty CP Giấy và Bột Sông Lam", "KCN Nam Cấm, Nghi Lộc, Nghệ An", "Anh Toàn (Phòng Môi trường)", "Trạm nước thải + khí thải lò hơi, truyền dữ liệu về Sở", { tax_code: "2900334455" }),
    cus("c-2", "KH-0002", "Công ty CP Xi măng Đồng Lâm", "Xã Tân Hòa, huyện Đồng Lâm, Hòa Bình", "Chị Hương (Môi trường – An toàn)", "Khí thải lò nung clinker: bụi PM, SO2, NOx, CO, O2", { tax_code: "5400221133" }),
    cus("c-3", "KH-0003", "Công ty Hạ tầng KCN Tân Phú Thịnh", "KCN Tân Phú Thịnh, Văn Lâm, Hưng Yên", "Anh Phong (Trạm XLNT tập trung)", "Trạm XLNT tập trung 12.000 m3/ngày", { tax_code: "0901112233" }),
    cus("c-4", "KH-0004", "Bệnh viện Đa khoa Thành An", "Số 8 Lê Lợi, TP. Thành An", "Anh Minh (Phòng Vật tư)", "Trạm nước thải y tế"),
    cus("c-5", "KH-0005", "Trung tâm Quan trắc Môi trường tỉnh Thành An", "Số 2 Trần Phú, TP. Thành An", "Chị Lan (Phòng Quan trắc tự động)", "03 trạm không khí xung quanh", { sales_user_id: null }),
    cus("c-6", "KH-0006", "Công ty TNHH Dệt nhuộm Thành Công", "Lô C5 KCN Tân Bình, TP. Hồ Chí Minh", "Anh Lộc (Kỹ thuật)", "Nước thải dệt nhuộm + khí thải lò hơi; chi nhánh HCM phụ trách"),
  ];

  const dev = (id: string, customer_id: string, type: string, name: string, extra: Partial<Device>): Device => ({
    id, customer_id, instrument_type_id: type, name, manufacturer: null, model: null, serial: null, range_text: null, resolution_text: null, accuracy_class: null,
    location: null, customer_code: null, next_due: null, last_cert_id: null, last_result: null, status: "active", note: null, created_at: t, ...extra,
  });
  const W = (where: string) => ({ location: `Trạm QTTĐ nước thải – ${where}` });
  const DEMO_DEVICES: Device[] = [
    // c-1 Giấy Sông Lam
    dev("d-1-ph", "c-1", "it-qt-ph", "Đầu đo pH", { manufacturer: "Endress+Hauser", model: "CM442 / CPS11E", serial: "R5012345", range_text: "0 ÷ 14 pH", resolution_text: "0,01 pH", customer_code: "WW-PH", ...W("sau xử lý") }),
    dev("d-1-cod", "c-1", "it-qt-cod", "Thiết bị đo COD", { manufacturer: "Hach", model: "UVAS sc", serial: "COD-55102", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "WW-COD", ...W("sau xử lý") }),
    dev("d-1-tss", "c-1", "it-qt-tss", "Thiết bị đo TSS", { manufacturer: "Hach", model: "Solitax sc", serial: "TSS-22018", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "WW-TSS", ...W("sau xử lý") }),
    dev("d-1-nh4", "c-1", "it-qt-nh4", "Thiết bị đo amoni", { manufacturer: "Hach", model: "Amtax sc", serial: "NH4-55102", range_text: "0 ÷ 50 mg/L", resolution_text: "0,01 mg/L", customer_code: "WW-NH4", ...W("sau xử lý") }),
    dev("d-1-ra", "c-1", "it-qt-ra-nuoc", "Kênh COD – hệ thống QTTĐ nước thải", { manufacturer: "Hach", model: "UVAS sc", serial: "COD-55102", range_text: "0 ÷ 500 mg/L", customer_code: "WW-COD-RA", ...W("sau xử lý") }),
    dev("d-1-so2", "c-1", "it-qt-gas", "Bộ phân tích SO2", { manufacturer: "Sick", model: "GMS810", serial: "SK-81003", range_text: "0 ÷ 1000 ppm", resolution_text: "1 ppm", location: "Ống khói lò hơi số 1", customer_code: "ST-SO2", next_due: d(12), last_result: "pass" }),
    // c-2 Xi măng Đồng Lâm
    dev("d-2-so2", "c-2", "it-qt-gas", "Bộ phân tích SO2 – lò nung", { manufacturer: "Siemens", model: "Ultramat 23", serial: "SI-U23-1101", range_text: "0 ÷ 1000 ppm", resolution_text: "1 ppm", location: "Ống khói lò nung clinker", customer_code: "KN-SO2" }),
    dev("d-2-no", "c-2", "it-qt-gas", "Bộ phân tích NO – lò nung", { manufacturer: "Siemens", model: "Ultramat 23", serial: "SI-U23-1102", range_text: "0 ÷ 1000 ppm", resolution_text: "1 ppm", location: "Ống khói lò nung clinker", customer_code: "KN-NO" }),
    dev("d-2-co", "c-2", "it-qt-gas", "Bộ phân tích CO – lò nung", { manufacturer: "Siemens", model: "Ultramat 23", serial: "SI-U23-1103", range_text: "0 ÷ 1000 ppm", resolution_text: "1 ppm", location: "Ống khói lò nung clinker", customer_code: "KN-CO" }),
    dev("d-2-o2", "c-2", "it-qt-o2", "Bộ phân tích O2 – lò nung", { manufacturer: "Siemens", model: "Oxymat 6", serial: "SI-OX6-2201", range_text: "0 ÷ 25 %V", resolution_text: "0,1 %V", location: "Ống khói lò nung clinker", customer_code: "KN-O2" }),
    dev("d-2-pm", "c-2", "it-qt-ra-bui", "Thiết bị đo bụi PM – lò nung", { manufacturer: "Durag", model: "D-R 290", serial: "DR290-7781", range_text: "0 ÷ 200 mg/m3", location: "Ống khói lò nung clinker", customer_code: "KN-PM" }),
    dev("d-2-ra", "c-2", "it-qt-ra-khi", "Kênh SO2 – hệ thống QTTĐ khí thải lò nung", { manufacturer: "Siemens", model: "Ultramat 23", serial: "SI-U23-1101", range_text: "0 ÷ 2800 mg/m3", location: "Ống khói lò nung clinker", customer_code: "KN-SO2-RA" }),
    // c-3 KCN Tân Phú Thịnh
    dev("d-3-ph", "c-3", "it-qt-ph", "Đầu đo pH", { manufacturer: "WTW", model: "IQ SensorNet SensoLyt 700", serial: "WTW-70011", range_text: "0 ÷ 14 pH", resolution_text: "0,01 pH", customer_code: "TPT-PH", ...W("cửa xả KCN") }),
    dev("d-3-cod", "c-3", "it-qt-cod", "Thiết bị đo COD", { manufacturer: "Endress+Hauser", model: "Viomax CAS51D", serial: "EH-CAS51-3301", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "TPT-COD", ...W("cửa xả KCN") }),
    dev("d-3-tss", "c-3", "it-qt-tss", "Thiết bị đo TSS", { manufacturer: "Endress+Hauser", model: "Turbimax CUS51D", serial: "EH-CUS51-3302", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "TPT-TSS", ...W("cửa xả KCN") }),
    dev("d-3-nh4", "c-3", "it-qt-nh4", "Thiết bị đo amoni", { manufacturer: "Endress+Hauser", model: "CA80AM", serial: "EH-CA80-3303", range_text: "0 ÷ 50 mg/L", resolution_text: "0,01 mg/L", customer_code: "TPT-NH4", ...W("cửa xả KCN") }),
    dev("d-3-ra-cod", "c-3", "it-qt-ra-nuoc", "Kênh COD – hệ thống QTTĐ nước thải KCN", { manufacturer: "Endress+Hauser", model: "CAS51D", serial: "EH-CAS51-3301", range_text: "0 ÷ 500 mg/L", customer_code: "TPT-COD-RA", ...W("cửa xả KCN") }),
    dev("d-3-ra-tss", "c-3", "it-qt-ra-nuoc30", "Kênh TSS – hệ thống QTTĐ nước thải KCN", { manufacturer: "Endress+Hauser", model: "CUS51D", serial: "EH-CUS51-3302", range_text: "0 ÷ 500 mg/L", customer_code: "TPT-TSS-RA", ...W("cửa xả KCN") }),
    // c-4 Bệnh viện
    dev("d-4-ph", "c-4", "it-qt-ph", "Đầu đo pH", { manufacturer: "Hach", model: "pHD sc", serial: "HPH-44001", range_text: "0 ÷ 14 pH", resolution_text: "0,01 pH", customer_code: "BV-PH", ...W("bệnh viện") }),
    dev("d-4-cod", "c-4", "it-qt-cod", "Thiết bị đo COD", { manufacturer: "Hach", model: "UVAS sc", serial: "COD-44002", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "BV-COD", ...W("bệnh viện") }),
    dev("d-4-tss", "c-4", "it-qt-tss", "Thiết bị đo TSS", { manufacturer: "Hach", model: "Solitax sc", serial: "TSS-44003", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "BV-TSS", ...W("bệnh viện") }),
    // c-5 Trạm không khí xung quanh
    dev("d-5-so2", "c-5", "it-qt-amb", "Máy phân tích SO2 – trạm KK số 1", { manufacturer: "Teledyne API", model: "T100", serial: "TAPI-T100-5501", range_text: "0 ÷ 1 ppm", resolution_text: "0,001 ppm", location: "Trạm KK số 1 – Công viên trung tâm", customer_code: "KK1-SO2" }),
    dev("d-5-no2", "c-5", "it-qt-amb", "Máy phân tích NO2 – trạm KK số 1", { manufacturer: "Teledyne API", model: "T200", serial: "TAPI-T200-5502", range_text: "0 ÷ 1 ppm", resolution_text: "0,001 ppm", location: "Trạm KK số 1 – Công viên trung tâm", customer_code: "KK1-NO2" }),
    dev("d-5-co", "c-5", "it-qt-amb", "Máy phân tích CO – trạm KK số 1", { manufacturer: "Teledyne API", model: "T300", serial: "TAPI-T300-5503", range_text: "0 ÷ 1 ppm (dải thấp)", resolution_text: "0,001 ppm", location: "Trạm KK số 1 – Công viên trung tâm", customer_code: "KK1-CO" }),
    dev("d-5-dust", "c-5", "it-qt-dust", "Thiết bị đo bụi tổng – trạm KK số 1", { manufacturer: "Met One", model: "BAM-1020", serial: "MO-BAM-5504", range_text: "0 ÷ 200 mg/m3", resolution_text: "0,01 mg/m3", location: "Trạm KK số 1 – Công viên trung tâm", customer_code: "KK1-TSP" }),
    dev("d-5-so2b", "c-5", "it-qt-amb", "Máy phân tích SO2 – trạm KK số 2", { manufacturer: "Thermo", model: "43i", serial: "TH-43I-5511", range_text: "0 ÷ 1 ppm", resolution_text: "0,001 ppm", location: "Trạm KK số 2 – KCN phía Bắc", customer_code: "KK2-SO2", next_due: d(-4), last_result: "pass" }),
    dev("d-5-o3", "c-5", "it-qt-amb", "Máy phân tích O3 – trạm KK số 2", { manufacturer: "Thermo", model: "49i", serial: "TH-49I-5512", range_text: "0 ÷ 1 ppm", resolution_text: "0,001 ppm", location: "Trạm KK số 2 – KCN phía Bắc", customer_code: "KK2-O3", next_due: d(20), last_result: "pass" }),
    // c-6 Dệt nhuộm
    dev("d-6-ph", "c-6", "it-qt-ph", "Đầu đo pH", { manufacturer: "Hach", model: "pHD sc", serial: "HPH-66001", range_text: "0 ÷ 14 pH", resolution_text: "0,01 pH", customer_code: "DN-PH", ...W("dệt nhuộm") }),
    dev("d-6-cod", "c-6", "it-qt-cod", "Thiết bị đo COD", { manufacturer: "Hach", model: "UVAS sc", serial: "COD-66002", range_text: "0 ÷ 500 mg/L", resolution_text: "0,1 mg/L", customer_code: "DN-COD", ...W("dệt nhuộm") }),
    dev("d-6-ec", "c-6", "it-qt-ec", "Thiết bị đo độ dẫn điện", { manufacturer: "Hach", model: "3798 sc", serial: "EC-66003", range_text: "0 ÷ 2000 µS/cm", resolution_text: "0,1 µS/cm", customer_code: "DN-EC", ...W("dệt nhuộm") }),
    dev("d-6-so2", "c-6", "it-qt-gas", "Bộ phân tích SO2 – lò hơi", { manufacturer: "Sick", model: "GMS810", serial: "SK-66101", range_text: "0 ÷ 1000 ppm", resolution_text: "1 ppm", location: "Ống khói lò hơi than", customer_code: "DN-SO2" }),
  ];

  return { DEMO_COMPANY, DEMO_BRANCHES, DEMO_USERS, DEMO_AUTHS, DEMO_STANDARDS, DEMO_CUSTOMERS, DEMO_DEVICES };
}

/** Đổi khi thay bộ demo: trình duyệt đang giữ bộ cũ sẽ tự xoá và nạp lại */
export const DEMO_VERSION = "quan-trac-tu-dong-2";

/** Danh sách người dùng mẫu (id, vai trò) – dùng trong kiểm thử */
export const demoUsers = () => buildDemo().DEMO_USERS;

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
        // giá trị chuẩn theo chứng nhận: lệch nhẹ so với danh định
        const ref = s.ref_input ? Math.round(p.nominal * (1 + (rnd() - 0.5) * 0.04) * 10 ** s.decimals) / 10 ** s.decimals : p.nominal;
        if (s.ref_input) r[p.id + ":ref"] = [ref];
        const mpe = mpeAt(p.mpe ?? s.mpe, ref);
        const bad = !failed && idx === s.points.length - 1;
        if (bad) failed = true;
        r[p.id] = Array.from({ length: s.readings }, () => jitter(ref, mpe, s.decimals, bad ? 1.6 : 0.45));
        if (s.directions === 2) r[p.id + ":down"] = Array.from({ length: s.readings }, () => jitter(ref, mpe, s.decimals, bad ? 1.6 : 0.45));
      });
    } else if (s.kind === "repeatability") {
      const ref = s.nominal;
      if (s.ref_input) r["r:ref"] = [ref];
      const lim = mpeAt(s.limit, ref);
      r.r = Array.from({ length: s.readings }, () => jitter(ref, lim, s.decimals, 0.3));
    } else if (s.kind === "drift") {
      const ref = s.nominal;
      if (s.ref_input) r["r:ref"] = [ref];
      const lim = mpeAt(s.limit, ref);
      r.r = Array.from({ length: s.readings }, () => jitter(ref, lim, s.decimals, 0.4));
    } else if (s.kind === "eccentricity") {
      const mpe = mpeAt(s.mpe, s.nominal);
      for (let i = 1; i <= s.positions; i++) r[`p${i}`] = [jitter(s.nominal, mpe, s.decimals)];
    } else if (s.kind === "ra") {
      const base = s.unit === "mg/m3" ? 80 : 40;
      const f = 10 ** s.decimals;
      r.rm = Array.from({ length: s.pairs }, () => Math.round(base * (0.8 + rnd() * 0.4) * f) / f);
      r.cem = r.rm.map((v) => Math.round((v as number) * (1 + (rnd() - 0.45) * 0.08) * f) / f);
      if (s.qcvn_sub) r.qcvn = [s.unit === "mg/m3" ? 500 : 150];
    } else continue;
    out[s.id] = r;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nạp toàn bộ demo
// ---------------------------------------------------------------------------
export async function seedDemo(repo: Repo): Promise<void> {
  const { DEMO_COMPANY, DEMO_BRANCHES, DEMO_USERS, DEMO_AUTHS, DEMO_STANDARDS, DEMO_CUSTOMERS, DEMO_DEVICES } = buildDemo();
  const t = nowIso();
  const d = (daysFromNow: number) => dayjs().add(daysFromNow, "day").format("YYYY-MM-DD");
  const stamp = <R extends { created_at: string }>(r: R): R => ({ ...r, created_at: t });
  let current: User | null = null;
  const svc = new Services(repo, () => current);
  const as = (id: string) => { current = DEMO_USERS.find((u) => u.id === id)!; };

  await repo.insert("settings", { ...DEFAULT_SETTINGS, company: DEMO_COMPANY, updated_at: t });
  for (const r of DEMO_BRANCHES) await repo.insert("branches", r);
  for (const r of DEMO_USERS) await repo.insert("users", r);
  for (const r of FIELDS_QT) await repo.insert("fields", stamp(r));
  for (const r of PROCEDURES_QT) await repo.insert("procedures", stamp(r));
  for (const r of INSTRUMENT_TYPES_QT) await repo.insert("instrument_types", stamp(r));
  for (const r of DEMO_AUTHS) await repo.insert("authorizations", r);
  for (const r of DEMO_STANDARDS) await repo.insert("standards", r);
  for (const r of DEMO_CUSTOMERS) await repo.insert("customers", r);
  for (const r of DEMO_DEVICES) await repo.insert("devices", r);

  // Tem: 1 lô đã nhận, cấp một phần cho người ký
  as("u-dung");
  await svc.createSealBatch({ prefix: "KĐV-", from_no: 1, to_no: 500, received_at: d(-60), note: "Lô tem năm nay", width: 6 });
  const seals = await repo.list("seals", { orderBy: { field: "seq" }, limit: 100 });
  await svc.assignSeals(seals.slice(0, 50).map((s) => s.id), "u-an");
  await svc.assignSeals(seals.slice(50, 100).map((s) => s.id), "u-dung");

  const procById = Object.fromEntries(PROCEDURES_QT.map((p) => [p.id, p]));
  const typeById = Object.fromEntries(INSTRUMENT_TYPES_QT.map((x) => [x.id, x]));
  // chuẩn dùng theo loại phương tiện đo
  const stdFor = (typeId: string): string[] => ({
    "it-qt-ph": ["s-ph", "s-bath"], "it-qt-cod": ["s-cod"], "it-qt-tss": ["s-tss"], "it-qt-nh4": ["s-nh4"], "it-qt-ec": ["s-bath"],
    "it-qt-gas": ["s-gas", "s-dil"], "it-qt-o2": ["s-o2", "s-dil"], "it-qt-amb": ["s-amb", "s-dil"], "it-qt-dust": ["s-dust"],
    "it-qt-ra-nuoc": ["s-cod"], "it-qt-ra-nuoc30": ["s-tss"], "it-qt-ra-khi": ["s-iso", "s-gas"], "it-qt-ra-bui": ["s-iso"],
  } as Record<string, string[]>)[typeId] ?? [];
  const techFor = (fieldId: string) => (fieldId === "f-qtn" ? "u-binh" : "u-cuong");
  const intake = { condition: "Thiết bị đang lắp tại trạm, hoạt động bình thường", accessories: "", note: "" };

  async function order(customer_id: string, deviceIds: string[], received: number, expected: number, onsite = true, branch = "br-hn") {
    as("u-em");
    const items = deviceIds.map((id) => {
      const dv = DEMO_DEVICES.find((x) => x.id === id)!;
      return { device_id: id, kind: "periodic" as JobKind, price: typeById[dv.instrument_type_id].default_price, priority: "normal" as const, intake };
    });
    const c = DEMO_CUSTOMERS.find((x) => x.id === customer_id)!;
    return svc.createOrder({ customer_id, branch_id: branch, received_at: d(received), expected_at: d(expected), onsite, contact_name: c.contact_name, contact_phone: null, note: null, items });
  }
  async function assign(jobId: string, tech?: string, reviewer: string | null = null) {
    const job = (await repo.get("jobs", jobId))!;
    as("u-dung");
    await svc.assignJob(jobId, { assignee_id: tech ?? techFor(typeById[job.instrument_type_id].field_id), reviewer_id: reviewer, due_date: job.due_date, priority: job.priority });
  }
  async function perform(jobId: string, fail = false, date = d(-1), tech?: string) {
    await assign(jobId, tech);
    const job = (await repo.get("jobs", jobId))!;
    const proc = procById[typeById[job.instrument_type_id].procedure_id!];
    as(job.assignee_id!);
    await svc.saveReadings(jobId, { env: { temp: 24.5, humidity: 62, pressure: 1009 }, readings: genReadings(proc.template, fail), standard_ids: stdFor(job.instrument_type_id), performed_at: date, performed_note: null });
    await svc.submitForReview(jobId);
  }
  async function review(jobId: string, ok = true, by = "u-dung") {
    as(by);
    const s = await svc.settings();
    await svc.reviewJob(jobId, { ok, note: ok ? null : "Độ trôi lần 2 bất thường, kiểm tra lại đầu đo rồi đo lại", checks: Object.fromEntries(s.review.checklist.map((_, i) => [String(i), true])) });
  }
  async function issue(jobId: string, date = d(-1)) {
    as("u-an");
    const seal = await svc.nextSealFor("u-an");
    const job = (await repo.get("jobs", jobId))!;
    return svc.approveAndIssue(jobId, { issued_at: date, seal_no: seal?.number ?? null, place: DEMO_CUSTOMERS.find((c) => c.id === job.customer_id)!.address ?? "" });
  }

  // 1. Giấy Sông Lam – xong 1 tháng trước: 4 đầu đo nước + RA kênh COD, đã trả, đã thu tiền
  {
    const { order: o, jobs } = await order("c-1", ["d-1-ph", "d-1-cod", "d-1-tss", "d-1-nh4", "d-1-ra"], -40, -32);
    for (const j of jobs) { await perform(j.id, false, d(-36)); await review(j.id); await issue(j.id, d(-35)); as("u-em"); await svc.returnDevice(j.id, d(-34)); }
    as("u-giang"); await svc.setOrderPaid(o.id, true, d(-30));
  }
  // 2. Xi măng Đồng Lâm – khí thải lò nung, đang làm: SO2 phát hành, NO không đạt điểm "0", CO chờ ký, O2 chờ soát xét, RA bụi + RA SO2 đã phân công
  {
    const { jobs } = await order("c-2", ["d-2-so2", "d-2-no", "d-2-co", "d-2-o2", "d-2-pm", "d-2-ra"], -6, 2);
    await perform(jobs[0].id, false, d(-4)); await review(jobs[0].id); await issue(jobs[0].id, d(-3));
    await perform(jobs[1].id, true, d(-4)); await review(jobs[1].id); await issue(jobs[1].id, d(-3));
    await perform(jobs[2].id, false, d(-2)); await review(jobs[2].id);
    await perform(jobs[3].id, false, d(-1));
    await assign(jobs[4].id, "u-hung");
    await assign(jobs[5].id, "u-cuong");
  }
  // 3. KCN Tân Phú Thịnh – mới tiếp nhận: COD, TSS phân công cho Cường; pH, amoni, RA chờ phân công
  {
    const { jobs } = await order("c-3", ["d-3-ph", "d-3-cod", "d-3-tss", "d-3-nh4", "d-3-ra-cod", "d-3-ra-tss"], -1, 6);
    await assign(jobs[1].id, "u-cuong");
    await assign(jobs[2].id, "u-cuong", "u-dung");
  }
  // 4. Bệnh viện Thành An – quá hẹn trả: pH đang đo dở (bị trả lại sau soát xét), COD và TSS đã phân công cho Bình
  {
    const { jobs } = await order("c-4", ["d-4-ph", "d-4-cod", "d-4-tss"], -9, -2);
    await perform(jobs[0].id, false, d(-3)); await review(jobs[0].id, false);
    await assign(jobs[1].id, "u-binh"); await assign(jobs[2].id, "u-binh");
  }
  // 5. Trung tâm Quan trắc tỉnh – trạm KK số 1 xong 2 tuần trước, chưa thu tiền
  {
    const { jobs } = await order("c-5", ["d-5-so2", "d-5-no2", "d-5-co", "d-5-dust"], -20, -12);
    for (const j of jobs) { await perform(j.id, false, d(-15)); await review(j.id); await issue(j.id, d(-14)); }
  }
  // 6. Dệt nhuộm Thành Công (chi nhánh HCM) – đơn mới hôm nay, chờ phân công
  await order("c-6", ["d-6-ph", "d-6-cod", "d-6-ec", "d-6-so2"], 0, 7, true, "br-hcm");

  // 7. Trao đổi nội bộ: kênh chung, lời nhờ soát xét kèm trích dẫn phiếu, chia sẻ phiếu
  {
    const jobsOf = async (c: string) => (await repo.list("jobs", { where: { customer_id: c } })).sort((a, b) => a.code.localeCompare(b.code));
    const c2 = await jobsOf("c-2");
    const c4 = await jobsOf("c-4");
    as("u-dung");
    await svc.chatSend({ channel: "general", text: "Chào cả nhà. Tuần này ưu tiên trạm khí thải lò nung Xi măng Đồng Lâm, khách cần GCN trước kỳ báo cáo quý cho Sở." });
    as("u-hung");
    await svc.chatSend({ channel: "general", text: "Em đã chuẩn bị bộ lấy mẫu đẳng động, mai lên Đồng Lâm đo đối chứng RA bụi ạ." });
    as("u-cuong");
    const o2 = c2.find((j) => j.status === "review");
    if (o2) await svc.chatSend({ channel: "dm:u-cuong:u-dung", text: `Chị Dung soát xét giúp em phiếu ${o2.code} (O2 lò nung) nhé, khách hẹn thứ Hai.`, refs: [{ kind: "job", id: o2.id }], ask: { kind: "review", to_user_id: "u-dung" } });
    as("u-binh");
    const ph = c4.find((j) => j.status === "in_progress");
    if (ph) await svc.chatSend({ channel: "dm:u-binh:u-cuong", text: "Anh Cường ơi, phiếu pH bệnh viện bị trả lại vì độ trôi. Anh xem giúp em số liệu lần 2 có bất thường không?", refs: [{ kind: "job", id: ph.id }], ask: { kind: "check", to_user_id: "u-cuong" } });
  }

  as("u-an");
  await svc.runDailyChecks();
}

# Kiểm định thiết bị quan trắc môi trường tự động – căn cứ và cách ManagerCAL chuẩn hoá

Tài liệu này ghi lại các văn bản đã đọc (06/11/2026) và cách từng yêu cầu được đưa vào mẫu biên bản của phần mềm (`src/lib/seed/monitoring.ts`). Văn bản pháp luật thay đổi thường xuyên: trước khi dùng thật, quản lý chất lượng nên đối chiếu lại bản hiện hành.

## 1. Hai loại công việc khác nhau

| | Kiểm định phương tiện đo của trạm | Kiểm tra độ chính xác tương đối (RA) của hệ thống |
|---|---|---|
| Căn cứ | Luật Đo lường; quy trình ĐLVN 380–389:2021, ĐLVN 90:2017 | TT 10/2021/TT-BTNMT, Khoản 6 Điều 35 (nước thải), Khoản 6 Điều 38 (khí thải) |
| Đối tượng | Từng đầu đo / bộ phân tích (pH, COD, SO2…) | Cả hệ thống đang vận hành tại cơ sở, từng thông số |
| Cách làm | So với dung dịch / khí chuẩn được chứng nhận | Quan trắc đối chứng (lấy mẫu, phân tích theo phương pháp chuẩn) ≥ 6 lần, so với số liệu của hệ thống |
| Kết quả | Giấy chứng nhận kiểm định + tem; không đạt → thông báo, xoá dấu cũ | Biên bản kiểm tra (Phụ lục 13 / 14), **không cấp tem** |
| Chu kỳ | 12 tháng | Trước khi vận hành chính thức và 01 lần/năm, do đơn vị độc lập thực hiện |

Ngoài ra chủ cơ sở phải tự kiểm tra thiết bị bằng chất chuẩn **tối thiểu 01 tháng/lần**; nếu sai lệch so với chất chuẩn **≥ 10 %** thì phải kiểm định, hiệu chuẩn lại (TT 10/2021, điểm b Khoản 4 Điều 35).

## 2. Quy trình ĐLVN cho phương tiện đo của trạm quan trắc

Nguồn: danh mục ĐLVN trên trang Tổng cục Tiêu chuẩn Đo lường Chất lượng, [tcvn.gov.vn](https://tcvn.gov.vn/van-ban-ky-thuat-do-luong-viet-nam-dlvn/31/08/2017/) (bản PDF từng quy trình). Các quy trình 380–389:2021 do Tổng cục Môi trường đề nghị.

Các phép kiểm chung: kiểm tra bên ngoài (7.1), kiểm tra kỹ thuật (7.2), kiểm tra đo lường (7.3). Áp dụng cho kiểm định ban đầu, định kỳ và sau sửa chữa.

| Quy trình | Phương tiện đo | Phạm vi | Điểm "0" (MPE theo độ phân giải) | Sai số tại điểm kiểm | Tuyến tính | Lặp lại (s) | Độ trôi |
|---|---|---|---|---|---|---|---|
| ĐLVN 381:2021 | pH (nước) | 0 ÷ 14 pH | – | độ chia 0,01 → ± 0,05 pH; 0,1 → ± 0,2 pH | – | ≤ ½\|MPE\| (0,01) / ≤ 1/3\|MPE\| (0,1) | 3 lần cách 2 h, ≤ MPE |
| ĐLVN 382:2021 | TDS | đến 200 000 mg/L | 0,01 → ±0,1; 0,1 → ±1; 1 → ±2 mg/L | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 383:2021 | Độ dẫn điện | đến 500 mS/cm | – | ± 5 % | – | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 384:2021 | Độ đục | đến 4000 NTU | 0,01 → ±0,1; 0,1 → ±1; 1 → ±2 NTU | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 385:2021 | Oxy hoà tan (DO) | đến 20 mg/L | ± 0,2 mg/L | ± 6 % | – | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 386:2021 | Amoni (theo N) | đến 200 mg/L | như 382 (mg/L) | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 387:2021 | COD | đến 500 mg/L | như 382 (mg/L) | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 388:2021 | TSS | đến 500 mg/L | như 382 (mg/L) | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 380:2021 | Khí thải: CO, SO2, NO, NO2, O2, CO2, HCl, NH3, HF, H2S | CO 0,5; SO2 0,2; NO 0,4; NO2 0,2; O2, CO2 30 %V… | 0,1 ppm → ±1 ppm; 1 ppm → ±5 ppm; 0,01 %V → ±0,05 %V; 0,1 %V → ±0,5 %V | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | 2 h, ≤ MPE |
| ĐLVN 389:2021 | Khí xung quanh: CO, SO2, NO, NO2, O3, NH3, THC, H2S, VOCs | CO 100 ppm; SO2… 10 ppm; O3 5 ppm | 0,0001 ppm → ±0,001; 0,001 → ±0,01; 0,01 → ±0,05; 0,1 → ±0,5 ppm | ± 5 % | R² ≥ 0,99 | ≤ 1/3\|MPE\| | sau 24 h: điểm "0" ≤ MPE "0", điểm nồng độ ≤ MPE |
| ĐLVN 90:2017 | Bụi tổng trong không khí | 0 ÷ 200 mg/m3 | 0,1 → 0,3; 0,01 → 0,05; 0,001 → 0,05 mg/m3 | ± 10 % giá trị đọc | – | ≤ 1/3 MPE | – |

Điểm kiểm sai số: 3 điểm ở khoảng (20 ± 10) %, (50 ± 10) %, (80 ± 10) % phạm vi đo (bụi: 30 % và 80 %), mỗi điểm đo ≥ 3 lần, sai số tương đối δ = (C̄ đo − C chuẩn) / C chuẩn × 100. Lặp lại: ≥ 5 lần đo liên tiếp, độ lệch chuẩn mẫu. Điều kiện: (20 ÷ 30) °C, ≤ 80 %RH (bụi: 25 ± 3 °C). Chuẩn: dung dịch chuẩn ĐKĐB ≤ 1,5 % (TSS ≤ 2 %), pH ≤ 1/3\|MPE\|; khí chuẩn, khí "không" N2 ≥ 99,995 %V (khí xung quanh ≥ 99,999 %V).

Chu kỳ kiểm định: **12 tháng**, với điều kiện cơ cấu chỉnh được bảo mật và vận hành, bảo quản theo khuyến nghị của nhà sản xuất (mục 8.3 của từng quy trình).

**Ghi chú về độ tuyến tính:** các ĐLVN ghi "R² = b²" (b là độ dốc) nhưng yêu cầu "độ tuyến tính ≤ 1 % (R² ≥ 0,99)". ManagerCAL tính R² là **hệ số xác định** của hồi quy y = a + bx giữa giá trị chuẩn và giá trị đo trung bình. Đây là cách hiểu thông dụng, và cũng chặt hơn so với đọc theo nghĩa đen. Nếu tổ chức chỉ định hướng dẫn khác, sửa trong `src/lib/calc/index.ts`.

**Chưa có quy trình ĐLVN:** thiết bị đo bụi PM khí thải (ống khói), lưu lượng, nhiệt độ, áp suất, Tổng N, Tổng P, TOC, Clo dư, độ màu, hơi Hg. Với các thiết bị này, ManagerCAL dùng quy trình RA của TT 10/2021 (bụi PM). Các thông số còn lại cần hiệu chuẩn theo hướng dẫn của nhà sản xuất hoặc quy trình nội bộ (thêm trong Danh mục › Quy trình).

## 3. Thông tư 10/2021/TT-BTNMT – hệ thống quan trắc tự động, liên tục

Nguồn: [datafiles.chinhphu.vn/cpp/files/vbpq/2021/07/10-btnmt.pdf](https://datafiles.chinhphu.vn/cpp/files/vbpq/2021/07/10-btnmt.pdf).

- **Điều 34, Bảng 3 – đặc tính thiết bị nước thải** (độ chính xác theo giá trị đọc / khoảng đo; độ phân giải; thời gian đáp ứng): lưu lượng ±5 %/±5 %, ≤ 5 phút; nhiệt độ ±5 %, 0,1, ≤ 5 s; độ màu ±5 %, ≤ 5 phút; pH ±0,2 pH, 0,1, ≤ 5 s; TSS ±5 %/±3 %, 0,1, ≤ 10 s; COD ±5 %/±3 %, 0,5, ≤ 15 phút; NH4+ ±5 %, 0,2, ≤ 30 phút; tổng P, tổng N ±5 %/±3 %, 0,1, ≤ 30 phút; TOC ±5 %, 0,1, ≤ 30 phút; Clo dư ±5 %/±2 %, 0,1, ≤ 30 phút. Ít nhất 01 khoảng đo ≥ 3 lần giới hạn QCVN (trừ nhiệt độ, pH). Chất chuẩn kiểm tra định kỳ: độ chính xác ± 5 % (pH ± 0,1).
- **Điều 37, Bảng 5 – đặc tính thiết bị khí thải**: nhiệt độ, áp suất ±5 %, ≤ 120 s; NO, CO, SO2 ±5 %, 1 mg/m3 hoặc 1 ppm, ≤ 200 s; NO2 ±5 %, ≤ 300 s; O2 ±0,5 %, 0,1 %V, ≤ 200 s; H2S, NH3 ±5 %, 0,1, ≤ 300 s; hơi Hg ±5 %, ≤ 900 s; bụi PM ±10 % giá trị đọc / ±5 % khoảng đo, 0,1 mg/m3, ≤ 60 s. Khí chuẩn trong khoảng 10–70 % khoảng đo; không dùng chất chuẩn cho nhiệt độ, bụi, áp suất.
- **Điều 35, 38 – kiểm định, hiệu chuẩn, kiểm soát chất lượng**: thiết bị phải được kiểm định, hiệu chuẩn theo pháp luật đo lường. Tự kiểm tra bằng chất chuẩn ≥ 01 tháng/lần, sai lệch ≥ 10 % thì kiểm định lại. Kiểm soát chất lượng trước vận hành chính thức và 01 lần/năm do đơn vị độc lập làm. Khí thải: kiểm tra ống dẫn mẫu bằng khí chuẩn ≥ 20 phút, sai khác ≤ 5 %; quan trắc đối chứng khi cơ sở chạy ≥ 50 % công suất.
- **Bảng 4 – giới hạn RA nước thải**: pH, độ màu, COD, N-NH4+, tổng P, tổng N, TOC ≤ 20 %; TSS, Clo dư ≤ 30 %. **Khí thải**: RA ≤ 20 %.
- **Phụ lục 12 – công thức RA**: dᵢ = CEMᵢ − RMᵢ; d̄ = Σdᵢ / n; Stdev = √[(Σdᵢ² − (Σdᵢ)²/n) / (n − 1)]; cc = t₀,₀₂₅ · Stdev / √n (t theo n − 1 = 5…14: 2,571; 2,447; 2,365; 2,306; 2,262; 2,228; 2,201; 2,179; 2,160; 2,145); RA = (\|d̄\| + \|cc\|) / RM̄ × 100. Với khí SO2, NO2, CO, H2S, NH3, hơi Hg: nếu RM̄ < 50 % giới hạn QCVN áp dụng cho cơ sở thì mẫu số là giới hạn QCVN.

Kiểm thử `tests/unit/monitoring.test.ts` tính lại một ví dụ RA bằng tay (8,97 %) để chắc phần mềm làm đúng công thức.

## 4. Đối tượng phải quan trắc tự động

- Luật Bảo vệ môi trường 2020; NĐ 08/2022/NĐ-CP, Điều 97 (nước thải, Phụ lục XXVIII) và Điều 98 (bụi, khí thải, Phụ lục XXIX).
- NĐ 05/2025/NĐ-CP sửa đổi NĐ 08/2022: hồ sơ thiết bị quan trắc khí thải tự động phải kèm CO/CQ và phiếu kiểm định, hiệu chuẩn hoặc thử nghiệm.
- NĐ 48/2026/NĐ-CP (hiệu lực 29/01/2026) sửa đổi tiếp NĐ 08/2022: thay danh mục đối tượng phải quan trắc nước thải tự động (Phụ lục XXVIII), bổ sung yêu cầu camera và truyền số liệu.

Mục 4 tóm tắt theo kết quả tra cứu các trang pháp luật: [luatvietnam.vn – NĐ 05/2025](https://luatvietnam.vn/tai-nguyen/nghi-dinh-05-2025-nd-cp-sua-doi-bo-sung-nghi-dinh-08-2022-nd-cp-quy-dinh-mot-so-dieu-luat-bao-ve-moi-truong-384316-d1.html), [thuvienphapluat.vn – NĐ 48/2026](https://thuvienphapluat.vn/van-ban/Tai-nguyen-Moi-truong/Nghi-dinh-48-2026-ND-CP-sua-doi-Nghi-dinh-08-2022-ND-CP-huong-dan-Luat-Bao-ve-moi-truong-692989.aspx). Phần này chưa đọc nguyên văn công báo, nên cần đối chiếu.

## 5. Trong phần mềm

- **Lĩnh vực mới**: "Quan trắc môi trường nước" (QTN), "Quan trắc khí thải, không khí" (QTK).
- **16 loại phương tiện đo / kênh đo** và **16 quy trình** (Danh mục › Quy trình). Mỗi quy trình có mục "Yêu cầu của quy trình" hiện ngay trên biên bản.
- **Biên bản có các phép mới**: giá trị chuẩn nhập theo chứng nhận của dung dịch / khí chuẩn, sai số tương đối (%), độ lặp lại theo độ lệch chuẩn, độ trôi theo thời gian (2 giờ / 24 giờ), độ tuyến tính (R²), RA với ≥ 6 cặp số liệu.
- **Tài liệu phát hành**: phương tiện đo của trạm → Giấy chứng nhận kiểm định + tem; RA → Biên bản kiểm tra độ chính xác tương đối, không tem, hạn kiểm tra lần sau 12 tháng.
- **Hệ thống đang chạy**: vào Danh mục, quy trình → bấm **"Thêm vào danh mục"** ở thông báo "Thư viện có … quy trình mới". Thao tác này chỉ thêm mục còn thiếu, không sửa mục đã có.
- **Sai số điểm "0"**: phụ thuộc độ phân giải của từng thiết bị. Mẫu đặt sẵn độ phân giải thường gặp (ghi trong "Yêu cầu của quy trình"). Thiết bị có độ phân giải khác thì nhân bản quy trình và sửa MPE điểm "0".

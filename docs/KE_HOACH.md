# Kế hoạch xây dựng ManagerCAL – phần mềm quản lý công ty hiệu chuẩn, kiểm định

> Phiên bản kế hoạch: 0.1 (06/11/2026) · Trạng thái: bản nháp, chờ xác nhận các câu hỏi ở mục 13.

## 1. Mục tiêu

Một phần mềm duy nhất chạy toàn bộ công ty, từ lúc khách hỏi giá đến lúc khách nhận giấy chứng nhận và trả tiền. Nó cũng nhắc khách khi thiết bị sắp đến hạn để có đơn hàng lần sau.

| Mục tiêu | Chỉ số đo |
|---|---|
| Không phát hành giấy chứng nhận (GCN) sai | 0 GCN phải thu hồi vì lỗi nhập liệu hoặc tính toán |
| Rút ngắn thời gian trả kết quả (TAT) | Giảm ≥ 30% so với hiện tại (đo ở giai đoạn 0) |
| Không bỏ sót thiết bị đến hạn | 100% thiết bị khách được nhắc trước 30, 15 và 7 ngày |
| Sẵn sàng cho đánh giá ISO/IEC 17025 / VILAS | Mọi hồ sơ kỹ thuật truy xuất được trong ≤ 1 phút |
| Lãnh đạo nắm tình hình theo thời gian thực | Dashboard doanh thu, công việc, công nợ và chất lượng cập nhật tức thì |

## 2. Phạm vi nghiệp vụ

Ba loại dịch vụ dùng chung một luồng công việc. Chúng khác nhau ở mẫu GCN, quy tắc kết luận và báo cáo gửi cơ quan quản lý.

| Loại | Căn cứ chính (cần đối chiếu văn bản còn hiệu lực) | Đặc điểm trong phần mềm |
|---|---|---|
| **Kiểm định phương tiện đo** (đo lường pháp định) | Luật Đo lường 2011; NĐ 86/2012, NĐ 105/2016 (sửa bởi NĐ 154/2018); TT 23/2013/TT-BKHCN (sửa bởi TT 07/2019) – danh mục phương tiện đo nhóm 2; TT 24/2013/TT-BKHCN; quy trình ĐLVN | Kết luận **Đạt/Không đạt**. Có tem và dấu kiểm định. Chu kỳ theo quy định. Kiểm định ban đầu, định kỳ và sau sửa chữa. Chỉ làm trong lĩnh vực đã được chỉ định. |
| **Hiệu chuẩn** | TCVN ISO/IEC 17025:2017; ILAC-P10 (liên kết chuẩn), ILAC-G8 (quy tắc quyết định), JCGM 100 (GUM) | Báo cáo **giá trị đo và độ không đảm bảo đo (ĐKĐBĐ)**. Chỉ tuyên bố phù hợp khi khách yêu cầu và phải nêu quy tắc quyết định. Mặc định không ghi ngày hiệu chuẩn lần sau, trừ khi khách yêu cầu. |
| **Kiểm định kỹ thuật an toàn** (tuỳ công ty có làm hay không) | Luật ATVSLĐ 2015; NĐ 44/2016 (sửa bởi NĐ 140/2018); TT 36/2019/TT-BLĐTBXH – danh mục máy, thiết bị có yêu cầu nghiêm ngặt; các QTKĐ | Có biên bản kiểm định tại hiện trường và GCN kết quả kiểm định. Có tem. Phải báo cáo cơ quan quản lý lao động địa phương. |

> Ghi chú pháp lý: văn bản và tên cơ quan quản lý thay đổi thường xuyên (sáp nhập bộ ngành năm 2025, các luật sửa đổi). Ở giai đoạn 0 phải đối chiếu lại toàn bộ danh mục căn cứ. Phần mềm để **mẫu biểu, chu kỳ và danh mục ở dạng cấu hình**, không viết cứng vào mã.

## 3. Luồng nghiệp vụ tổng thể

```
Khách hỏi giá ─► Báo giá ─► Hợp đồng / Đơn hàng
                                   │
          ┌────────────────────────┴────────────────────────┐
   Tại phòng thí nghiệm                               Tại hiện trường
   Phiếu tiếp nhận thiết bị                           Lịch đi hiện trường (người, chuẩn, xe)
   (ảnh, tình trạng, phụ kiện, nhãn mã vạch)          (làm offline trên máy tính bảng)
          └────────────────────────┬────────────────────────┘
                                   ▼
          Mỗi thiết bị = 1 PHIẾU CÔNG VIỆC (job)
          Phân công ─► Thực hiện đo ─► Soát xét ─► Phê duyệt / ký số
                                   │
                                   ▼
          Phát hành GCN (PDF ký số + mã QR tra cứu) + cấp tem
                                   ▼
          Bàn giao / trả thiết bị ─► Hoá đơn điện tử ─► Thu tiền / công nợ
                                   ▼
          Lưu hạn kế tiếp ─► Tự nhắc khách ─► Báo giá lần sau (vòng lặp doanh thu)
```

### Trạng thái phiếu công việc

`Tiếp nhận` → `Chờ phân công` → `Đang thực hiện` → `Chờ soát xét` → `Chờ phê duyệt` → `Đã phát hành` → `Đã trả khách`

Các nhánh phụ:
- `Tạm dừng`: chờ khách xác nhận, chờ sửa chữa, chờ chuẩn.
- `Trả lại`: người soát xét hoặc phê duyệt trả về kèm lý do.
- `Không thực hiện được`: thiết bị hỏng hoặc ngoài năng lực, vẫn lập phiếu báo cho khách.

Kết luận **Không đạt** (kiểm định) sinh *thông báo không đạt*, không cấp tem, và ghi nhận việc xoá dấu hoặc tem cũ.

## 4. Các phân hệ chức năng

### 4.1 Khách hàng và kinh doanh (CRM)
- Khách hàng, nhiều địa điểm, nhiều người liên hệ. Mã số thuế tự điền thông tin từ tra cứu MST.
- Bảng giá chuẩn và bảng giá riêng theo khách hoặc hợp đồng khung. Chiết khấu, phụ phí hiện trường, phụ phí làm gấp.
- Báo giá có phiên bản, gửi email hoặc Zalo, khách xác nhận trực tuyến, chuyển thành đơn hàng bằng một nút.
- Hợp đồng: giá trị, thời hạn, điều khoản, file scan, mức đã thực hiện so với giá trị hợp đồng.
- Cơ hội bán hàng tự sinh từ danh sách thiết bị khách sắp đến hạn.
- Gán nhân viên kinh doanh để tính doanh số và hoa hồng.

### 4.2 Hồ sơ thiết bị của khách
- Mỗi thiết bị có mã nội bộ, số sê-ri, hãng, kiểu (model), phạm vi đo, độ phân giải, cấp chính xác, vị trí đặt.
- Toàn bộ lịch sử: các lần kiểm định hoặc hiệu chuẩn, kết quả, GCN, sai số qua các năm (biểu đồ độ trôi để tư vấn chu kỳ cho khách).
- Hạn kế tiếp, tính theo chu kỳ pháp định hoặc chu kỳ khách chọn.
- Nhập hàng loạt từ Excel danh sách thiết bị khách gửi.
- In nhãn mã vạch hoặc QR dán lên thiết bị khi tiếp nhận để quét ở mọi khâu sau.

### 4.3 Danh mục kỹ thuật (cấu hình)
- Lĩnh vực đo: khối lượng, độ dài, áp suất, nhiệt độ, điện, dung tích, lưu lượng, hoá lý, thời gian–tần số…
- Loại phương tiện đo, nhóm (nhóm 2 hay không), chu kỳ kiểm định theo quy định.
- Quy trình (ĐLVN hoặc quy trình nội bộ) có **phiên bản và ngày hiệu lực**. Phiếu công việc ghi lại đúng phiên bản đã dùng.
- Phạm vi năng lực: phạm vi được chỉ định kiểm định, phạm vi công nhận VILAS và CMC. Hệ thống cảnh báo khi nhận việc ngoài phạm vi; khi đó GCN không được dùng logo công nhận.
- Định mức thời gian từng loại việc, dùng để lập lịch và tính năng suất.

### 4.4 Tiếp nhận, phân công, lập lịch
- Phiếu tiếp nhận: chụp ảnh tình trạng, liệt kê phụ kiện, khách ký nhận trên máy tính bảng, in phiếu.
- Bảng phân công dạng Kanban (theo trạng thái) và lịch (theo người).
- **Gợi ý người làm** dựa trên ủy quyền lĩnh vực, chứng chỉ còn hạn và khối lượng việc đang có.
- **Gợi ý chuẩn** dựa trên chuẩn đúng phạm vi, còn hạn hiệu chuẩn, không đang bị mượn hoặc hỏng.
- Lịch hiện trường: đặt trước người, bộ chuẩn và xe, tránh trùng lịch.
- Ưu tiên: thường, gấp, hẹn ngày trả. Cảnh báo việc sắp trễ hạn.

### 4.5 Thực hiện đo – biên bản số liệu điện tử (lõi kỹ thuật)
- **Mẫu biên bản theo quy trình**: định nghĩa các điểm đo, số lần đo, công thức tính sai số, độ lặp lại, độ trễ và giới hạn cho phép. Mẫu có phiên bản và phải được duyệt trước khi dùng.
- Kỹ thuật viên chỉ nhập số đọc. Hệ thống tính sai số, đưa ra kết luận Đạt/Không đạt và lập **bảng ngân sách ĐKĐBĐ** (theo GUM) từ ĐKĐBĐ của chuẩn, độ phân giải, độ lặp và ảnh hưởng môi trường.
- Ghi điều kiện môi trường (nhiệt độ, độ ẩm, áp suất), nhập tay hoặc lấy tự động từ thiết bị ghi dữ liệu. Ngoài giới hạn của quy trình thì cảnh báo hoặc chặn.
- Chuẩn được chọn sẽ tự gắn vào hồ sơ, đảm bảo truy xuất được chuỗi liên kết chuẩn.
- Đính kèm ảnh, file xuất từ thiết bị, ghi chú bất thường.
- **Chạy offline** trên máy tính bảng ở hiện trường, tự đồng bộ khi có mạng.
- Giai đoạn sau: đọc số trực tiếp từ thiết bị qua cổng USB/RS-232 (Web Serial) hoặc nhập file CSV.
- Ở giai đoạn đầu, cho phép **đính kèm file Excel biên bản hiện có** với các mục chưa kịp số hoá, để không chặn việc dùng phần mềm.

### 4.6 Soát xét, phê duyệt, chữ ký số
- Người soát xét phải khác người thực hiện. Người phê duyệt phải có quyền ký GCN của lĩnh vực đó.
- Danh sách kiểm tra khi soát xét, ví dụ: chuẩn còn hạn, môi trường đạt, số liệu hợp lý.
- Trả lại kèm lý do. Lý do được thống kê để đào tạo lại.
- Ký số GCN dạng PDF qua dịch vụ ký số từ xa (VNPT SmartCA, Viettel MySign, MISA eSign…) hoặc USB token. Có phương án dự phòng: in và ký tay, rồi quét lưu.

### 4.7 Giấy chứng nhận và tem
- Đánh số GCN tự động theo quy tắc cấu hình, ví dụ `KĐ-2026-000123` hoặc `HC-ÁP-26-0456`. Số **liên tục, không trùng, không mất số**: số đã huỷ phải ghi lý do.
- Mẫu GCN riêng cho kiểm định, hiệu chuẩn (đủ các nội dung theo mục 7.8 của ISO/IEC 17025) và kiểm định an toàn. Có song ngữ Việt–Anh khi cần.
- Mã QR trên GCN dẫn tới trang tra cứu công khai, để khách hoặc cơ quan kiểm tra GCN thật hay giả và còn hiệu lực hay không.
- GCN đã phát hành **không sửa được**. Muốn sửa phải phát hành bản thay thế, ghi rõ thay thế GCN số nào; bản cũ chuyển sang trạng thái "bị thay thế". Thu hồi GCN phải có lý do và gửi thông báo cho khách.
- Quản lý tem và ấn chỉ: nhập lô số tem, cấp cho kỹ thuật viên, ghi sử dụng hoặc huỷ, đối chiếu tồn. Có sổ theo dõi sử dụng tem.

### 4.8 Bàn giao và cổng khách hàng
- Phiếu bàn giao trả thiết bị (khách ký trên máy tính bảng), gửi GCN qua email hoặc Zalo.
- **Cổng khách hàng** (web, đăng nhập theo công ty khách):
  - Danh sách thiết bị, hạn kế tiếp, tải GCN.
  - Gửi yêu cầu dịch vụ, theo dõi trạng thái phiếu, xem báo giá, xem công nợ.

### 4.9 Tài chính
- Hoá đơn điện tử: gọi API của nhà cung cấp hoá đơn (MISA meInvoice, Viettel S-Invoice, VNPT Invoice… chọn ở giai đoạn 0). Tuân thủ NĐ 123/2020 (sửa bởi NĐ 70/2025) và TT 78/2021.
- Ghi nhận thanh toán, đối soát chuyển khoản. Có thể đọc sao kê ngân hàng hoặc dùng mã VietQR có nội dung là số đơn.
- Công nợ theo khách, tuổi nợ, nhắc nợ tự động. Chặn nhận đơn mới khi khách vượt hạn mức nợ (có thể bật hoặc tắt).
- Xuất dữ liệu sang phần mềm kế toán đang dùng (MISA SME, Fast…). ManagerCAL **không** thay thế phần mềm kế toán.
- Chi phí theo đơn: công tác phí, xe, vật tư. Từ đó tính lãi gộp theo đơn và theo lĩnh vực.

### 4.10 Quản lý chuẩn và thiết bị của phòng thí nghiệm
- Danh mục chuẩn và thiết bị đo của công ty: thông số, cấp chính xác, ĐKĐBĐ, nơi hiệu chuẩn, GCN.
- Sơ đồ **chuỗi liên kết chuẩn** lên chuẩn quốc gia hoặc quốc tế.
- Lịch hiệu chuẩn chuẩn ở đơn vị ngoài, lịch **kiểm tra giữa kỳ**, lịch bảo trì. Chuẩn quá hạn bị **khoá**, không chọn được trong biên bản.
- Theo dõi độ trôi của chuẩn qua các lần hiệu chuẩn (biểu đồ) để đề xuất điều chỉnh chu kỳ.
- Mượn và trả chuẩn, ghi nhận sự cố. Khi chuẩn bị phát hiện sai, hệ thống liệt kê **mọi GCN đã dùng chuẩn đó** kể từ lần hiệu chuẩn tốt gần nhất, để đánh giá ảnh hưởng theo mục 7.10 về công việc không phù hợp.

### 4.11 Nhân sự và năng lực
- Hồ sơ năng lực: bằng cấp, chứng chỉ kiểm định viên đo lường, chứng chỉ kiểm định viên an toàn, khoá đào tạo. Cảnh báo chứng chỉ sắp hết hạn.
- **Ma trận ủy quyền**: ai được làm, soát xét hoặc ký lĩnh vực nào, phạm vi nào, từ ngày nào đến ngày nào. Phần mềm kiểm tra ma trận này ở mọi bước.
- Kế hoạch đào tạo, giám sát năng lực định kỳ, kết quả đo lặp lại hoặc đo so sánh nội bộ.
- Năng suất: số việc, số giờ chuẩn, tỷ lệ bị trả lại theo từng người.
- Có thể tích hợp với app `Checkin` (chấm công, GPS, tính lương) đang có: dùng chung tài khoản và danh sách nhân viên, lấy số liệu năng suất để tính thưởng.

### 4.12 Hệ thống chất lượng (ISO/IEC 17025)
- **Kiểm soát tài liệu**: sổ tay, quy trình, biểu mẫu có phiên bản, quy trình duyệt và ban hành, xác nhận đã đọc, thu hồi bản cũ.
- **Công việc không phù hợp và hành động khắc phục (NC/CAPA)**: ghi nhận, phân tích nguyên nhân, hành động, kiểm tra hiệu lực.
- **Khiếu nại** của khách: tiếp nhận, xử lý, phản hồi, đóng.
- **Thử nghiệm thành thạo và so sánh liên phòng (PT/ILC)**: kế hoạch nhiều năm phủ đủ các lĩnh vực, kết quả En và z-score, hành động khi không đạt.
- **Đánh giá nội bộ**: kế hoạch, danh sách kiểm tra, phát hiện, liên kết sang CAPA.
- **Xem xét của lãnh đạo**: tự tổng hợp đầu vào (kết quả đánh giá, khiếu nại, PT, NC, phản hồi của khách) thành báo cáo.
- **Rủi ro và cơ hội**, **tính khách quan** (cam kết, xung đột lợi ích).
- **Nhà cung cấp**: đơn vị hiệu chuẩn chuẩn, nhà cung cấp vật tư; đánh giá định kỳ.
- **Khảo sát mức độ hài lòng của khách hàng**: tự gửi phiếu sau khi trả kết quả.

### 4.13 Kho, vật tư, tài sản
- Vật tư tiêu hao, phụ tùng, tem và ấn chỉ: nhập, xuất, tồn, cảnh báo tồn tối thiểu.
- Xe công ty: lịch dùng, km, bảo dưỡng, đăng kiểm.

### 4.14 Thông báo
- Kênh gửi: trong app (thời gian thực), email, Zalo OA, Telegram, Web Push.
- Các sự kiện được báo:
  - Việc mới, việc sắp trễ, phiếu chờ soát xét hoặc ký.
  - Chuẩn sắp hết hạn, chứng chỉ nhân sự sắp hết hạn.
  - Thiết bị khách sắp đến hạn (gửi khách và nhân viên kinh doanh), công nợ quá hạn.

### 4.15 Quản trị hệ thống
- Phân quyền theo vai trò và theo chi nhánh: Giám đốc, Kinh doanh, Tiếp nhận, Kỹ thuật viên, Soát xét, Ký duyệt, Quản lý chất lượng, Kế toán, Khách hàng.
- **Nhật ký kiểm toán**: ai sửa gì, lúc nào, giá trị cũ và mới. Đây là yêu cầu về tính toàn vẹn dữ liệu (mục 7.11 của ISO/IEC 17025).
- Nhiều chi nhánh hoặc phòng thí nghiệm, đánh số GCN riêng từng nơi.
- Thời gian lưu hồ sơ cấu hình được (thường ≥ 5 năm). Sao lưu hằng ngày, có khôi phục theo thời điểm.

## 5. Báo cáo và theo dõi

### 5.1 Dashboard lãnh đạo (một màn hình)
- Doanh thu tháng và lũy kế năm so với kế hoạch.
- Số phiếu theo trạng thái, số phiếu trễ hạn.
- TAT trung bình, tỷ lệ Đạt/Không đạt.
- Công nợ quá hạn.
- Số thiết bị khách đến hạn trong 30 ngày tới (doanh thu tiềm năng).
- Chuẩn và chứng chỉ sắp hết hạn, NC/CAPA đang mở.

### 5.2 Danh mục báo cáo

| Nhóm | Báo cáo |
|---|---|
| **Vận hành** | Sổ theo dõi tiếp nhận; phiếu theo trạng thái, theo người, theo lĩnh vực; việc trễ hạn; TAT theo lĩnh vực; năng suất kỹ thuật viên; tỷ lệ bị trả lại khi soát xét; lịch hiện trường tuần hoặc tháng |
| **Kỹ thuật** | Sổ cấp GCN; sổ sử dụng tem và ấn chỉ; thống kê Đạt/Không đạt theo loại phương tiện đo; mức sử dụng chuẩn; lịch hiệu chuẩn chuẩn; kết quả kiểm tra giữa kỳ; GCN bị thay thế hoặc thu hồi |
| **Kinh doanh** | Doanh thu theo kỳ, khách, lĩnh vực, nhân viên kinh doanh, chi nhánh; tỷ lệ báo giá thành đơn; top khách hàng; khách hàng mất (có thiết bị đến hạn nhưng không quay lại); dự báo doanh thu từ thiết bị đến hạn |
| **Tài chính** | Công nợ và tuổi nợ; thu tiền theo kỳ; hoá đơn đã xuất; lãi gộp theo đơn và lĩnh vực; hoa hồng kinh doanh |
| **Chất lượng** | NC/CAPA; khiếu nại; kết quả PT/ILC; đánh giá nội bộ; đầu vào xem xét lãnh đạo; mức độ hài lòng của khách; năng lực và đào tạo nhân sự |
| **Gửi cơ quan quản lý** | Báo cáo định kỳ kết quả hoạt động kiểm định, hiệu chuẩn; báo cáo kiểm định an toàn theo mẫu hiện hành (xác nhận mẫu ở giai đoạn 0); danh sách kiểm định viên |

Mọi báo cáo đều lọc được theo thời gian và chi nhánh, xuất được Excel hoặc PDF, và lưu được bộ lọc hay dùng. Một số báo cáo có thể tự gửi email theo lịch, ví dụ báo cáo tuần gửi giám đốc mỗi sáng thứ Hai.

## 6. Kiến trúc kỹ thuật

Dùng lại bộ công nghệ đã chạy ổn trong dự án `Checkin`, để dùng chung được kinh nghiệm, mã và hạ tầng.

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Giao diện | React 19, Vite, TypeScript, Tailwind CSS | PWA; một bộ mã cho máy tính và máy tính bảng ở hiện trường |
| Offline | IndexedDB, hàng đợi đồng bộ, Service Worker | Chỉ áp dụng cho biên bản hiện trường và tiếp nhận |
| Máy chủ và CSDL | Supabase: PostgreSQL, Auth, Storage, Realtime, Edge Functions | Bảo mật ở mức dòng (RLS) theo vai trò và chi nhánh; mọi quy tắc nghiệp vụ quan trọng chạy trên máy chủ |
| Bộ máy tính toán | Thư viện TypeScript thuần (`packages/calc`) | Chạy cả trên trình duyệt (offline) và máy chủ (kiểm tra lại trước khi phát hành); kiểm thử đơn vị với các ví dụ chuẩn, ví dụ các ví dụ mẫu trong GUM |
| Tạo PDF | Mẫu HTML render ra PDF ở Edge Function hoặc dịch vụ riêng | Lưu kèm mã băm SHA-256 để chống sửa |
| Ký số | API ký số từ xa của nhà cung cấp chứng thư số | Chọn ở giai đoạn 0 |
| Excel | exceljs | Nhập danh sách thiết bị, xuất báo cáo |
| Triển khai | Vercel (giao diện) và Supabase cloud; có phương án chuyển sang VPS tự quản như `Checkin/deploy/vps` | Cân nhắc đặt dữ liệu ở Việt Nam theo Luật Bảo vệ dữ liệu cá nhân 2025 |
| Kiểm thử | Vitest (đơn vị), Playwright (đầu–cuối), kiểm thử RLS bằng SQL | Chạy tự động khi đẩy mã (CI) |

### Cấu trúc thư mục dự kiến

```
ManagerCAL/
  apps/web/            # ứng dụng nội bộ và cổng khách hàng (phân luồng theo vai trò)
  packages/calc/       # tính sai số, ĐKĐBĐ, quy tắc quyết định – không phụ thuộc giao diện
  packages/templates/  # mẫu biên bản, mẫu GCN (dạng dữ liệu + HTML)
  supabase/migrations/ # lược đồ CSDL, RLS, hàm nghiệp vụ, cron
  supabase/functions/  # phát hành GCN, ký số, hoá đơn điện tử, gửi thông báo
  docs/                # kế hoạch, đặc tả, hướng dẫn sử dụng
  tests/e2e/
```

## 7. Mô hình dữ liệu chính

```
chi_nhanh ─< nguoi_dung >─ vai_tro
khach_hang ─< dia_diem ─< thiet_bi_khach ─< lich_su_kiem_dinh (= phieu_cong_viec)
khach_hang ─< bao_gia ─< dong_bao_gia
khach_hang ─< don_hang ─< phieu_cong_viec >─ thiet_bi_khach
phieu_cong_viec >─ quy_trinh_phien_ban, mau_bien_ban_phien_ban
phieu_cong_viec ─< so_lieu_do (JSON theo mẫu), ket_qua, ngan_sach_dkdbd
phieu_cong_viec >─< chuan_su_dung >─ chuan   (lưu cả hạn hiệu chuẩn tại thời điểm dùng)
phieu_cong_viec ─< giay_chung_nhan (phiên bản; trạng thái: hiệu lực / bị thay thế / thu hồi)
giay_chung_nhan ─< tem (số tem, trạng thái)
chuan ─< hieu_chuan_chuan, kiem_tra_giua_ky, bao_tri, su_co
nguoi_dung ─< chung_chi, uy_quyen (lĩnh vực, phạm vi, vai trò: làm / soát / ký, hiệu lực)
don_hang ─< hoa_don ─< thanh_toan
tai_lieu ─< tai_lieu_phien_ban
su_khong_phu_hop ─< capa;  khieu_nai;  danh_gia_noi_bo ─< phat_hien;  pt_ilc;  rui_ro
thong_bao;  nhat_ky_kiem_toan;  tep_dinh_kem
```

Nguyên tắc dữ liệu:
- Không xoá cứng hồ sơ kỹ thuật, chỉ đổi trạng thái.
- Mọi bản ghi phát hành ra ngoài đều **bất biến** và lưu "ảnh chụp" toàn bộ dữ liệu tại thời điểm phát hành, gồm phiên bản quy trình, chuẩn, hạn chuẩn và người ký.

## 8. Quy tắc nghiệp vụ cứng (hệ thống chặn, không chỉ nhắc)

1. Không chọn được chuẩn đã quá hạn hiệu chuẩn, đang hỏng hoặc không đúng phạm vi.
2. Người thực hiện phải có ủy quyền còn hiệu lực cho lĩnh vực đó. Người soát xét khác người thực hiện. Người ký có quyền ký lĩnh vực đó.
3. Không phát hành GCN khi biên bản còn thiếu số liệu bắt buộc, điều kiện môi trường ngoài giới hạn hoặc kết quả tính lại trên máy chủ lệch với trên máy.
4. Số GCN và số tem cấp liên tục trong giao dịch CSDL, không trùng. Huỷ số phải ghi lý do.
5. GCN đã phát hành không sửa được, chỉ thay thế hoặc thu hồi được.
6. Việc ngoài phạm vi chỉ định hoặc công nhận vẫn làm được, nhưng GCN tự bỏ dấu và logo công nhận, kèm cảnh báo.
7. Ngày hết hạn kiểm định tính theo chu kỳ pháp định. Với hiệu chuẩn, chỉ ghi ngày lần sau khi khách yêu cầu.

## 9. Lộ trình triển khai

Ước lượng cho 1–2 lập trình viên làm cùng Claude Code. Mỗi giai đoạn kết thúc bằng một bản chạy thật cho người dùng thử.

| Giai đoạn | Thời gian | Nội dung | Kết quả nghiệm thu |
|---|---|---|---|
| **0. Khảo sát** | 2 tuần | Phỏng vấn từng bộ phận; thu thập mọi mẫu biểu hiện dùng (phiếu tiếp nhận, biên bản Excel, mẫu GCN, sổ tem, báo cáo gửi cơ quan); đối chiếu căn cứ pháp lý; đo số liệu hiện trạng (TAT, số GCN mỗi tháng); chọn 3–5 lĩnh vực làm trước | Bản đặc tả được duyệt; danh sách mẫu biểu; thiết kế giao diện các màn hình chính |
| **1. Lõi vận hành (MVP)** | 8–10 tuần | Đăng nhập, phân quyền, chi nhánh; khách hàng, thiết bị khách; danh mục kỹ thuật; đơn hàng; tiếp nhận có mã QR; phân công Kanban; biên bản dạng form đơn giản hoặc đính kèm Excel; soát xét, phê duyệt; phát hành GCN PDF có QR tra cứu; đánh số GCN và tem; nhắc đến hạn; dashboard cơ bản; nhật ký kiểm toán; nhập dữ liệu cũ từ Excel | Một phòng thí nghiệm chạy song song với cách làm cũ trong 2 tuần, không lỗi GCN |
| **2. Kỹ thuật và tiền** | 6–8 tuần | Mẫu biên bản có công thức và ngân sách ĐKĐBĐ cho các lĩnh vực ưu tiên; quản lý chuẩn đầy đủ (khoá chuẩn quá hạn, phân tích ảnh hưởng); năng lực và ủy quyền; hiện trường offline; báo giá và hợp đồng; hoá đơn điện tử; công nợ; báo cáo vận hành, kinh doanh, tài chính | Bỏ hoàn toàn biên bản Excel ở các lĩnh vực ưu tiên; kế toán xuất hoá đơn từ phần mềm |
| **3. Chất lượng và khách hàng** | 6 tuần | Phân hệ ISO/IEC 17025 (tài liệu, NC/CAPA, khiếu nại, PT/ILC, đánh giá nội bộ, xem xét lãnh đạo, rủi ro); cổng khách hàng; ký số GCN; báo cáo gửi cơ quan quản lý; Zalo OA; khảo sát hài lòng; tích hợp `Checkin` | Qua một đợt đánh giá nội bộ hoàn toàn trên phần mềm |
| **4. Mở rộng** | liên tục | Số hoá các lĩnh vực còn lại; đọc số trực tiếp từ thiết bị (Web Serial); thiết bị ghi môi trường tự đẩy dữ liệu; ứng dụng di động cho khách; dự báo nhu cầu; trợ lý AI soát lỗi biên bản | Theo ưu tiên từng quý |

Tổng thời gian đến khi dùng đầy đủ: khoảng **5–6 tháng**.

## 10. Chuyển đổi dữ liệu và đưa vào sử dụng

- Nhập dữ liệu cũ: khách hàng, thiết bị khách và lịch sử GCN gần nhất (để có hạn kế tiếp), chuẩn, nhân sự và chứng chỉ, công nợ đầu kỳ. Mỗi loại có mẫu Excel riêng và có bước kiểm tra lỗi trước khi nhập.
- Chạy song song với cách làm cũ trong một kỳ, sau đó chuyển hẳn từng lĩnh vực một.
- Đào tạo theo vai trò. Có video ngắn và tài liệu hướng dẫn ngay trong app.
- Có người "đầu mối" ở mỗi bộ phận để gom góp ý hằng tuần.

## 11. Yêu cầu phi chức năng

- **Bảo mật**: RLS trên mọi bảng; tài khoản ký duyệt bắt buộc xác thực hai lớp; file GCN lưu riêng tư, chỉ chia sẻ qua liên kết có hạn; tuân thủ NĐ 13/2023 và Luật Bảo vệ dữ liệu cá nhân 2025.
- **Toàn vẹn dữ liệu**: nhật ký kiểm toán không sửa được; mã băm cho GCN; đồng hồ máy chủ là nguồn thời gian duy nhất.
- **Hiệu năng**: danh sách 100.000 thiết bị khách vẫn lọc dưới 1 giây; phát hành GCN dưới 5 giây.
- **Sẵn sàng**: sao lưu hằng ngày, khôi phục theo thời điểm, kiểm tra khôi phục mỗi quý.
- **Giao diện**: tiếng Việt, có in song ngữ; dùng tốt trên máy tính bảng (vùng bấm ≥ 44px); tương phản chữ ≥ 4.5:1.

## 12. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Mỗi quy trình đo có cách tính khác nhau, số hoá chậm | Giai đoạn 1 cho phép đính kèm Excel; số hoá dần theo lĩnh vực có nhiều việc nhất |
| Sai công thức dẫn tới GCN sai | Bộ máy tính toán tách riêng, có kiểm thử với số liệu thật đã phát hành; mẫu biên bản mới phải được duyệt; máy chủ tính lại trước khi phát hành |
| Kỹ thuật viên ngại thay đổi | Giao diện nhập liệu nhanh hơn Excel; quét QR thay vì gõ; làm cùng người dùng ngay từ giai đoạn 0 |
| Văn bản pháp luật thay đổi | Mẫu biểu, chu kỳ và danh mục đều là cấu hình, không viết cứng |
| Mạng yếu ở hiện trường | Chế độ offline, đồng bộ sau |
| Phụ thuộc nhà cung cấp hoá đơn, ký số | Gói tích hợp thành một lớp riêng để đổi nhà cung cấp mà không sửa phần còn lại |

## 13. Câu hỏi cần chủ doanh nghiệp trả lời (đầu vào giai đoạn 0)

1. Công ty làm những loại nào: kiểm định đo lường, hiệu chuẩn, kiểm định an toàn, thử nghiệm? Những lĩnh vực đo nào chiếm nhiều việc nhất?
2. Đã được công nhận ISO/IEC 17025 (VILAS) và được chỉ định kiểm định chưa? Phạm vi gồm những gì?
3. Quy mô: số nhân sự, số chi nhánh hoặc phòng thí nghiệm, số GCN mỗi tháng, tỷ lệ việc tại hiện trường so với tại phòng thí nghiệm?
4. Hiện đang quản lý bằng gì (Excel, phần mềm cũ)? Có cần chuyển dữ liệu lịch sử bao nhiêu năm?
5. Đang dùng phần mềm kế toán, nhà cung cấp hoá đơn điện tử và chữ ký số nào?
6. Muốn đặt máy chủ trên đám mây (Supabase) hay máy chủ riêng tại công ty hoặc ở Việt Nam?
7. Có muốn dùng chung tài khoản và nhân sự với app chấm công `Checkin` không?
8. Có hạn chót nào cần chú ý, ví dụ đợt đánh giá VILAS sắp tới?

# Dung lượng và giới hạn – bao lâu thì đầy?

Số liệu **đo thật** bằng kiểm thử `tests/unit/storage.test.ts`. Kiểm thử này chạy trọn vòng đời 60 phiếu (tiếp nhận, phân công, nhập biên bản, nộp, soát xét, phát hành GCN, trả thiết bị, thu tiền) kèm 600 tin nhắn. Nó chạy trên SQLite với đúng lược đồ và chỉ mục của D1, rồi so kích thước tệp trước và sau. Công thức dự báo trong app khớp mức tăng đo được với sai lệch dưới 10 %.

## Một phiếu chiếm bao nhiêu

| Thành phần | Mỗi phiếu (dữ liệu JSON) |
|---|---|
| Phiếu (số liệu biên bản, lịch sử bước) | ~3,9 KB |
| Giấy chứng nhận (bản chụp nội dung in) | ~4,0 KB |
| Nhật ký thao tác (8 bước, chỉ trường đổi) | ~6,1 KB |
| Thông báo | ~2,0 KB |
| Đơn hàng | ~0,4 KB |
| **Cộng** | **~14 KB**, tức **~33 KB trên đĩa** khi tính chỉ mục và trang (hệ số ~2,4) |
| Một tin nhắn chat | ~0,25 KB, tức ~0,6 KB trên đĩa |

Trước khi tối ưu, nhật ký chép lại cả phiếu kèm số liệu ở mỗi bước (42 KB mỗi phiếu, 85 % dung lượng). Nay nhật ký chỉ ghi các trường thực sự đổi (vẫn đủ "ai, lúc nào, trước, sau"), nên mỗi phiếu giảm từ ~84 KB xuống ~33–41 KB.

## Bao lâu thì đầy

D1 gói **miễn phí: 500 MB mỗi CSDL**. Gói **trả phí (5 USD/tháng): 10 GB mỗi CSDL**.

| Nhịp làm việc | Tăng mỗi tháng | Miễn phí (500 MB) | Trả phí (10 GB) |
|---|---|---|---|
| 150 phiếu/tháng, 50 tin/ngày | ~6 MB | ~7 năm | > 100 năm |
| 300 phiếu/tháng, 100 tin/ngày | ~12 MB | ~3,5 năm | ~70 năm |
| 1.000 phiếu/tháng, 300 tin/ngày | ~39 MB | ~13 tháng | ~22 năm |
| 3.000 phiếu/tháng, 1.000 tin/ngày | ~117 MB | ~4 tháng | ~7 năm |

Màn hình **Cài đặt → Dung lượng dữ liệu** đo trên CSDL thật: kích thước hiện tại, số dòng và dung lượng từng bảng, mức tăng 30 ngày qua. Bạn nhập số phiếu mỗi tháng, số tin nhắn mỗi ngày và chọn gói để xem dự báo ngay.

## Giới hạn sẽ chạm trước: số dòng đọc

Gói miễn phí cho **5 triệu dòng đọc mỗi ngày**. Danh sách phiếu và trang Tổng quan đọc toàn bộ phiếu mỗi lần mở. Ví dụ với 7.000 phiếu (sau khoảng 2 năm ở nhịp 300 phiếu/tháng), mỗi lần mở trang tốn khoảng 7.000 dòng đọc. Vì vậy chỉ được khoảng 600–700 lần mở trang mỗi ngày cho cả công ty.

- Trước đây trình duyệt tự tải lại mỗi 30 giây. Với 10 người, việc này tốn khoảng 70 triệu dòng đọc mỗi ngày, vượt giới hạn rất xa. Nay đồng bộ thời gian thực thay cho việc hỏi định kỳ, và trang chỉ tải lại **đúng bảng vừa đổi** khi có người thao tác.
- Nhật ký thao tác chỉ đọc 2.000 dòng mới nhất. Tin nhắn đọc theo trang 50 tin, có chỉ mục riêng.
- **Khuyến nghị:** dùng gói miễn phí khi dưới khoảng 3.000 phiếu hoặc dưới 5 người dùng đồng thời. Khi dùng thật lâu dài, chuyển sang Workers Paid (5 USD/tháng: 25 tỉ dòng đọc mỗi tháng, 10 GB), không cần đổi mã.

## Các dịch vụ khác

- **Durable Object "Hub"** (đồng bộ thời gian thực, ai đang online): gói miễn phí có 100.000 yêu cầu mỗi ngày. Mỗi thao tác ghi tốn 1–2 yêu cầu, mỗi lần mở app tốn 1 yêu cầu. Ping giữ kết nối được trả lời tự động nên không tính. Hub ngủ khi không có sự kiện, gần như không tốn tài nguyên.
- **Email (Brevo miễn phí):** 300 thư mỗi ngày. Mỗi thao tác gửi tối đa 20 thư.

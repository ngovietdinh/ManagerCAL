# Triển khai ManagerCAL lên Cloudflare (Worker + D1)

Một Cloudflare Worker phục vụ cả giao diện lẫn API; dữ liệu lưu trong **Cloudflare D1** (SQLite trên mạng Cloudflare). Mọi người trong công ty đăng nhập bằng email + mật khẩu và dùng chung dữ liệu.

```
Trình duyệt ──► Worker "managercal" ──► /api/*  → API (worker/api.ts) ──► D1 "managercal"
                                    └─► còn lại → tệp tĩnh dist/ (giao diện)
```

## Dữ liệu lưu ở đâu

| Thứ | Nơi lưu |
|---|---|
| Khách hàng, thiết bị, đơn, phiếu, biên bản, GCN, tem, chuẩn, nhân sự, nhật ký | D1, bảng `rows` (mỗi bản ghi là một tài liệu JSON) |
| Bộ đếm số GCN, mã đơn | D1, bảng `sequences` |
| Mật khẩu (băm PBKDF2-SHA256), phiên đăng nhập | D1, bảng `auth_passwords`, `auth_sessions` – tách khỏi dữ liệu nghiệp vụ, không API nào trả ra |

Quy tắc nghiệp vụ (ủy quyền, chuẩn quá hạn, người soát xét khác người làm, số GCN không trùng…) chạy **trên máy chủ**: máy khách chỉ gửi yêu cầu, Worker chạy lớp `Services` với đúng người dùng của phiên. Mỗi thao tác ghi là **một giao dịch** (ghi hết hoặc không ghi gì).

## Bản đang chạy

- Địa chỉ: **https://managercal.gsnvbu.workers.dev**
- CSDL D1: `managercal` (id `5ff54f86-c6fe-4cc0-90c9-63003caf8875`, vùng APAC), đã áp lược đồ `0001_init.sql`.
- Đã kiểm tra trên Cloudflare thật (06/11/2026): khởi tạo kèm dữ liệu mẫu, đăng nhập (không vượt CPU), đọc dữ liệu, gọi nghiệp vụ. Dữ liệu thử đã xoá, hệ thống đang ở màn **Khởi tạo hệ thống**.

## Lần đầu

1. **Token Cloudflare**: dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom token, quyền:
   - Account → **Workers Scripts → Edit**
   - Account → **D1 → Edit**
   - (Account → Account Settings → Read, để wrangler đọc được tài khoản)

   Đặt vào biến môi trường `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` (hoặc chạy `npx wrangler login`).
2. `npm install`
3. `npm run cf:setup` – tạo CSDL D1 `managercal` (vùng APAC) và ghi `database_id` vào `wrangler.jsonc`.
4. `npm run deploy` – build giao diện, áp lược đồ (`migrations/`) lên D1, đưa Worker lên. Kết quả: `https://managercal.<tên-tài-khoản>.workers.dev`.
5. Mở địa chỉ đó → màn **Khởi tạo hệ thống**: nhập tên công ty, tài khoản quản trị (có thể chọn nạp dữ liệu mẫu để dùng thử).
6. Vào **Nhân sự, ủy quyền** thêm nhân viên → hệ thống hỏi đặt mật khẩu cho từng người → giao email + mật khẩu cho họ.

Gắn tên miền riêng: Cloudflare dashboard → Workers → managercal → Settings → Domains & Routes.

## Cập nhật phiên bản

`npm run deploy` (lược đồ mới trong `migrations/` tự áp; dữ liệu giữ nguyên).

**Cách dự phòng – `npm run deploy:embedded`**: gói giao diện vào thẳng mã Worker (không dùng tính năng tệp tĩnh của Cloudflare). Dùng khi `npm run deploy` lỗi ở bước tải tệp (`assets/upload … 401`), vd. chạy sau một proxy ghi đè header Authorization. Bản đang chạy được đưa lên bằng cách này. Giới hạn: mã Worker sau nén ≤ 3 MB (gói miễn phí); hiện khoảng 630 KB.

## Quên mật khẩu

| Ai quên | Cách lấy lại |
|---|---|
| Nhân viên | Quản trị vào **Nhân sự, ủy quyền → Mật khẩu** ở dòng người đó, đặt mật khẩu mới. Người đó bị đăng xuất khỏi mọi máy. |
| Quản trị (không ai khác đặt lại được) | Chạy trên máy có quyền vào tài khoản Cloudflare: `npm run reset-password -- email@congty.vn`. Lệnh in ra mật khẩu tạm; đăng nhập rồi đổi ngay (bấm ảnh đại diện → Đổi mật khẩu). Muốn tự chọn: `npm run reset-password -- email@congty.vn MatKhauMoi`. |

Nên có ít nhất **hai người có vai trò Quản trị** để không phụ thuộc vào cách thứ hai.
Đăng nhập sai 8 lần liên tiếp sẽ bị khoá 15 phút; đặt lại mật khẩu bằng lệnh trên cũng gỡ khoá này.

## Sao lưu

- Trong app: **Cài đặt → Dữ liệu → Sao lưu (tải JSON)** (quản trị). Khôi phục từ tệp cũng ở đó; mật khẩu không nằm trong tệp sao lưu và được giữ nguyên.
- D1 có **Time Travel**: khôi phục CSDL về một thời điểm bất kỳ trong 30 ngày: `npx wrangler d1 time-travel restore managercal --timestamp=<ISO>`.

## Gói miễn phí hay trả phí

| | Workers Free | Workers Paid (5 USD/tháng) |
|---|---|---|
| Lượt gọi | 100.000/ngày | 10 triệu/tháng |
| CPU mỗi lượt | 10 ms | 30 giây |
| D1 | 5 GB, 5 triệu dòng đọc/ngày | 5 GB+, 25 tỷ dòng đọc/tháng |
| Truy vấn D1 mỗi lượt | 50 | 1.000 |

App đã được thiết kế để mọi thao tác dùng ≤ 25 truy vấn D1 (đã kiểm thử: đơn 40 thiết bị 12 truy vấn, phát hành GCN 21, nhập 2.000 tem 6).
Băm mật khẩu tốn ~30 ms CPU: nếu đăng nhập trên gói Free báo lỗi vượt CPU, giảm `PBKDF2_ITERATIONS` trong `wrangler.jsonc` (vd. 20000) rồi deploy lại, hoặc dùng gói Paid (khuyên dùng khi chạy thật).

## Đồng bộ thời gian thực, ai đang online

Worker có thêm Durable Object `Hub` (khai báo trong `wrangler.jsonc`, loại SQLite, có trong gói miễn phí). Trình duyệt mở WebSocket tới `/api/ws`. Sau mỗi thao tác ghi, máy chủ báo tên các bảng vừa đổi, và trang đang mở chỉ tải lại phần đó. Tin nhắn riêng chỉ báo cho hai người trong cuộc. Khi mất mạng, app tự nối lại và trong lúc chờ thì hỏi lại 30 giây một lần. Không cần cấu hình thêm: `npm run deploy:embedded` tạo Hub ở lần đầu.

## Email thông báo

Gửi khi được phân công, khi có phiếu chờ soát xét hoặc chờ ký, khi phiếu bị trả lại, khi có đơn mới chờ phân công, và khi đồng nghiệp nhờ việc trong chat. Quản trị cấu hình ở **Cài đặt → Email thông báo**:

1. Đăng ký **Brevo** (brevo.com, miễn phí 300 thư/ngày). Không cần tên miền riêng, chỉ cần xác minh một địa chỉ gửi, ví dụ Gmail của công ty, ở mục Senders.
2. Vào SMTP & API → API Keys, tạo khoá rồi dán vào app. Điền email người gửi đã xác minh, Lưu, rồi bấm **Gửi thư thử cho tôi**.
3. Hoặc dùng **Resend** nếu công ty có tên miền riêng đã xác minh.

Khoá API lưu trong bảng `app_secrets` của D1. Bảng này chỉ máy chủ đọc: không trả về giao diện, không nằm trong tệp sao lưu. Có thể đặt bằng biến môi trường thay cho giao diện: `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, và `npx wrangler secret put EMAIL_API_KEY`.

## Dung lượng

Xem [DUNG_LUONG.md](DUNG_LUONG.md): mỗi phiếu khoảng 33 KB. Gói miễn phí 500 MB đủ khoảng 3,5 năm ở nhịp 300 phiếu/tháng. Giới hạn số dòng đọc mỗi ngày sẽ chạm trước dung lượng.

## Chạy thử tại máy (không cần tài khoản Cloudflare)

- `npm run dev:cf` – Worker + D1 giả lập tại `http://localhost:8787` (dữ liệu ở `.wrangler/`).
- `npm run test:e2e:server` – kiểm thử trình duyệt chế độ máy chủ (khởi tạo, đăng nhập, luồng 3 người, tra cứu, đặt mật khẩu).
- `npm run dev` – chỉ giao diện, chế độ demo (dữ liệu trong trình duyệt).

## Hosting tĩnh (R2, Pages) không có Worker

Bản `dist/` đặt ở bất kỳ hosting tĩnh nào vẫn chạy, nhưng **ở chế độ demo**: không có API nên dữ liệu chỉ nằm trong trình duyệt từng máy.

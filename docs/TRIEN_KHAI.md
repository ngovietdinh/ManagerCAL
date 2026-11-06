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

## Chạy thử tại máy (không cần tài khoản Cloudflare)

- `npm run dev:cf` – Worker + D1 giả lập tại `http://localhost:8787` (dữ liệu ở `.wrangler/`).
- `npm run test:e2e:server` – kiểm thử trình duyệt chế độ máy chủ (khởi tạo, đăng nhập, luồng 3 người, tra cứu, đặt mật khẩu).
- `npm run dev` – chỉ giao diện, chế độ demo (dữ liệu trong trình duyệt).

## Hosting tĩnh (R2, Pages) không có Worker

Bản `dist/` đặt ở bất kỳ hosting tĩnh nào vẫn chạy, nhưng **ở chế độ demo**: không có API nên dữ liệu chỉ nằm trong trình duyệt từng máy.

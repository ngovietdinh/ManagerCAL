# Triển khai ManagerCAL lên máy chủ (Supabase + Vercel)

Bản hiện tại chạy **chế độ demo** (dữ liệu trong trình duyệt). Tài liệu này hướng dẫn chuẩn bị máy chủ để chuyển sang **chế độ máy chủ**: nhiều người dùng chung một CSDL PostgreSQL trên Supabase, phân quyền bằng Row Level Security (RLS). Phần máy chủ đã viết xong và kiểm thử được trên PostgreSQL cục bộ (`scripts/test-sql.sh`); phần bật trong app còn vài việc, xem mục 6.

## 1. Tạo dự án Supabase

1. Vào https://supabase.com → **New project**. Nên tạo dự án **riêng** cho ManagerCAL (không dùng chung với app Chấm công), đặt tên ví dụ `managercal`, vùng Singapore (gần Việt Nam nhất). Ghi lại mật khẩu CSDL.
2. Trong **Project Settings → API** lấy hai giá trị: `Project URL` và `anon public key`.

## 2. Chạy migration (tạo bảng, RLS)

Hai tệp trong `supabase/migrations/`:

| Tệp | Nội dung |
|---|---|
| `20261106000001_schema.sql` | Bảng khớp 1-1 với `src/lib/types.ts`, khoá ngoại, chỉ mục, bộ đếm `next_sequence`, hàm `app.current_user()`, `app.has_role()` |
| `20261106000002_security.sql` | Bật RLS mọi bảng, ma trận quyền `app.can()` (giống `src/lib/perm.ts`), chính sách đọc/ghi từng bảng, hàm tra cứu công khai `lookup_certificate` |

Cách A – Supabase CLI (khuyên dùng):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # ref nằm trong Project URL
npx supabase db push
```

Cách B – psql trực tiếp (chuỗi kết nối ở Project Settings → Database):

```bash
psql "postgresql://postgres:<mật khẩu>@db.<ref>.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/migrations/20261106000001_schema.sql \
  -f supabase/migrations/20261106000002_security.sql
```

Kiểm tra trước ở máy mình (không cần Docker, cần PostgreSQL 16 cài sẵn): `bash scripts/test-sql.sh` – dựng cụm tạm, giả lập `auth.uid()`, chạy migration và các câu kiểm tra RLS.

## 3. Nạp danh mục và tạo tài khoản đầu tiên

1. **Tài khoản đăng nhập**: Supabase Dashboard → **Authentication → Users → Add user** (email + mật khẩu, tick *Auto confirm*). Chép `UUID` của user vừa tạo.
2. **Hồ sơ nhân viên** gắn với tài khoản đó (SQL Editor, dùng role `postgres` nên bỏ qua RLS):

```sql
insert into public.settings (id) values ('1') on conflict do nothing;
insert into public.users (id, auth_id, code, full_name, email, roles, title)
values ('u-admin', '<UUID vừa chép>', 'NV01', 'Nguyễn Văn An', 'an@congty.vn', '{admin,director,signer}', 'Giám đốc');
```

3. **Danh mục kỹ thuật** (lĩnh vực, loại PTĐ, quy trình kèm mẫu biên bản) có sẵn trong `src/lib/seed/catalog.ts`. Cách nhanh nhất: chạy app ở chế độ demo, vào Cài đặt → xuất dữ liệu (khi màn hình đó có), rồi nhập các bảng `fields`, `procedures`, `instrument_types` bằng Table Editor → Import CSV/JSON; hoặc viết tạm một script Node dùng `SupabaseRepo.insert` với `service_role` key (không bao giờ đưa key này lên trình duyệt).
4. Mỗi nhân viên mới: tạo user ở Authentication rồi thêm dòng `users` có `auth_id` tương ứng, hoặc để admin làm trong màn hình Nhân sự khi app đã có chức năng mời người dùng (xem mục 6).

## 4. Điền cấu hình app

Sửa `public/config.js` (bản build: `dist/config.js`, không cần build lại):

```js
window.APP_CONFIG = {
  supabaseUrl: "https://<ref>.supabase.co",
  supabaseAnonKey: "<anon public key>",
};
```

Để trống cả hai → app quay về chế độ demo. Key `anon` an toàn để công khai vì RLS chặn mọi truy cập của khách; chỉ hàm `lookup_certificate` (tra cứu GCN theo mã QR) cho `anon` gọi.

## 5. Deploy lên Vercel (giống app Chấm công)

1. Đẩy mã lên GitHub, vào https://vercel.com → **Add New → Project** → chọn repo `ManagerCAL`. Vercel đọc `vercel.json` (framework Vite, `npm run build`, thư mục `dist`).
2. Trong **Environment Variables** đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` (thay cho việc sửa `config.js`), rồi Deploy.
3. Thêm tên miền riêng nếu có. `config.js`, `sw.js`, `index.html` đã đặt `no-cache` nên đổi cấu hình là có hiệu lực ngay.
4. Trong Supabase → **Authentication → URL Configuration** thêm tên miền Vercel vào *Site URL / Redirect URLs*.

Muốn tự chủ hạ tầng: Supabase tự host trên VPS theo cách của `Checkin/deploy/vps` – migration dùng PostgreSQL chuẩn nên chạy y nguyên.

## 6. Việc còn lại để bật chế độ máy chủ trong app

Phần máy chủ đã sẵn; phần client còn các việc sau (ước lượng 1–2 ngày):

1. **`src/app/data.tsx`**: khi `isServerMode` (trong `src/lib/config.ts`) thì tạo `new SupabaseRepo()` thay vì `LocalRepo`; bỏ bước nạp demo; `me` lấy từ `getMyProfile(authId)` qua `onAuthChange` (`src/lib/store/supabaseAuth.ts`); `login(email, password)` gọi `signIn`.
2. **`src/pages/Login.tsx`**: ở chế độ máy chủ hiện form email + mật khẩu thay vì danh sách người demo.
3. **Trang tra cứu công khai** (`/lookup`): chế độ máy chủ gọi `supabase.rpc("lookup_certificate", { p_number })` thay vì đọc bảng (khách chưa đăng nhập không đọc được bảng).
4. **Nhân sự**: màn hình mời người dùng (tạo auth user) cần Edge Function dùng `service_role` giống `Checkin/supabase/functions/admin-users`; tạm thời làm tay ở Dashboard như mục 3.
5. **Chuyển quy tắc nghiệp vụ sang SQL** (giai đoạn 2, để không ai lách được bằng cách gọi API trực tiếp): viết các hàm `security definer` `assign_job`, `submit_job`, `review_job`, `issue_certificate`, `replace_certificate`, `revoke_certificate` lặp lại kiểm tra trong `src/lib/services/index.ts`; sau đó siết policy `jobs_update`, `cert_insert/cert_update`, `devices_sign_update`, `seals_sign_update` thành chỉ cho các hàm đó ghi. Bộ máy tính sai số có thể giữ ở client nhưng máy chủ tính lại (đã có `evaluate`/`sameResult`) hoặc chuyển thành hàm PL/pgSQL.
6. **Nhắc việc hằng ngày** (`runDailyChecks`): chuyển thành `pg_cron` + hàm SQL như `Checkin/supabase/migrations/20261015000005_cron.sql` để chạy cả khi không ai mở app; gửi Web Push/Email/Zalo qua Edge Function.
7. **Tệp đính kèm** (ảnh tiếp nhận, GCN PDF): bucket Storage riêng tư + policy theo `app.can()`.
8. **Sao lưu**: Supabase Pro có Point-in-time recovery; gói Free cần `pg_dump` theo lịch (xem `Checkin/scripts/db-export.sh`).

## 7. Ghi chú bảo mật

- Không bao giờ đưa `service_role` key vào `config.js` hay mã client.
- Tài khoản có quyền ký (`signer`) nên bật xác thực hai lớp trong Supabase Auth (TOTP) khi app hỗ trợ.
- `audit_logs` chỉ `admin`, `qa`, `director` đọc được; không ai sửa hay xoá được qua API.

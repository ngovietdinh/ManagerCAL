-- =============================================================================
-- MANAGERCAL – BẢO MẬT: Row Level Security, quyền gọi hàm, tra cứu công khai
--
-- Ma trận quyền app.can() lặp lại MATRIX trong src/lib/perm.ts – sửa một nơi
-- thì sửa nơi kia. Quy tắc nghiệp vụ chi tiết (ủy quyền theo lĩnh vực, người
-- soát xét khác người làm, chuẩn còn hạn, đánh số GCN...) hiện chạy ở lớp
-- Services phía client; giai đoạn 2 chuyển thành hàm SQL security definer và
-- siết policy jobs/certificates xuống chỉ cho các hàm đó ghi.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ma trận quyền (giống src/lib/perm.ts)
-- ---------------------------------------------------------------------------
create or replace function app.role_actions(p_role text)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'admin'      then array['customers','orders','assign','perform','review','sign','catalog','standards','users','seals','reports','finance','settings','audit']
    when 'director'   then array['reports','settings','audit','assign']
    when 'sales'      then array['customers','orders','reports']
    when 'intake'     then array['customers','orders','assign']
    when 'technician' then array['perform']
    when 'reviewer'   then array['review','perform']
    when 'signer'     then array['sign','review','assign','seals','reports']
    when 'qa'         then array['catalog','standards','users','seals','audit','reports','assign']
    when 'accountant' then array['finance','reports','customers']
    else array[]::text[]
  end;
$$;

create or replace function app.can(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select bool_or(p_action = any(app.role_actions(r)))
    from public.users u, unnest(u.roles) as r
    where u.auth_id = auth.uid() and u.active
  ), false);
$$;

-- Đã đăng nhập và có hồ sơ nhân viên đang hoạt động
create or replace function app.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users u where u.auth_id = auth.uid() and u.active);
$$;

-- id (text) của người dùng hiện tại trong bảng users
create or replace function app.uid_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.users u where u.auth_id = auth.uid() and u.active limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm, quyền bảng: khách (anon) không có gì
-- ---------------------------------------------------------------------------
revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated, service_role;
revoke all on all tables in schema app from public, anon, authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- sequences chỉ đổi qua hàm next_sequence
revoke insert, update, delete on public.sequences from authenticated;

-- Bật RLS mọi bảng public
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Đọc: mọi thành viên đọc được mọi bảng, trừ audit_logs và notifications
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'settings','branches','users','fields','procedures','instrument_types','authorizations','standards',
    'customers','devices','orders','jobs','certificates','seal_batches','seals','sequences'
  ] loop
    execute format('create policy read_members on public.%I for select to authenticated using (app.is_member())', t);
  end loop;
end $$;

create policy read_audit on public.audit_logs for select to authenticated
  using (app.can('audit'));

create policy read_own on public.notifications for select to authenticated
  using (app.is_member() and (user_id is null or user_id = app.uid_text()));

-- ---------------------------------------------------------------------------
-- Ghi: theo ma trận quyền
-- ---------------------------------------------------------------------------
-- bảng → action
do $$
declare r record;
begin
  for r in select * from (values
    ('customers', 'customers'), ('devices', 'customers'),
    ('orders', 'orders'),
    ('standards', 'standards'),
    ('users', 'users'), ('authorizations', 'users'),
    ('fields', 'catalog'), ('instrument_types', 'catalog'), ('procedures', 'catalog'), ('branches', 'catalog'),
    ('settings', 'settings'),
    ('seal_batches', 'seals')
  ) as v(tbl, act) loop
    execute format('create policy write_%s on public.%I for all to authenticated using (app.can(%L)) with check (app.can(%L))', r.act, r.tbl, r.act, r.act);
  end loop;
end $$;

-- orders: kế toán được đánh dấu đã thu tiền
create policy finance_update on public.orders for update to authenticated
  using (app.can('finance')) with check (app.can('finance'));

-- jobs: tiếp nhận tạo; phân công / thực hiện / soát xét / ký được cập nhật.
-- Lưu ý: quy tắc chi tiết theo trạng thái chạy ở Services (client), giai đoạn 2 chuyển vào SQL.
create policy jobs_insert on public.jobs for insert to authenticated
  with check (app.can('orders'));
create policy jobs_update on public.jobs for update to authenticated
  using (app.can('assign') or app.can('perform') or app.can('review') or app.can('sign') or app.can('orders'))
  with check (app.can('assign') or app.can('perform') or app.can('review') or app.can('sign') or app.can('orders'));
create policy jobs_delete on public.jobs for delete to authenticated
  using (app.can('assign'));

-- certificates: chỉ người ký; không bao giờ xoá
create policy cert_insert on public.certificates for insert to authenticated
  with check (app.can('sign'));
create policy cert_update on public.certificates for update to authenticated
  using (app.can('sign')) with check (app.can('sign'));

-- devices: người ký cập nhật hạn kế tiếp / GCN gần nhất khi phát hành
create policy devices_sign_update on public.devices for update to authenticated
  using (app.can('sign')) with check (app.can('sign'));

-- seals: quản lý tem ghi đủ; người ký chỉ cập nhật (đánh dấu đã dùng)
create policy seals_write on public.seals for all to authenticated
  using (app.can('seals')) with check (app.can('seals'));
create policy seals_sign_update on public.seals for update to authenticated
  using (app.can('sign')) with check (app.can('sign'));

-- audit_logs: ai cũng ghi được, không sửa, không xoá
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (app.is_member());

-- notifications: ai cũng gửi được; chỉ sửa (đánh dấu đã đọc) thông báo của mình
create policy noti_insert on public.notifications for insert to authenticated
  with check (app.is_member());
create policy noti_update_own on public.notifications for update to authenticated
  using (user_id = app.uid_text()) with check (user_id = app.uid_text());
create policy noti_delete_own on public.notifications for delete to authenticated
  using (user_id = app.uid_text());

-- ---------------------------------------------------------------------------
-- Tra cứu GCN công khai (mã QR trên giấy chứng nhận): khách được gọi, trả về tối thiểu
-- ---------------------------------------------------------------------------
create or replace function public.lookup_certificate(p_number text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'number', c.number,
    'kind', c.kind,
    'status', c.status,
    'issued_at', c.issued_at,
    'valid_to', c.valid_to,
    'replaced_by', (select r.number from public.certificates r where r.id = c.replaced_by_id),
    'device', c.snapshot -> 'device',
    'customer_name', c.snapshot -> 'customer' -> 'name',
    'company_name', c.snapshot -> 'company' -> 'name'
  )
  from public.certificates c
  where c.number = trim(p_number)
  limit 1;
$$;
grant execute on function public.lookup_certificate(text) to anon, authenticated, service_role;

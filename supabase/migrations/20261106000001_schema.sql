-- =============================================================================
-- MANAGERCAL – LƯỢC ĐỒ CSDL
-- Khớp 1-1 với src/lib/types.ts (interface Tables). Chỉ dùng PostgreSQL chuẩn
-- + auth.users/auth.uid() của Supabase, chạy được trên Supabase Cloud lẫn tự host.
-- id là text để nhận id do client sinh (LocalRepo/seed dùng "u-an", "d-1"...).
-- Các giá trị liệt kê dùng check constraint (không tạo enum) để dễ sửa về sau.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cài đặt (1 dòng)
-- ---------------------------------------------------------------------------
create table public.settings (
  id text primary key default '1' check (id = '1'),
  company jsonb not null default '{}'::jsonb,
  numbering jsonb not null default '{"certificate_pattern":"{SEQ:5}/{YY}/KĐ-{BR}","reset":"year"}'::jsonb,
  reminders jsonb not null default '{"due_days":[30,15,7],"standard_due_days":45,"card_due_days":60}'::jsonb,
  review jsonb not null default '{"checklist":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tổ chức, người dùng
-- ---------------------------------------------------------------------------
create table public.branches (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.users (
  id text primary key default gen_random_uuid()::text,
  auth_id uuid unique references auth.users(id) on delete set null,
  code text not null unique,
  full_name text not null,
  email text not null,
  phone text,
  roles text[] not null default '{}',
  branch_id text references public.branches(id) on delete set null,
  title text,
  inspector_card_no text,
  inspector_card_expiry date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint users_roles_check check (roles <@ array['admin','director','sales','intake','technician','reviewer','signer','qa','accountant']::text[])
);
create index users_auth_id_idx on public.users(auth_id);

-- ---------------------------------------------------------------------------
-- Danh mục kỹ thuật
-- ---------------------------------------------------------------------------
create table public.fields (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.procedures (
  id text primary key default gen_random_uuid()::text,
  code text not null,
  name text not null,
  version text not null,
  effective_from date not null,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  template jsonb not null default '{"env_limits":{},"sections":[]}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);
create index procedures_status_idx on public.procedures(status);

create table public.instrument_types (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  field_id text not null references public.fields(id),
  group2 boolean not null default true,
  cycle_months int not null check (cycle_months > 0),
  procedure_id text references public.procedures(id) on delete set null,
  default_price numeric(14,0) not null default 0,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index instrument_types_field_idx on public.instrument_types(field_id);

create table public.authorizations (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  field_id text not null references public.fields(id) on delete cascade,
  role text not null check (role in ('perform','review','sign')),
  decision_no text,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now()
);
create index authorizations_user_idx on public.authorizations(user_id, field_id, role);

create table public.standards (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  field_id text not null references public.fields(id),
  manufacturer text,
  model text,
  serial text,
  range_text text,
  accuracy_text text,
  cal_cert_no text,
  cal_by text,
  cal_date date,
  cal_due date,
  status text not null default 'ok' check (status in ('ok','locked','broken','retired')),
  branch_id text references public.branches(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index standards_status_idx on public.standards(status);
create index standards_cal_due_idx on public.standards(cal_due);

-- ---------------------------------------------------------------------------
-- Khách hàng, thiết bị của khách
-- ---------------------------------------------------------------------------
create table public.customers (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  tax_code text,
  address text,
  phone text,
  email text,
  contact_name text,
  contact_phone text,
  sales_user_id text references public.users(id) on delete set null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index customers_name_idx on public.customers(name);

create table public.devices (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  instrument_type_id text not null references public.instrument_types(id),
  name text not null,
  manufacturer text,
  model text,
  serial text,
  range_text text,
  resolution_text text,
  accuracy_class text,
  location text,
  customer_code text,
  next_due date,
  last_cert_id text,            -- FK thêm sau khi có bảng certificates
  last_result text check (last_result in ('pass','fail')),
  status text not null default 'active' check (status in ('active','retired')),
  note text,
  created_at timestamptz not null default now()
);
create index devices_customer_idx on public.devices(customer_id);
create index devices_next_due_idx on public.devices(next_due);
create index devices_status_idx on public.devices(status);

-- ---------------------------------------------------------------------------
-- Đơn hàng, phiếu công việc
-- ---------------------------------------------------------------------------
create table public.orders (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  customer_id text not null references public.customers(id),
  branch_id text references public.branches(id) on delete set null,
  received_at date not null,
  expected_at date,
  onsite boolean not null default false,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  received_by text not null references public.users(id),
  contact_name text,
  contact_phone text,
  total_amount numeric(14,0) not null default 0,
  paid boolean not null default false,
  paid_at date,
  note text,
  created_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id);
create index orders_status_idx on public.orders(status);
create index orders_received_at_idx on public.orders(received_at);

create table public.jobs (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  order_id text not null references public.orders(id) on delete cascade,
  customer_id text not null references public.customers(id),
  device_id text not null references public.devices(id),
  instrument_type_id text not null references public.instrument_types(id),
  procedure_id text references public.procedures(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  kind text not null default 'periodic' check (kind in ('initial','periodic','after_repair')),
  status text not null default 'received' check (status in ('received','assigned','in_progress','review','approval','issued','returned','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  due_date date,
  price numeric(14,0) not null default 0,
  intake jsonb not null default '{"condition":"","accessories":"","note":""}'::jsonb,
  assignee_id text references public.users(id) on delete set null,
  reviewer_id text references public.users(id) on delete set null,
  approver_id text references public.users(id) on delete set null,
  standard_ids text[] not null default '{}',
  env jsonb not null default '{"temp":null,"humidity":null,"pressure":null}'::jsonb,
  readings jsonb not null default '{}'::jsonb,
  result jsonb,
  conclusion text check (conclusion in ('pass','fail')),
  performed_at date,
  performed_note text,
  submitted_at timestamptz,
  review_note text,
  review_checks jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  approved_at timestamptz,
  return_reason text,
  cancel_reason text,
  certificate_id text,          -- FK thêm sau
  returned_at date,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index jobs_order_idx on public.jobs(order_id);
create index jobs_status_idx on public.jobs(status);
create index jobs_assignee_idx on public.jobs(assignee_id);
create index jobs_customer_idx on public.jobs(customer_id);
create index jobs_device_idx on public.jobs(device_id);
create index jobs_due_date_idx on public.jobs(due_date);

-- ---------------------------------------------------------------------------
-- Giấy chứng nhận, tem
-- ---------------------------------------------------------------------------
create table public.certificates (
  id text primary key default gen_random_uuid()::text,
  number text not null unique,
  kind text not null check (kind in ('certificate','fail_notice')),
  job_id text not null references public.jobs(id),
  device_id text not null references public.devices(id),
  customer_id text not null references public.customers(id),
  branch_id text references public.branches(id) on delete set null,
  issued_at date not null,
  valid_to date,
  signer_id text not null references public.users(id),
  status text not null default 'valid' check (status in ('valid','replaced','revoked')),
  replaces_id text references public.certificates(id),
  replaced_by_id text references public.certificates(id),
  revoke_reason text,
  seal_no text,
  snapshot jsonb not null default '{}'::jsonb,
  hash text not null default '',
  created_at timestamptz not null default now()
);
create index certificates_job_idx on public.certificates(job_id);
create index certificates_device_idx on public.certificates(device_id);
create index certificates_customer_idx on public.certificates(customer_id);
create index certificates_status_idx on public.certificates(status);
create index certificates_issued_at_idx on public.certificates(issued_at);

alter table public.devices add constraint devices_last_cert_fk foreign key (last_cert_id) references public.certificates(id) on delete set null;
alter table public.jobs add constraint jobs_certificate_fk foreign key (certificate_id) references public.certificates(id) on delete set null;

create table public.seal_batches (
  id text primary key default gen_random_uuid()::text,
  prefix text not null,
  from_no int not null,
  to_no int not null check (to_no >= from_no),
  received_at date not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.seals (
  id text primary key default gen_random_uuid()::text,
  batch_id text not null references public.seal_batches(id) on delete cascade,
  number text not null unique,
  seq int not null,
  status text not null default 'stock' check (status in ('stock','assigned','used','void')),
  assigned_to text references public.users(id) on delete set null,
  certificate_id text references public.certificates(id) on delete set null,
  used_at date,
  void_reason text,
  created_at timestamptz not null default now()
);
create index seals_status_idx on public.seals(status, assigned_to, seq);
create index seals_batch_idx on public.seals(batch_id);

-- ---------------------------------------------------------------------------
-- Thông báo, nhật ký
-- ---------------------------------------------------------------------------
create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text,                 -- null = gửi tất cả; 'system' = mốc nội bộ (runDailyChecks)
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read, created_at desc);
create index notifications_title_idx on public.notifications(title);

create table public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  user_id text,
  action text not null,
  "table" text not null,
  row_id text not null,
  "before" jsonb,
  "after" jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_row_idx on public.audit_logs("table", row_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- Bộ đếm nguyên tử (số GCN, mã đơn, mã khách)
-- ---------------------------------------------------------------------------
create table public.sequences (
  key text primary key,
  value bigint not null default 0
);

create or replace function public.next_sequence(p_key text)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.sequences (key, value) values (p_key, 1)
  on conflict (key) do update set value = sequences.value + 1
  returning value;
$$;

-- ---------------------------------------------------------------------------
-- Người dùng hiện tại, vai trò
-- ---------------------------------------------------------------------------
create or replace function app.current_user()
returns public.users
language sql
stable
security definer
set search_path = public
as $$
  select u.* from public.users u where u.auth_id = auth.uid() and u.active limit 1;
$$;

create or replace function app.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p_role = any(u.roles) from public.users u where u.auth_id = auth.uid() and u.active), false);
$$;

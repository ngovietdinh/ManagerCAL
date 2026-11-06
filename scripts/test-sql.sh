#!/usr/bin/env bash
# Chạy thử các migration trên một cụm PostgreSQL tạm (không cần Docker/Supabase).
# Giả lập schema auth của Supabase: auth.users + auth.uid() đọc từ biến phiên app.uid.
# Dùng: scripts/test-sql.sh   (cần PostgreSQL 16 cài sẵn, chạy được với root)
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDIR=${PGDIR:-/tmp/managercal-pg}
PORT=${PGPORT_TEST:-54329}
DB=managercal_test

run_as() { # chạy lệnh với user postgres-test (postgres không cho chạy bằng root)
  if [ "$(id -u)" = "0" ]; then
    id -u pgtest >/dev/null 2>&1 || useradd -M -s /bin/bash pgtest
    su pgtest -c "$*"
  else
    bash -c "$*"
  fi
}

cleanup() { run_as "$PGBIN/pg_ctl -D $PGDIR/data stop -m fast" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$PGDIR"; mkdir -p "$PGDIR"
[ "$(id -u)" = "0" ] && { id -u pgtest >/dev/null 2>&1 || useradd -M -s /bin/bash pgtest; chown -R pgtest "$PGDIR"; }
run_as "$PGBIN/initdb -D $PGDIR/data -A trust -U postgres" >/dev/null
run_as "$PGBIN/pg_ctl -D $PGDIR/data -l $PGDIR/log start -o \"-p $PORT -k $PGDIR -c listen_addresses=''\"" >/dev/null

PSQL="$PGBIN/psql -v ON_ERROR_STOP=1 -q -h $PGDIR -p $PORT -U postgres"

$PSQL -d postgres -c "create database $DB"
# Giả lập Supabase: role, schema auth, auth.uid()
$PSQL -d $DB <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
grant usage on schema public to anon, authenticated, service_role;
SQL

for f in supabase/migrations/*.sql; do
  echo "== $f"
  $PSQL -d $DB -f "$f"
done

echo "== kiểm tra"
$PSQL -d $DB <<'SQL'
-- dữ liệu thử
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.users (id, auth_id, code, full_name, email, roles) values
  ('u-an', '00000000-0000-0000-0000-000000000001', 'NV01', 'Nguyễn Văn An', 'an@x.vn', '{admin,signer}'),
  ('u-em', '00000000-0000-0000-0000-000000000002', 'NV05', 'Hoàng Văn Em', 'em@x.vn', '{intake}');
insert into public.fields (id, code, name) values ('f-kl', 'KL', 'Khối lượng');
insert into public.procedures (id, code, name, version, effective_from, status) values ('pr-1', 'ĐLVN 16:2009', 'Cân phân tích', '2009', '2009-01-01', 'active');
insert into public.instrument_types (id, code, name, field_id, cycle_months, procedure_id) values ('it-1', 'CAN-PT', 'Cân phân tích', 'f-kl', 12, 'pr-1');
insert into public.customers (id, code, name) values ('c-1', 'KH-0001', 'Công ty A');
insert into public.devices (id, customer_id, instrument_type_id, name) values ('d-1', 'c-1', 'it-1', 'Cân phân tích');
insert into public.orders (id, code, customer_id, received_at, received_by) values ('o-1', 'DH-2611-0001', 'c-1', current_date, 'u-em');
insert into public.jobs (id, code, order_id, customer_id, device_id, instrument_type_id, procedure_id) values ('j-1', 'DH-2611-0001-01', 'o-1', 'c-1', 'd-1', 'it-1', 'pr-1');
insert into public.certificates (id, number, kind, job_id, device_id, customer_id, issued_at, valid_to, signer_id, snapshot)
  values ('ce-1', '00001/26/KĐ-HN', 'certificate', 'j-1', 'd-1', 'c-1', current_date, current_date + 364, 'u-an',
          '{"device":{"name":"Cân phân tích","serial":"S1"},"customer":{"name":"Công ty A"},"company":{"name":"KĐ Việt"}}');

-- 1. next_sequence tăng nguyên tử
do $$
declare a bigint; b bigint;
begin
  a := public.next_sequence('cert:2026'); b := public.next_sequence('cert:2026');
  if a <> 1 or b <> 2 then raise exception 'next_sequence sai: % %', a, b; end if;
  if public.next_sequence('other') <> 1 then raise exception 'next_sequence key khác sai'; end if;
end $$;

-- 2. anon: không đọc được bảng, nhưng tra cứu GCN được
set role anon;
do $$ begin
  begin
    perform count(*) from public.certificates;
    raise exception 'anon đọc được certificates!';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$
declare j jsonb;
begin
  j := public.lookup_certificate(' 00001/26/KĐ-HN ');
  if j ->> 'number' <> '00001/26/KĐ-HN' or j ->> 'status' <> 'valid' or j -> 'device' ->> 'serial' <> 'S1' then raise exception 'lookup sai: %', j; end if;
  if j ? 'snapshot' then raise exception 'lookup lộ snapshot'; end if;
  if public.lookup_certificate('khong-co') is not null then raise exception 'lookup phải trả null'; end if;
end $$;
reset role;

-- 3. RLS theo ma trận: tiếp nhận (u-em) không được ghi certificates, admin (u-an) thì được
set role authenticated;
select set_config('app.uid', '00000000-0000-0000-0000-000000000002', false);
do $$ begin
  if app.can('sign') then raise exception 'intake không được có quyền sign'; end if;
  if not app.can('orders') then raise exception 'intake phải có quyền orders'; end if;
  if (select count(*) from public.jobs) <> 1 then raise exception 'thành viên phải đọc được jobs'; end if;
  begin
    update public.certificates set revoke_reason = 'x' where id = 'ce-1';
    if found then raise exception 'intake sửa được certificates!'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
select case when (select count(*) from public.audit_logs) = 0 then 'ok: intake không thấy audit_logs' else 'LỖI audit' end;
insert into public.audit_logs (id, user_id, action, "table", row_id) values ('a-1', 'u-em', 'test', 'jobs', 'j-1');
select case when (select count(*) from public.audit_logs) = 0 then 'ok: ghi audit được nhưng không đọc' else 'LỖI audit 2' end;

select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
update public.certificates set revoke_reason = 'y' where id = 'ce-1';
select case when (select revoke_reason from public.certificates where id = 'ce-1') = 'y' then 'ok: admin sửa certificates' else 'LỖI admin' end;
select case when (select count(*) from public.audit_logs) = 1 then 'ok: admin đọc audit_logs' else 'LỖI audit 3' end;
select case when app.has_role('admin') and not app.has_role('qa') then 'ok: has_role' else 'LỖI has_role' end;
select case when (app.current_user()).code = 'NV01' then 'ok: current_user' else 'LỖI current_user' end;

-- notifications: chỉ thấy của mình hoặc chung
insert into public.notifications (id, user_id, title) values ('n-1', 'u-em', 'cho Em'), ('n-2', null, 'chung'), ('n-3', 'u-an', 'cho An');
select case when (select count(*) from public.notifications) = 2 then 'ok: notifications của mình + chung' else 'LỖI notifications' end;
reset role;
SQL

echo "== SQL OK"

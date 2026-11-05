-- Real SMS through mNotify, one mNotify API key + sender ID per school.
-- Keys are only readable by the edunexa-sms Edge Function (service role); the apps never see them.

create table if not exists edunexa.sms_settings (
  school_id uuid primary key references edunexa.schools on delete cascade,
  api_key text not null,
  sender_id text not null check (length(sender_id) between 1 and 11),
  daily_limit int not null default 1000 check (daily_limit > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table edunexa.sms_settings enable row level security; -- no policies: no client can read keys

create table if not exists edunexa.sms_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  school_id uuid references edunexa.schools on delete cascade,
  sent_by uuid,
  sms_id text,
  to_phone text not null,
  message text not null,
  status text not null check (status in ('sent', 'failed')),
  error text
);
create index if not exists sms_log_school_at on edunexa.sms_log (school_id, at desc);
alter table edunexa.sms_log enable row level security;
drop policy if exists sms_log_read on edunexa.sms_log;
create policy sms_log_read on edunexa.sms_log for select to authenticated
  using ((select edunexa.is_super()) or edunexa.is_school_admin(school_id));
grant select on edunexa.sms_log to authenticated;

-- The Edge Function works with the service role.
grant usage on schema edunexa to service_role;
grant all on all tables in schema edunexa to service_role;
grant usage, select on all sequences in schema edunexa to service_role;

-- Super Admin sets (or clears) a school's mNotify account. A null key keeps the saved key.
create or replace function edunexa.set_school_sms(sid uuid, api_key text, sender_id text, daily_limit int default 1000, enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = edunexa as $$
begin
  if not is_super() then raise exception 'Only the Super Admin can set up SMS for a school'; end if;
  if not exists (select 1 from schools where id = sid) then raise exception 'School not found'; end if;
  if coalesce(trim(sender_id), '') = '' then
    delete from sms_settings where school_id = sid;
    perform audit('SMS removed', null, sid);
    return school_sms_status(sid);
  end if;
  if length(trim(sender_id)) > 11 then raise exception 'Sender ID can be at most 11 characters'; end if;
  if nullif(trim(api_key), '') is null and not exists (select 1 from sms_settings where school_id = sid) then
    raise exception 'Enter the mNotify API key';
  end if;
  insert into sms_settings as s (school_id, api_key, sender_id, daily_limit, enabled, updated_by)
  values (sid, trim(api_key), trim(sender_id), coalesce(daily_limit, 1000), coalesce(enabled, true), auth.uid())
  on conflict (school_id) do update set
    api_key = coalesce(nullif(trim(excluded.api_key), ''), s.api_key),
    sender_id = excluded.sender_id, daily_limit = excluded.daily_limit, enabled = excluded.enabled,
    updated_at = now(), updated_by = auth.uid();
  perform audit('SMS set up', 'Sender ID ' || trim(sender_id), sid);
  return school_sms_status(sid);
end $$;

-- What a school's SMS looks like, without the key (Super Admin, or that school's Owner/Admin).
create or replace function edunexa.school_sms_status(sid uuid default null) returns jsonb
language plpgsql stable security definer set search_path = edunexa as $$
declare s sms_settings; id uuid := coalesce(sid, my_school());
begin
  if not (is_super() or is_school_admin(id)) then raise exception 'Not allowed'; end if;
  select * into s from sms_settings where school_id = id;
  return jsonb_build_object(
    'configured', s.school_id is not null,
    'enabled', coalesce(s.enabled, false),
    'senderId', s.sender_id,
    'keyHint', case when s.api_key is not null then '••••' || right(s.api_key, 4) end,
    'dailyLimit', s.daily_limit,
    'sentToday', (select count(*) from sms_log l where l.school_id = id and l.status = 'sent' and l.at > now() - interval '24 hours'),
    'failedToday', (select count(*) from sms_log l where l.school_id = id and l.status = 'failed' and l.at > now() - interval '24 hours'),
    'updatedAt', s.updated_at);
end $$;

-- For the Schools page: which schools have SMS.
create or replace function edunexa.sms_overview() returns jsonb language plpgsql stable security definer set search_path = edunexa as $$
begin
  if not is_super() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_object_agg(school_id, jsonb_build_object('senderId', sender_id, 'enabled', enabled)) from sms_settings), '{}');
end $$;

revoke execute on function edunexa.set_school_sms(uuid, text, text, int, boolean), edunexa.school_sms_status(uuid), edunexa.sms_overview() from public;
grant execute on function edunexa.set_school_sms(uuid, text, text, int, boolean), edunexa.school_sms_status(uuid), edunexa.sms_overview() to authenticated;

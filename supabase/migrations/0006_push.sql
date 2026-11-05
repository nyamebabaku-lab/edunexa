-- Phone push notifications (Firebase Cloud Messaging) for the EduNexa and EduNexa Admin apps.
-- Database triggers turn school events into rows in edunexa.notifications; a statement trigger hands each
-- batch to the edunexa-push Edge Function (via pg_net), which sends them with FCM.

create extension if not exists pg_net with schema extensions;

alter table edunexa.config add column if not exists push_secret text not null default encode(extensions.gen_random_bytes(24), 'hex');
alter table edunexa.config add column if not exists push_url text not null default 'https://jepkzvunetajsgscoelv.supabase.co/functions/v1/edunexa-push';

create table if not exists edunexa.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users on delete cascade,
  app text not null default 'main',
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on edunexa.push_tokens (user_id);
alter table edunexa.push_tokens enable row level security;

create table if not exists edunexa.notifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users on delete cascade,
  school_id uuid references edunexa.schools on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  dedupe text,
  sent_at timestamptz,
  read_at timestamptz,
  unique (user_id, dedupe)
);
create index if not exists notifications_user on edunexa.notifications (user_id, created_at desc);
alter table edunexa.notifications enable row level security;
drop policy if exists notifications_own on edunexa.notifications;
create policy notifications_own on edunexa.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_mark on edunexa.notifications;
create policy notifications_mark on edunexa.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update (read_at) on edunexa.notifications to authenticated;
grant all on edunexa.push_tokens, edunexa.notifications to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where schemaname = 'edunexa' and tablename = 'notifications') then
    alter publication supabase_realtime add table edunexa.notifications;
  end if;
end $$;

-- The app registers the phone's FCM token after sign-in.
create or replace function edunexa.save_push_token(token text, app text default 'main', platform text default 'android') returns void
language sql security definer set search_path = edunexa as $$
  insert into push_tokens (token, user_id, app, platform) values (token, auth.uid(), app, platform)
  on conflict (token) do update set user_id = auth.uid(), app = excluded.app, platform = excluded.platform, updated_at = now();
$$;
create or replace function edunexa.drop_push_token(token text) returns void
language sql security definer set search_path = edunexa as $$
  delete from push_tokens where push_tokens.token = drop_push_token.token and user_id = auth.uid();
$$;
revoke execute on function edunexa.save_push_token(text, text, text), edunexa.drop_push_token(text) from public;
grant execute on function edunexa.save_push_token(text, text, text), edunexa.drop_push_token(text) to authenticated;

-- ---------------------------------------------------------------- who to tell
create or replace function edunexa.notify(users uuid[], sid uuid, kind text, title text, body text, link text, dedupe text default null)
returns void language sql security definer set search_path = edunexa as $$
  insert into notifications (user_id, school_id, kind, title, body, link, dedupe)
  select distinct u, sid, kind, left(title, 120), left(body, 300), link, dedupe from unnest(users) u where u is not null
  on conflict (user_id, dedupe) do nothing;
$$;

-- Accounts (active) that follow a student: the student and the parent(s).
create or replace function edunexa.family_of(sid uuid, student_id text, with_student boolean default true) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(p.user_id), '{}') from profiles p
  where p.school_id = sid and p.status = 'active' and (
    (p.role = 'parent' and p.linked_id = (select data->>'parentId' from records where school_id = sid and col = 'students' and id = student_id))
    or (with_student and p.role = 'student' and p.linked_id = student_id));
$$;
create or replace function edunexa.class_families(sid uuid, class_id text) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(distinct p.user_id), '{}') from records s
  join profiles p on p.school_id = sid and p.status = 'active'
    and ((p.role = 'student' and p.linked_id = s.id) or (p.role = 'parent' and p.linked_id = s.data->>'parentId'))
  where s.school_id = sid and s.col = 'students' and s.data->>'classId' = class_id and coalesce(s.data->>'status', 'Active') = 'Active';
$$;
create or replace function edunexa.school_members(sid uuid, roles text[] default null) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(user_id), '{}') from profiles where school_id = sid and status = 'active' and role <> 'kiosk' and (roles is null or role = any (roles));
$$;
create or replace function edunexa.student_first(sid uuid, student_id text) returns text
language sql stable security definer set search_path = edunexa as $$
  select coalesce(data->>'firstName', 'Your ward') from records where school_id = sid and col = 'students' and id = student_id;
$$;

create or replace function edunexa.push_on_record() returns trigger
language plpgsql security definer set search_path = edunexa as $$
declare d jsonb := new.data; o jsonb := case when tg_op = 'UPDATE' then old.data else null end;
  sname text; who text; k text; v text; ids uuid[];
begin
  select name into sname from schools where id = new.school_id;
  if new.col = 'messages' and tg_op = 'INSERT' then
    select name into who from profiles where user_id::text = d->>'fromId';
    perform notify(array[(d->>'toId')::uuid], new.school_id, 'message', 'Message from ' || coalesce(who, 'school'), d->>'subject', '/communication', 'msg:' || new.id);

  elsif new.col = 'notices' and tg_op = 'INSERT' then
    ids := case coalesce(d->>'audience', 'All')
      when 'Staff' then school_members(new.school_id, array['admin','headteacher','teacher','accountant','librarian','storekeeper','transport','canteen','hostel','staff'])
      when 'Parents' then school_members(new.school_id, array['parent'])
      when 'Students' then school_members(new.school_id, array['student'])
      when 'Teachers' then school_members(new.school_id, array['teacher','headteacher'])
      else school_members(new.school_id) end;
    perform notify(ids, new.school_id, 'notice', coalesce(sname, 'School') || ': ' || coalesce(d->>'title', 'New notice'), left(d->>'body', 200), '/communication', 'notice:' || new.id);

  elsif new.col = 'clockings' and d->>'personType' = 'Student' then
    if tg_op = 'INSERT' and d->>'in' is not null then
      perform notify(family_of(new.school_id, d->>'personId', false), new.school_id, 'gate',
        student_first(new.school_id, d->>'personId') || ' arrived at school', 'At ' || (d->>'in') || case when (d->>'late')::boolean then ' (late)' else '' end, '/my/attendance', 'in:' || new.id);
    elsif d->>'out' is not null and (o is null or o->>'out' is null) then
      perform notify(family_of(new.school_id, d->>'personId', false), new.school_id, 'gate',
        student_first(new.school_id, d->>'personId') || ' left school', 'At ' || (d->>'out'), '/my/attendance', 'out:' || new.id);
    end if;

  elsif new.col = 'attendance' then
    for k, v in select key, value from jsonb_each_text(coalesce(d->'records', '{}')) loop
      if v = 'A' and coalesce(o->'records'->>k, '') <> 'A' then
        perform notify(family_of(new.school_id, k, false), new.school_id, 'absent', student_first(new.school_id, k) || ' was marked absent',
          'Register for ' || coalesce(d->>'date', 'today') || '. Please contact the class teacher.', '/my/attendance', 'abs:' || new.id || ':' || k);
      end if;
    end loop;

  elsif new.col = 'invoices' and tg_op = 'INSERT' then
    perform notify(family_of(new.school_id, d->>'studentId', false), new.school_id, 'fees', 'New bill for ' || student_first(new.school_id, d->>'studentId'),
      'GH₵ ' || to_char(coalesce((d->>'total')::numeric, 0) - coalesce((d->>'discount')::numeric, 0), 'FM999,999,990.00'), '/my/fees', 'inv:' || new.id);

  elsif new.col = 'payments' and tg_op = 'INSERT' then
    perform notify(family_of(new.school_id, d->>'studentId', false), new.school_id, 'fees', 'Payment received',
      'GH₵ ' || to_char(coalesce((d->>'amount')::numeric, 0), 'FM999,999,990.00') || ' for ' || student_first(new.school_id, d->>'studentId') || ' · receipt ' || coalesce(d->>'receiptNo', ''), '/my/fees', 'pay:' || new.id);

  elsif new.col = 'scores' then
    -- one "results" notice per student per term per day, however many subjects are entered
    perform notify(family_of(new.school_id, d->>'studentId'), new.school_id, 'results', 'New results for ' || student_first(new.school_id, d->>'studentId'),
      'Scores have been entered. Open Results to see them.', '/my/results', 'scr:' || (d->>'studentId') || ':' || (d->>'termId') || ':' || to_char(now(), 'YYYY-MM-DD'));

  elsif new.col = 'assignments' and tg_op = 'INSERT' then
    perform notify(class_families(new.school_id, d->>'classId'), new.school_id, 'lms', 'New assignment: ' || coalesce(d->>'title', ''),
      coalesce('Due ' || (d->>'dueDate'), ''), '/lms', 'asg:' || new.id);

  elsif new.col = 'liveSessions' and (tg_op = 'INSERT' or coalesce(o->>'status', '') <> coalesce(d->>'status', '')) then
    if d->>'status' = 'Live' then
      perform notify(class_families(new.school_id, d->>'classId'), new.school_id, 'live', 'Live class starting now', coalesce(d->>'title', ''), '/live', 'live:' || new.id);
    elsif tg_op = 'INSERT' then
      perform notify(class_families(new.school_id, d->>'classId'), new.school_id, 'live', 'Live class scheduled: ' || coalesce(d->>'title', ''),
        coalesce(d->>'date', '') || ' ' || coalesce(d->>'start', ''), '/live', 'lvs:' || new.id);
    end if;
  end if;
  return null;
exception when others then
  return null; -- notifications must never block saving school records
end $$;

drop trigger if exists records_push on edunexa.records;
create trigger records_push after insert or update on edunexa.records for each row execute function edunexa.push_on_record();

-- Accounts: new sign-ups tell whoever approves; status changes tell the person.
create or replace function edunexa.push_on_profile() returns trigger
language plpgsql security definer set search_path = edunexa as $$
declare sname text; approvers uuid[];
begin
  select name into sname from schools where id = new.school_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    if new.is_owner then
      select coalesce(array_agg(user_id), '{}') into approvers from profiles where role = 'superadmin' and status = 'active';
      perform notify(approvers, null, 'approval', 'New school to approve', coalesce(sname, '') || ' — ' || new.name, '/schools', 'school:' || new.school_id);
    else
      select coalesce(array_agg(user_id), '{}') into approvers from profiles where school_id = new.school_id and role = 'admin' and status = 'active';
      perform notify(approvers, new.school_id, 'approval', 'Account waiting for approval', new.name || ' signed up as ' || new.role, '/accounts', 'signup:' || new.user_id);
    end if;
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    perform notify(array[new.user_id], new.school_id, 'account',
      case new.status when 'active' then 'Your account is approved ✅' when 'suspended' then 'Your account is suspended' when 'deactivated' then 'Your account is deactivated' else 'Account update' end,
      case new.status when 'active' then 'Welcome to ' || coalesce(sname, 'EduNexa') || '. Open the app to get started.' else coalesce(new.status_reason, 'Contact your school for details.') end,
      '/', 'status:' || new.user_id || ':' || new.status || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  end if;
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists profiles_push on edunexa.profiles;
create trigger profiles_push after insert or update on edunexa.profiles for each row execute function edunexa.push_on_profile();

-- Hand every new batch of notifications to the Edge Function (asynchronously; never blocks the write).
create or replace function edunexa.push_dispatch() returns trigger
language plpgsql security definer set search_path = edunexa, extensions as $$
declare ids bigint[]; c config;
begin
  select array_agg(id) into ids from new_rows;
  if ids is null then return null; end if;
  select * into c from config;
  perform net.http_post(url := c.push_url, body := jsonb_build_object('ids', ids),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.push_secret));
  return null;
exception when others then
  return null; -- a push problem must never undo the school's work
end $$;
drop trigger if exists notifications_dispatch on edunexa.notifications;
create trigger notifications_dispatch after insert on edunexa.notifications referencing new table as new_rows
  for each statement execute function edunexa.push_dispatch();

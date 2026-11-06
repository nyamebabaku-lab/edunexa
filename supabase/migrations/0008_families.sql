-- 0008: families. Parents come from their own accounts; a child can have two parent accounts (parentId, parentId2);
-- a parent links more children from the portal (admission number + date of birth), approved by the school.

create index if not exists records_parent2 on edunexa.records (school_id, (data->>'parentId2')) where col = 'students';

-- Children a parent may see: either guardian slot.
create or replace function edunexa.my_students() returns text[] language sql stable security definer set search_path = edunexa as $$
  select case p.role
    when 'student' then array[p.linked_id]
    when 'parent' then coalesce((select array_agg(r.id) from records r where r.school_id = p.school_id and r.col = 'students'
                                 and (r.data->>'parentId' = p.linked_id or r.data->>'parentId2' = p.linked_id)), '{}')
    else '{}' end
  from profiles p where p.user_id = auth.uid() and p.status = 'active';
$$;

-- Notifications go to both guardians.
create or replace function edunexa.family_of(sid uuid, student_id text, with_student boolean default true) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(p.user_id), '{}') from profiles p
  where p.school_id = sid and p.status = 'active' and (
    (p.role = 'parent' and p.linked_id in (select x from records r, lateral (values (r.data->>'parentId'), (r.data->>'parentId2')) v(x)
                                           where r.school_id = sid and r.col = 'students' and r.id = student_id and x is not null))
    or (with_student and p.role = 'student' and p.linked_id = student_id));
$$;
create or replace function edunexa.class_families(sid uuid, class_id text) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(distinct p.user_id), '{}') from records s
  join profiles p on p.school_id = sid and p.status = 'active'
    and ((p.role = 'student' and p.linked_id = s.id)
      or (p.role = 'parent' and (p.linked_id = s.data->>'parentId' or p.linked_id = s.data->>'parentId2')))
  where s.school_id = sid and s.col = 'students' and s.data->>'classId' = class_id and coalesce(s.data->>'status', 'Active') = 'Active';
$$;

-- Does another (not deactivated) parent account use this parent record?
create or replace function edunexa.parent_has_account(sid uuid, pid text, except_user uuid default null) returns boolean
language sql stable security definer set search_path = edunexa as $$
  select exists (select 1 from profiles where school_id = sid and role = 'parent' and linked_id = pid
                 and status <> 'deactivated' and user_id is distinct from except_user);
$$;

-- Puts a parent on a child: the first free guardian slot (empty, or a parent record nobody has an account on).
create or replace function edunexa.attach_parent(sid uuid, student_id text, pid text) returns text
language plpgsql security definer set search_path = edunexa as $$
declare stu records; slot text;
begin
  select * into stu from records where school_id = sid and col = 'students' and id = student_id for update;
  if stu.id is null then raise exception 'Student not found'; end if;
  if stu.data->>'parentId' = pid or stu.data->>'parentId2' = pid then return 'already'; end if;
  if nullif(stu.data->>'parentId', '') is null or not parent_has_account(sid, stu.data->>'parentId') then slot := 'parentId';
  elsif nullif(stu.data->>'parentId2', '') is null or not parent_has_account(sid, stu.data->>'parentId2') then slot := 'parentId2';
  else raise exception 'This child already has two parent accounts. Ask the school office.';
  end if;
  update records set data = data || jsonb_build_object(slot, pid), updated_at = now() where school_id = sid and col = 'students' and id = student_id;
  return slot;
end $$;

create or replace function edunexa.link_account(t edunexa.profiles) returns text
language plpgsql security definer set search_path = edunexa as $$
declare link text; stu records; first text; last text; label text; n int;
begin
  if t.linked_id is not null or t.role in ('superadmin', 'admin', 'kiosk') then return t.linked_id; end if;
  first := split_part(trim(t.name), ' ', 1);
  last := nullif(trim(substr(trim(t.name), length(first) + 1)), '');
  if t.role = 'parent' then
    select * into stu from records where school_id = t.school_id and col = 'students' and id = t.match_id;
    if stu.id is null then return null; end if;
    -- Take over the child's parent record if nobody has an account on it yet (typed in by staff, imported, or a placeholder);
    -- otherwise this account gets its own parent record as the child's second guardian.
    link := null;
    if nullif(stu.data->>'parentId', '') is not null and not parent_has_account(t.school_id, stu.data->>'parentId', t.user_id) then
      link := stu.data->>'parentId';
    elsif nullif(stu.data->>'parentId2', '') is not null and not parent_has_account(t.school_id, stu.data->>'parentId2', t.user_id) then
      link := stu.data->>'parentId2';
    end if;
    if link is null then link := short_id('par'); end if;
    insert into records (school_id, col, id, data) values (t.school_id, 'parents', link, jsonb_build_object(
      'id', link, 'title', '', 'firstName', first, 'lastName', coalesce(last, ''), 'gender', '', 'relation', 'Parent',
      'phone', coalesce(t.phone, ''), 'altPhone', '', 'email', case when t.email like '%@phone.edunexa.app' then '' else coalesce(t.email, '') end,
      'occupation', '', 'address', ''))
    on conflict (school_id, col, id) do update set data = records.data || jsonb_build_object(
      'firstName', first, 'lastName', coalesce(last, ''),
      'phone', coalesce(nullif(t.phone, ''), records.data->>'phone', ''),
      'email', case when t.email like '%@phone.edunexa.app' then coalesce(records.data->>'email', '') else coalesce(t.email, records.data->>'email', '') end);
    perform attach_parent(t.school_id, stu.id, link);
    return link;
  end if;
  if t.role = 'student' then return t.match_id; end if;
  -- staff roles
  select id into link from records where school_id = t.school_id and col = 'staff' and (
    (t.email is not null and t.email not like '%@phone.edunexa.app' and lower(data->>'email') = lower(t.email))
    or (length(regexp_replace(coalesce(t.phone, ''), '\D', '', 'g')) >= 9
        and right(regexp_replace(coalesce(data->>'phone', ''), '\D', '', 'g'), 9) = right(regexp_replace(t.phone, '\D', '', 'g'), 9)))
    and not exists (select 1 from profiles o where o.school_id = t.school_id and o.linked_id = records.id and o.user_id <> t.user_id)
  limit 1;
  if link is not null then return link; end if;
  label := case t.role when 'headteacher' then 'Head Teacher' when 'teacher' then 'Teacher' when 'accountant' then 'Accountant'
    when 'librarian' then 'Librarian' when 'storekeeper' then 'Storekeeper' when 'transport' then 'Transport Officer'
    when 'canteen' then 'Canteen Manager' when 'hostel' then 'Hostel Manager' else 'Support Staff' end;
  select count(*) + 1 into n from records where school_id = t.school_id and col = 'staff';
  link := short_id('stf');
  insert into records (school_id, col, id, data) values (t.school_id, 'staff', link, jsonb_build_object(
    'id', link, 'staffNo', school_initials(t.school_id) || '/ST/' || lpad(n::text, 3, '0'), 'title', '', 'firstName', first, 'lastName', coalesce(last, ''),
    'gender', '', 'role', label, 'department', case when t.role in ('teacher', 'headteacher') then 'Academic' else label end,
    'phone', coalesce(t.phone, ''), 'email', case when t.email like '%@phone.edunexa.app' then '' else coalesce(t.email, '') end,
    'qualification', '', 'salary', 0, 'allowances', 0, 'dateJoined', to_char(now(), 'YYYY-MM-DD'), 'status', 'Active',
    'ssnitNo', '', 'bank', '', 'accountNo', ''));
  return link;
end $$;

-- A third parent account for the same child is refused when signing up.
create or replace function edunexa.join_guard() returns trigger language plpgsql security definer set search_path = edunexa as $$
declare stu records;
begin
  if new.role = 'parent' and new.match_id is not null then
    select * into stu from records where school_id = new.school_id and col = 'students' and id = new.match_id;
    if nullif(stu.data->>'parentId', '') is not null and parent_has_account(new.school_id, stu.data->>'parentId')
       and nullif(stu.data->>'parentId2', '') is not null and parent_has_account(new.school_id, stu.data->>'parentId2') then
      raise exception 'This child already has two parent accounts. Ask the school office.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_join_guard on edunexa.profiles;
create trigger profiles_join_guard before insert on edunexa.profiles for each row execute function edunexa.join_guard();

-- ---------------------------------------------------------------- linking more children from the parent portal
create table if not exists edunexa.child_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  school_id uuid not null references edunexa.schools on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  student_id text not null,
  label text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'failed')),
  note text,
  decided_by uuid,
  decided_at timestamptz
);
create index if not exists child_requests_school on edunexa.child_requests (school_id, status);
alter table edunexa.child_requests enable row level security;
drop policy if exists child_requests_read on edunexa.child_requests;
create policy child_requests_read on edunexa.child_requests for select to authenticated
  using (user_id = auth.uid() or (school_id = edunexa.my_school() and edunexa.my_role() in ('admin', 'headteacher')));
grant select on edunexa.child_requests to authenticated;
grant all on edunexa.child_requests to service_role;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where schemaname = 'edunexa' and tablename = 'child_requests') then
    alter publication supabase_realtime add table edunexa.child_requests;
  end if;
end $$;

-- Parent asks to link another child: admission number + the child's date of birth. Wrong dates count as failed tries (5 a day).
create or replace function edunexa.request_child(admission_no text, dob text) returns edunexa.child_requests
language plpgsql security definer set search_path = edunexa as $$
declare me profiles; stu records; cls text; r child_requests; lbl text;
begin
  select * into me from profiles where user_id = auth.uid() and status = 'active' and role = 'parent';
  if me.user_id is null or me.school_id is null then raise exception 'Only an approved parent account can link children'; end if;
  if (select count(*) from child_requests where user_id = me.user_id and status = 'failed' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Too many tries today. Please try again tomorrow or ask the school office.';
  end if;
  if coalesce(trim(admission_no), '') = '' or coalesce(trim(dob), '') = '' then raise exception 'Enter the admission number and the date of birth'; end if;
  select * into stu from records where school_id = me.school_id and col = 'students' and upper(trim(data->>'admissionNo')) = upper(trim(admission_no)) limit 1;
  if stu.id is null or (nullif(stu.data->>'dob', '') is not null and left(stu.data->>'dob', 10) <> left(trim(dob), 10)) then
    insert into child_requests (school_id, user_id, student_id, label, status, note) values (me.school_id, me.user_id, coalesce(stu.id, '?'), upper(trim(admission_no)), 'failed', 'details did not match');
    return null;
  end if;
  if stu.data->>'parentId' = me.linked_id or stu.data->>'parentId2' = me.linked_id then raise exception 'This child is already linked to your account'; end if;
  if exists (select 1 from child_requests where user_id = me.user_id and student_id = stu.id and status = 'pending') then
    raise exception 'You already asked to link this child — the school will approve it soon';
  end if;
  if nullif(stu.data->>'parentId', '') is not null and parent_has_account(me.school_id, stu.data->>'parentId')
     and nullif(stu.data->>'parentId2', '') is not null and parent_has_account(me.school_id, stu.data->>'parentId2') then
    raise exception 'This child already has two parent accounts. Ask the school office.';
  end if;
  select data->>'name' into cls from records where school_id = me.school_id and col = 'classes' and id = stu.data->>'classId';
  lbl := concat_ws(' · ', concat_ws(' ', stu.data->>'firstName', stu.data->>'lastName'), cls, stu.data->>'admissionNo');
  insert into child_requests (school_id, user_id, student_id, label) values (me.school_id, me.user_id, stu.id, lbl) returning * into r;
  perform notify(school_members(me.school_id, array['admin', 'headteacher']), me.school_id, 'child_request',
    'Parent wants to link a child', me.name || ' → ' || lbl, '/parents', 'childreq-' || r.id);
  perform audit('Child link requested', me.name || ' → ' || lbl, me.school_id);
  return r;
end $$;

-- The Owner/Admin or Head Teacher approves or declines.
create or replace function edunexa.decide_child_request(request_id bigint, approve boolean) returns edunexa.child_requests
language plpgsql security definer set search_path = edunexa as $$
declare r child_requests; par profiles;
begin
  select * into r from child_requests where id = request_id for update;
  if r.id is null or r.status <> 'pending' then raise exception 'This request was already handled'; end if;
  if r.school_id is distinct from my_school() or my_role() not in ('admin', 'headteacher') then
    raise exception 'Only the Owner/Admin or Head Teacher can do this';
  end if;
  select * into par from profiles where user_id = r.user_id;
  if approve then
    if par.linked_id is null or par.status <> 'active' then raise exception 'That parent account is not active'; end if;
    perform attach_parent(r.school_id, r.student_id, par.linked_id);
  end if;
  update child_requests set status = case when approve then 'approved' else 'declined' end, decided_by = auth.uid(), decided_at = now()
  where id = r.id returning * into r;
  perform notify(array[r.user_id], r.school_id, 'child_request',
    case when approve then 'Child linked' else 'Child link declined' end,
    case when approve then r.label || ' now shows in your app' else r.label || ' — please contact the school office' end,
    '/', 'childdec-' || r.id);
  perform audit(case when approve then 'Child link approved' else 'Child link declined' end, par.name || ' → ' || r.label, r.school_id);
  return r;
end $$;

grant execute on function edunexa.request_child(text, text), edunexa.decide_child_request(bigint, boolean) to authenticated;

-- Internal helpers: only the database's own functions and triggers may use them (not the apps directly).
revoke execute on function edunexa.link_account(edunexa.profiles), edunexa.attach_parent(uuid, text, text),
  edunexa.parent_has_account(uuid, text, uuid), edunexa.join_guard(),
  edunexa.notify(uuid[], uuid, text, text, text, text, text), edunexa.audit(text, text, uuid),
  edunexa.family_of(uuid, text, boolean), edunexa.class_families(uuid, text), edunexa.school_members(uuid, text[]),
  edunexa.student_first(uuid, text)
  from public, anon, authenticated;

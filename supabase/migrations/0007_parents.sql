-- 0007: parents that were never saved (a Head Teacher could add a student with a new parent, but not save the parent).
-- 1. link_account creates a missing parent record when a parent account links to the child.
-- 2. Repair: create the missing parent records — from the parent's own account where there is one,
--    otherwise a placeholder "Parent of <student>" for the school to fill in.
-- (The Head Teacher may now add and edit parents: see 0002_access.sql, regenerated.)

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
    link := nullif(stu.data->>'parentId', '');
    -- The student points to a parent record that was never saved: create it now, from this account.
    if link is not null and not exists (select 1 from records where school_id = t.school_id and col = 'parents' and id = link) then
      insert into records (school_id, col, id, data) values (t.school_id, 'parents', link, jsonb_build_object(
        'id', link, 'title', '', 'firstName', first, 'lastName', coalesce(last, ''), 'gender', '', 'relation', 'Parent',
        'phone', coalesce(t.phone, ''), 'altPhone', '', 'email', case when t.email like '%@phone.edunexa.app' then '' else coalesce(t.email, '') end,
        'occupation', '', 'address', ''));
    end if;
    if link is null then
      link := short_id('par');
      insert into records (school_id, col, id, data) values (t.school_id, 'parents', link, jsonb_build_object(
        'id', link, 'title', '', 'firstName', first, 'lastName', coalesce(last, ''), 'gender', '', 'relation', 'Parent',
        'phone', coalesce(t.phone, ''), 'altPhone', '', 'email', coalesce(t.email, ''), 'occupation', '', 'address', ''));
      update records set data = data || jsonb_build_object('parentId', link) where school_id = t.school_id and col = 'students' and id = stu.id;
    end if;
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

insert into edunexa.records (school_id, col, id, data)
select distinct on (p.school_id, p.linked_id) p.school_id, 'parents', p.linked_id, jsonb_build_object(
  'id', p.linked_id, 'title', '', 'firstName', split_part(trim(p.name), ' ', 1),
  'lastName', coalesce(nullif(trim(substr(trim(p.name), length(split_part(trim(p.name), ' ', 1)) + 1)), ''), ''),
  'gender', '', 'relation', 'Parent', 'phone', coalesce(p.phone, ''), 'altPhone', '',
  'email', case when p.email like '%@phone.edunexa.app' then '' else coalesce(p.email, '') end, 'occupation', '', 'address', '')
from edunexa.profiles p
where p.role = 'parent' and p.linked_id is not null
  and not exists (select 1 from edunexa.records r where r.school_id = p.school_id and r.col = 'parents' and r.id = p.linked_id)
order by p.school_id, p.linked_id, p.created_at
on conflict do nothing;

insert into edunexa.records (school_id, col, id, data)
select distinct on (s.school_id, s.data->>'parentId') s.school_id, 'parents', s.data->>'parentId', jsonb_build_object(
  'id', s.data->>'parentId', 'title', '', 'firstName', 'Parent of',
  'lastName', trim(coalesce(s.data->>'firstName', '') || ' ' || coalesce(s.data->>'lastName', '')),
  'gender', '', 'relation', 'Guardian', 'phone', '', 'altPhone', '', 'email', '', 'occupation', '', 'address', '')
from edunexa.records s
where s.col = 'students' and coalesce(s.data->>'parentId', '') <> ''
  and not exists (select 1 from edunexa.records r where r.school_id = s.school_id and r.col = 'parents' and r.id = s.data->>'parentId')
on conflict do nothing;

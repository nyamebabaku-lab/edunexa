-- Staff numbers created on approval use the school's initials (e.g. BSA/ST/004).
create or replace function edunexa.school_initials(sid uuid) returns text language sql stable security definer set search_path = edunexa as $$
  select coalesce(nullif(upper(trim(s.settings->>'initials')), ''),
    nullif(left(upper((select string_agg(left(w, 1), '') from regexp_split_to_table(regexp_replace(s.name, '[^A-Za-z0-9 ]', ' ', 'g'), '\s+') w
      where w <> '' and lower(w) not in ('of', 'the', 'and', 'for', 'de', 'la'))), 5), ''), 'SCH')
  from schools s where s.id = sid;
$$;

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

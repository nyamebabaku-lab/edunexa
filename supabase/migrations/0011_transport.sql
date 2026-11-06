-- 0011: school transport — Driver and Bus Attendant accounts, trips run from their phones, live bus location
-- (only during a trip), and automatic notifications to parents: bus left school, about 5 minutes from your stop,
-- got on the bus, dropped off. Locations are kept 30 days.

alter table edunexa.profiles drop constraint if exists profiles_role_check;
alter table edunexa.profiles add constraint profiles_role_check check (role in ('superadmin', 'admin', 'headteacher', 'teacher', 'accountant',
  'librarian', 'storekeeper', 'transport', 'driver', 'attendant', 'canteen', 'hostel', 'staff', 'kiosk', 'parent', 'student'));

create or replace function edunexa.join_school(code text, member_role text, full_name text, phone text default null, admission_no text default null)
returns edunexa.profiles language plpgsql security definer set search_path = edunexa as $$
declare s schools; stu records; p profiles; cls text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then raise exception 'This account is already registered with EduNexa'; end if;
  if member_role not in ('admin', 'headteacher', 'teacher', 'accountant', 'librarian', 'storekeeper', 'transport', 'canteen', 'hostel', 'staff', 'kiosk', 'driver', 'attendant', 'parent', 'student') then
    raise exception 'Choose a valid role';
  end if;
  if coalesce(trim(full_name), '') = '' then raise exception 'Enter your full name'; end if;
  select * into s from schools where schools.code = upper(trim(join_school.code)) and status <> 'suspended';
  if s.id is null then raise exception 'No school has that code'; end if;
  if member_role in ('parent', 'student') then
    if coalesce(trim(admission_no), '') = '' then raise exception 'Enter the admission number'; end if;
    select * into stu from records r where r.school_id = s.id and r.col = 'students'
      and upper(trim(r.data->>'admissionNo')) = upper(trim(admission_no)) limit 1;
    if stu.id is null then raise exception 'That admission number was not found at %', s.name; end if;
    if member_role = 'student' and exists (select 1 from profiles where school_id = s.id and role = 'student' and linked_id = stu.id) then
      raise exception 'This student already has an account';
    end if;
    select r.data->>'name' into cls from records r where r.school_id = s.id and r.col = 'classes' and r.id = stu.data->>'classId';
  end if;
  insert into profiles (user_id, school_id, role, name, email, phone, admission_no, match_id, match_label, linked_id)
  values (auth.uid(), s.id, member_role, trim(full_name), auth.email(), phone, nullif(upper(trim(admission_no)), ''), stu.id,
          case when stu.id is not null then concat_ws(' · ', concat_ws(' ', stu.data->>'firstName', stu.data->>'lastName'), cls, stu.data->>'admissionNo') end,
          case when member_role = 'student' then stu.id end)
  returning * into p;
  perform audit('Account requested', full_name || ' as ' || member_role, s.id);
  return p;
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
    when 'canteen' then 'Canteen Manager' when 'hostel' then 'Hostel Manager' when 'driver' then 'Driver' when 'attendant' then 'Bus Attendant' else 'Support Staff' end;
  select count(*) + 1 into n from records where school_id = t.school_id and col = 'staff';
  link := short_id('stf');
  insert into records (school_id, col, id, data) values (t.school_id, 'staff', link, jsonb_build_object(
    'id', link, 'staffNo', school_initials(t.school_id) || '/ST/' || lpad(n::text, 3, '0'), 'title', '', 'firstName', first, 'lastName', coalesce(last, ''),
    'gender', '', 'role', label, 'department', case when t.role in ('teacher', 'headteacher') then 'Academic' when t.role in ('driver', 'attendant') then 'Transport' else label end,
    'phone', coalesce(t.phone, ''), 'email', case when t.email like '%@phone.edunexa.app' then '' else coalesce(t.email, '') end,
    'qualification', '', 'salary', 0, 'allowances', 0, 'dateJoined', to_char(now(), 'YYYY-MM-DD'), 'status', 'Active',
    'ssnitNo', '', 'bank', '', 'accountNo', ''));
  return link;
end $$;

create table if not exists edunexa.bus_positions (
  id bigint generated always as identity primary key,
  school_id uuid not null references edunexa.schools on delete cascade,
  trip_id text not null,
  bus_id text,
  user_id uuid references auth.users on delete set null,
  lat double precision not null,
  lng double precision not null,
  speed real,
  heading real,
  accuracy real,
  at timestamptz not null default now()
);
create index if not exists bus_positions_trip on edunexa.bus_positions (school_id, trip_id, at desc);
alter table edunexa.bus_positions enable row level security; -- read and written only through the functions below
grant all on edunexa.bus_positions to service_role;

-- Distance in metres.
create or replace function edunexa.metres(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- Parents of the active students on a route (optionally only those at one stop).
create or replace function edunexa.route_families(sid uuid, route_id text, stop_id text default null) returns uuid[]
language sql stable security definer set search_path = edunexa as $$
  select coalesce(array_agg(distinct u), '{}') from records s, lateral unnest(family_of(sid, s.id, false)) u
  where s.school_id = sid and s.col = 'students' and s.data->>'busRouteId' = route_id and coalesce(s.data->>'status', 'Active') = 'Active'
    and (stop_id is null or s.data->>'busStopId' = stop_id);
$$;

-- The bus crew's phones send the bus position while a trip is running (every ~15 s).
create or replace function edunexa.post_position(trip_id text, lat double precision, lng double precision,
  speed real default null, heading real default null, accuracy real default null) returns jsonb
language plpgsql security definer set search_path = edunexa as $$
declare me profiles; trip records; route records; st jsonb; d double precision; v double precision; reach double precision; n int := 0;
begin
  select * into me from profiles where user_id = auth.uid() and status = 'active';
  if me.role is null or me.role not in ('driver', 'attendant', 'transport', 'admin') then raise exception 'Only the bus crew can share the bus location'; end if;
  select * into trip from records where school_id = me.school_id and col = 'trips' and id = post_position.trip_id;
  if trip.id is null then raise exception 'Trip not found'; end if;
  if trip.data->>'status' <> 'Running' or coalesce((trip.data->>'startedAt')::timestamptz, now()) < now() - interval '3 hours' then
    return jsonb_build_object('ok', false, 'stop', true); -- trip over: the phone stops sharing
  end if;
  insert into bus_positions (school_id, trip_id, bus_id, user_id, lat, lng, speed, heading, accuracy)
  values (me.school_id, trip.id, trip.data->>'busId', me.user_id, lat, lng, speed, heading, accuracy);
  -- "About 5 minutes from your stop": once per stop per trip, for stops with a saved location.
  select * into route from records where school_id = me.school_id and col = 'routes' and id = trip.data->>'routeId';
  v := greatest(coalesce(speed, 0), 6); -- metres per second; at least ~22 km/h so slow traffic still warns in time
  reach := least(greatest(v * 300, 400), 3000);
  for st in select * from jsonb_array_elements(coalesce(route.data->'stopList', '[]')) loop
    continue when (st->>'lat') is null;
    d := metres(lat, lng, (st->>'lat')::double precision, (st->>'lng')::double precision);
    if d <= reach then
      perform notify(route_families(me.school_id, route.id, st->>'id'), me.school_id, 'bus_near',
        'The school bus is about 5 minutes away',
        coalesce(route.data->>'name', 'School bus') || ' is nearing ' || coalesce(st->>'name', 'your stop') || '.', '/transport',
        'near|' || trip.id || '|' || (st->>'id'));
      n := n + 1;
    end if;
  end loop;
  if random() < 0.01 then delete from bus_positions where at < now() - interval '30 days'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- What the caller may see right now: running trips (with the latest position) and the crew contacts of their routes.
-- Parents: only their children's routes. Transport manager, Head Teacher, Owner/Admin, crew: every route.
create or replace function edunexa.transport_view() returns jsonb
language plpgsql stable security definer set search_path = edunexa as $$
declare me profiles; routes text[]; staffwide boolean;
begin
  select * into me from profiles where user_id = auth.uid() and status = 'active';
  if me.school_id is null then return '{}'; end if;
  staffwide := me.role in ('admin', 'headteacher', 'transport', 'driver', 'attendant');
  if me.role = 'parent' then
    select coalesce(array_agg(distinct s.data->>'busRouteId'), '{}') into routes from records s
    where s.school_id = me.school_id and s.col = 'students' and s.id = any (my_students()) and nullif(s.data->>'busRouteId', '') is not null;
  elsif not staffwide then
    return '{}';
  end if;
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(jsonb_build_object('trip', t.data, 'pos', (
        select jsonb_build_object('lat', p.lat, 'lng', p.lng, 'speed', p.speed, 'heading', p.heading, 'at', p.at)
        from bus_positions p where p.school_id = me.school_id and p.trip_id = t.id order by p.at desc limit 1)))
      from records t
      where t.school_id = me.school_id and t.col = 'trips' and t.data->>'status' = 'Running'
        and (t.data->>'startedAt')::timestamptz > now() - interval '3 hours'
        and (staffwide or t.data->>'routeId' = any (routes))), '[]'),
    'crew', coalesce((
      select jsonb_object_agg(r.id, jsonb_build_object(
        'driver', (select jsonb_build_object('name', concat_ws(' ', x.data->>'title', x.data->>'firstName', x.data->>'lastName'), 'phone', x.data->>'phone') from records x where x.school_id = me.school_id and x.col = 'staff' and x.id = b.data->>'driverId'),
        'attendant', (select jsonb_build_object('name', concat_ws(' ', x.data->>'title', x.data->>'firstName', x.data->>'lastName'), 'phone', x.data->>'phone') from records x where x.school_id = me.school_id and x.col = 'staff' and x.id = b.data->>'attendantId')))
      from records r left join records b on b.school_id = r.school_id and b.col = 'buses' and b.id = r.data->>'busId'
      where r.school_id = me.school_id and r.col = 'routes' and (staffwide or r.id = any (routes))), '{}'));
end $$;

-- Trips: tell parents when the afternoon bus leaves, and when their child gets on or is dropped off.
create or replace function edunexa.trip_notify() returns trigger
language plpgsql security definer set search_path = edunexa as $$
declare sid uuid := new.school_id; k text; o jsonb; n jsonb; who text; route text; stopname text; was text := null; before jsonb := '{}';
begin
  route := coalesce(new.data->>'routeName', 'The school bus');
  if tg_op = 'UPDATE' then
    was := old.data->>'status';
    before := coalesce(old.data->'riders', '{}');
  end if;
  if was is distinct from 'Running' and new.data->>'status' = 'Running' and new.data->>'type' = 'Afternoon drop-off' then
    perform notify(route_families(sid, new.data->>'routeId'), sid, 'bus_left', 'The school bus has left school', route || ' left school at ' || coalesce(new.data->>'departed', to_char(now(), 'HH24:MI')) || '.', '/transport', 'left|' || new.id);
  end if;
  for k, n in select * from jsonb_each(coalesce(new.data->'riders', '{}')) loop
    o := before->k;
    who := student_first(sid, k);
    stopname := coalesce(n->>'stopName', 'their stop');
    if nullif(n->>'on', '') is not null and nullif(o->>'on', '') is null then
      perform notify(family_of(sid, k, false), sid, 'bus_board', who || ' got on the bus', who || ' boarded ' || route || ' at ' || (n->>'on') || case when new.data->>'type' = 'Morning pick-up' then ' (' || stopname || ')' else '' end || '.', '/transport', 'on|' || new.id || '|' || k);
    end if;
    if nullif(n->>'off', '') is not null and nullif(o->>'off', '') is null then
      perform notify(family_of(sid, k, false), sid, 'bus_drop',
        case when new.data->>'type' = 'Morning pick-up' then who || ' arrived at school' else who || ' was dropped off' end,
        case when new.data->>'type' = 'Morning pick-up' then who || ' got off the bus at school at ' || (n->>'off') || '.' else who || ' was dropped off at ' || stopname || ' at ' || (n->>'off') || '.' end,
        '/transport', 'off|' || new.id || '|' || k);
    end if;
  end loop;
  return null;
exception when others then
  return null; -- never block the trip log
end $$;
drop trigger if exists records_trip_notify on edunexa.records;
create trigger records_trip_notify after insert or update on edunexa.records
  for each row when (new.col = 'trips') execute function edunexa.trip_notify();

grant execute on function edunexa.post_position(text, double precision, double precision, real, real, real), edunexa.transport_view() to authenticated;
revoke execute on function edunexa.route_families(uuid, text, text), edunexa.trip_notify(), edunexa.link_account(edunexa.profiles) from public, anon, authenticated;

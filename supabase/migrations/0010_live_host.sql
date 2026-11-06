-- 0010: only a live class's own teacher can start it, end it or record its attendance.
-- The Owner/Admin and Head Teacher can still schedule, edit, reassign (before it starts) and delete classes;
-- students and others can never change whether a class is live.
create or replace function edunexa.live_host_guard() returns trigger
language plpgsql security definer set search_path = edunexa as $$
declare me text := my_link(); teacher text;
begin
  if new.col <> 'liveSessions' or is_super() then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.data->>'status', 'Scheduled') <> 'Scheduled' and me is distinct from new.data->>'teacherId' then
      raise exception 'Only the class teacher can start a live class';
    end if;
    return new;
  end if;
  teacher := old.data->>'teacherId';
  if (new.data->>'status' is distinct from old.data->>'status'
      or new.data->>'startedAt' is distinct from old.data->>'startedAt'
      or new.data->>'endedAt' is distinct from old.data->>'endedAt'
      or new.data->'attendance' is distinct from old.data->'attendance')
     and me is distinct from teacher then
    raise exception 'Only the class teacher can start or end this live class';
  end if;
  if new.data->>'teacherId' is distinct from teacher
     and (my_role() not in ('admin', 'headteacher') or coalesce(old.data->>'status', 'Scheduled') <> 'Scheduled') then
    raise exception 'Only the Owner/Admin or Head Teacher can change the teacher, before the class starts';
  end if;
  return new;
end $$;
drop trigger if exists records_live_host on edunexa.records;
create trigger records_live_host before insert or update on edunexa.records
  for each row when (new.col = 'liveSessions') execute function edunexa.live_host_guard();
revoke execute on function edunexa.live_host_guard() from public, anon, authenticated;

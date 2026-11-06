-- 0009
-- 1. Gate → class register: every student clock-in (gate kiosk, a student's own phone, or the office gate page)
--    ticks the class register on the server — Present, or Late if after the late time — unless a teacher already marked it.
--    Works for clock-ins recorded offline too, when they reach the server. Follows the school's "Mark the class register
--    from gate clock-ins" setting.
-- 2. Marks: a teacher can only save marks for the classes and subjects they are linked to (Classes & Subjects).
--    The Head Teacher and Owner/Admin can enter any marks.

create or replace function edunexa.gate_register() returns trigger
language plpgsql security definer set search_path = edunexa as $$
declare stu records; cls text; day text; mark text; rid text;
begin
  if new.col <> 'clockings' or coalesce(new.data->>'personType', '') <> 'Student' or nullif(new.data->>'in', '') is null then return null; end if;
  if tg_op = 'UPDATE' and nullif(old.data->>'in', '') is not null then return null; end if; -- only the arrival
  if coalesce((select settings->'gate'->>'autoRegister' from schools where id = new.school_id), 'true') = 'false' then return null; end if;
  select * into stu from records where school_id = new.school_id and col = 'students' and id = new.data->>'personId';
  cls := stu.data->>'classId';
  day := coalesce(nullif(new.data->>'date', ''), to_char(now(), 'YYYY-MM-DD'));
  if cls is null then return null; end if;
  mark := case when (new.data->>'late')::boolean then 'L' else 'P' end;
  rid := day || '|' || cls;
  insert into records (school_id, col, id, data) values (new.school_id, 'attendance', rid,
    jsonb_build_object('id', rid, 'date', day, 'classId', cls, 'records', jsonb_build_object(stu.id, mark), 'takenBy', 'gate'))
  on conflict (school_id, col, id) do update
    set data = jsonb_set(records.data, '{records}', coalesce(records.data->'records', '{}') || jsonb_build_object(stu.id, mark)), updated_at = now()
    where coalesce(records.data->'records'->>stu.id, '') not in ('P', 'L', 'E');
  return null;
exception when others then
  return null; -- never block a clock-in
end $$;
drop trigger if exists records_gate_register on edunexa.records;
create trigger records_gate_register after insert or update on edunexa.records
  for each row when (new.col = 'clockings') execute function edunexa.gate_register();

create or replace function edunexa.teacher_marks_guard() returns trigger
language plpgsql security definer set search_path = edunexa as $$
begin
  if new.col <> 'scores' or my_role() is distinct from 'teacher' then return new; end if;
  if not exists (select 1 from records a where a.school_id = new.school_id and a.col = 'allocations'
                 and a.data->>'teacherId' = my_link() and a.data->>'classId' = new.data->>'classId' and a.data->>'subjectId' = new.data->>'subjectId') then
    raise exception 'You can only enter marks for the classes and subjects you teach. Ask the Head Teacher to link you to this subject.';
  end if;
  return new;
end $$;
drop trigger if exists records_teacher_marks on edunexa.records;
create trigger records_teacher_marks before insert or update on edunexa.records
  for each row when (new.col = 'scores') execute function edunexa.teacher_marks_guard();

revoke execute on function edunexa.gate_register(), edunexa.teacher_marks_guard() from public, anon, authenticated;

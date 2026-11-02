import { useMemo, useState } from 'react';
import { Printer, Pencil, Check, Coffee } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, sortedClasses } from '../../data/selectors';
import { DAYS } from '../../data/seed';
import { Card, PageHeader, Select, Button, Tabs, toast, cx } from '../../components/ui';

const COLORS = [
  'bg-brand-50 text-brand-800 border-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:border-brand-500/20',
  'bg-accent-50 text-accent-800 border-accent-100 dark:bg-accent-500/10 dark:text-accent-200 dark:border-accent-500/20',
  'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20',
  'bg-violet-50 text-violet-800 border-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-500/20',
  'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20',
  'bg-sky-50 text-sky-800 border-sky-100 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/20',
  'bg-teal-50 text-teal-800 border-teal-100 dark:bg-teal-500/10 dark:text-teal-200 dark:border-teal-500/20',
  'bg-orange-50 text-orange-800 border-orange-100 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-500/20',
  'bg-slate-100 text-slate-800 border-slate-200 dark:bg-white/5 dark:text-slate-200 dark:border-white/10',
  'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/20',
];

export default function Timetable() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const { student } = usePortalStudent();
  const isTeacher = user.role === 'teacher';
  const [mode, setMode] = useState(isTeacher ? 'mine' : 'class');
  const [classId, setClassId] = useState(student?.classId || (isTeacher ? db.classes.find((c) => c.classTeacherId === user.linkedId)?.id : null) || db.classes[0].id);
  const [editing, setEditing] = useState(false);
  const portal = ['parent', 'student'].includes(user.role);
  const effectiveClass = portal ? student.classId : classId;
  const cls = L.cls(effectiveClass);
  const grid = db.timetable[effectiveClass] || {};
  const colorOf = (sid) => COLORS[Math.max(0, cls?.subjectIds.indexOf(sid)) % COLORS.length];

  // Teacher personal view: cells where the teacher teaches the scheduled subject.
  const myGrid = useMemo(() => {
    if (!isTeacher) return {};
    const alloc = db.allocations.filter((a) => a.teacherId === user.linkedId);
    const g = {};
    DAYS.forEach((d) => {
      g[d] = {};
      db.periods.forEach((p) => {
        const hit = alloc.find((a) => db.timetable[a.classId]?.[d]?.[p.id] === a.subjectId);
        if (hit) g[d][p.id] = hit;
      });
    });
    return g;
  }, [db, isTeacher, user.linkedId]);

  const setCell = (day, pid, sid) => {
    db.setKey('timetable', (t) => ({ ...t, [effectiveClass]: { ...t[effectiveClass], [day]: { ...t[effectiveClass][day], [pid]: sid } } }));
  };

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={mode === 'mine' ? 'Your teaching schedule for the week' : `${cls?.name} · weekly lesson schedule`}
        actions={
          <>
            {isTeacher && <Tabs value={mode} onChange={setMode} tabs={[{ value: 'mine', label: 'My schedule' }, { value: 'class', label: 'By class' }]} />}
            {!portal && mode === 'class' && <Select className="!w-48" value={classId} onChange={(e) => { setClassId(e.target.value); setEditing(false); }} options={sortedClasses(db.classes).map((c) => ({ value: c.id, label: c.name }))} />}
            {user.role === 'admin' && mode === 'class' && (
              <Button variant={editing ? 'primary' : 'secondary'} icon={editing ? Check : Pencil} onClick={() => { if (editing) toast.success('Timetable saved'); setEditing(!editing); }}>
                {editing ? 'Done' : 'Edit'}
              </Button>
            )}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          </>
        }
      />
      <Card className="print-area overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-1.5 p-3">
          <thead>
            <tr>
              <th className="w-28 text-left text-xs font-semibold uppercase text-slate-400">Day</th>
              {db.periods.map((p) => (
                <th key={p.id} className={cx('text-center', p.isBreak && 'w-14')}>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.label}</p>
                  <p className="text-[10px] font-medium text-slate-400">{p.start}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td className="pr-2 text-sm font-bold text-slate-700 dark:text-slate-200">{d}</td>
                {db.periods.map((p) => {
                  if (p.isBreak)
                    return (
                      <td key={p.id} className="rounded-xl bg-slate-50 text-center dark:bg-white/[.03]">
                        <Coffee className="mx-auto h-4 w-4 text-slate-300" />
                      </td>
                    );
                  if (mode === 'mine') {
                    const a = myGrid[d]?.[p.id];
                    return (
                      <td key={p.id} className={cx('h-16 rounded-xl border p-2 align-top', a ? 'border-brand-100 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10' : 'border-dashed border-slate-200 dark:border-white/10')}>
                        {a && (
                          <>
                            <p className="line-clamp-2 text-xs font-bold text-brand-800 dark:text-brand-200">{L.subjectName(a.subjectId)}</p>
                            <p className="mt-0.5 text-[10px] font-semibold text-accent-600">{L.className(a.classId)}</p>
                          </>
                        )}
                      </td>
                    );
                  }
                  const sid = grid[d]?.[p.id];
                  const teacher = db.allocations.find((a) => a.classId === effectiveClass && a.subjectId === sid)?.teacherId;
                  return (
                    <td key={p.id} className={cx('h-16 rounded-xl border p-2 align-top', colorOf(sid))}>
                      {editing ? (
                        <select value={sid || ''} onChange={(e) => setCell(d, p.id, e.target.value)} className="w-full rounded-lg bg-white/80 p-1 text-[11px] font-semibold outline-none dark:bg-navy-900">
                          <option value="">Free</option>
                          {cls.subjectIds.map((s) => <option key={s} value={s}>{L.subjectName(s)}</option>)}
                        </select>
                      ) : (
                        <>
                          <p className="line-clamp-2 text-xs font-bold">{sid ? L.subjectName(sid) : 'Free'}</p>
                          {teacher && <p className="mt-0.5 truncate text-[10px] opacity-70">{L.staff(teacher)?.lastName}</p>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

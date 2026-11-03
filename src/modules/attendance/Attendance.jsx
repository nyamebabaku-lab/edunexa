import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Save, Send, ClipboardCheck, UserX, Clock, Users } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses, attendanceStats, TODAY } from '../../data/selectors';
import { fullName, fmtDate, nowISO, pct } from '../../lib/format';
import { Card, PageHeader, Select, Input, Button, Avatar, Tabs, StatCard, Badge, DataTable, toast, cx } from '../../components/ui';
import { photoKey } from '../../data/photos';

const MARKS = [
  { k: 'P', label: 'Present', on: 'bg-emerald-500 text-white', ring: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10' },
  { k: 'L', label: 'Late', on: 'bg-amber-500 text-white', ring: 'hover:bg-amber-50 dark:hover:bg-amber-500/10' },
  { k: 'A', label: 'Absent', on: 'bg-accent-600 text-white', ring: 'hover:bg-accent-50 dark:hover:bg-accent-500/10' },
  { k: 'E', label: 'Excused', on: 'bg-brand-600 text-white', ring: 'hover:bg-brand-50 dark:hover:bg-brand-500/10' },
];

export default function Attendance() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const isTeacher = user.role === 'teacher';
  const allowed = sortedClasses(db.classes).filter((c) => !isTeacher || c.classTeacherId === user.linkedId || db.allocations.some((a) => a.classId === c.id && a.teacherId === user.linkedId));
  const [classId, setClassId] = useState((isTeacher && db.classes.find((c) => c.classTeacherId === user.linkedId)?.id) || allowed[0]?.id);
  const [date, setDate] = useState(TODAY);
  const [tab, setTab] = useState('register');
  const students = db.students.filter((s) => s.classId === classId && s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName));
  const existing = db.attendance.find((a) => a.classId === classId && a.date === date);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    setMarks(existing ? { ...existing.records } : {});
  }, [classId, date, existing]);

  const counts = MARKS.reduce((acc, m) => ({ ...acc, [m.k]: Object.values(marks).filter((v) => v === m.k).length }), {});
  const unmarked = students.filter((s) => !marks[s.id]).length;

  const save = () => {
    if (unmarked) return toast.error('Register incomplete', `${unmarked} student(s) not marked`);
    db.upsert('attendance', { id: `${date}|${classId}`, date, classId, records: marks, takenBy: user.linkedId });
    toast.success('Register saved', `${L.className(classId)} · ${fmtDate(date)}`);
  };
  const notify = () => {
    const absent = students.filter((s) => marks[s.id] === 'A');
    if (!absent.length) return toast.info('No absentees to notify');
    db.add('smsLog', { date: nowISO(), audience: `Parents of absentees · ${L.className(classId)}`, message: `BFIS: Your ward was marked ABSENT today (${fmtDate(date)}). Kindly contact the class teacher.`, recipients: absent.length, status: 'Delivered' });
    toast.success('SMS sent', `${absent.length} parent(s) notified`);
  };

  const summary = useMemo(() => {
    const recs = db.attendance.filter((a) => a.classId === classId);
    return students.map((s) => ({ id: s.id, student: s, ...attendanceStats(recs, s.id) }));
  }, [db.attendance, classId, students]);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Daily class register with instant absentee alerts"
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: 'register', label: 'Register' }, { value: 'summary', label: 'Summary' }]} />}
      />
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="label">Class</span>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} options={allowed.map((c) => ({ value: c.id, label: c.name }))} />
        </label>
        {tab === 'register' && (
          <label className="sm:w-56">
            <span className="label">Date</span>
            <Input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {tab === 'register' && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={CheckCheck} onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'P'])))}>All present</Button>
          </div>
        )}
      </Card>

      {tab === 'register' ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Present" value={counts.P} icon={ClipboardCheck} tone="green" sub={`${pct(counts.P + counts.L, students.length)}% in school`} />
            <StatCard label="Late" value={counts.L} icon={Clock} tone="amber" />
            <StatCard label="Absent" value={counts.A} icon={UserX} tone="red" />
            <StatCard label="Unmarked" value={unmarked} icon={Users} tone="navy" sub={existing ? 'Register already saved' : 'Not yet saved'} />
          </div>
          <Card className="overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {students.map((s, i) => (
                <div key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-3">
                    <span className="w-6 text-xs font-semibold text-slate-400">{i + 1}</span>
                    <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{fullName(s)}</p>
                      <p className="text-xs text-slate-500">{s.admissionNo}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:flex">
                    {MARKS.map((m) => (
                      <button
                        key={m.k}
                        onClick={() => setMarks({ ...marks, [s.id]: m.k })}
                        className={cx('rounded-xl px-3 py-2 text-xs font-bold transition', marks[s.id] === m.k ? m.on : cx('bg-slate-100 text-slate-500 dark:bg-white/5', m.ring))}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 p-4 dark:border-white/5 sm:flex-row sm:justify-end">
              <Button variant="soft-red" icon={Send} onClick={notify}>SMS parents of absentees</Button>
              <Button icon={Save} onClick={save}>Save register</Button>
            </div>
          </Card>
        </>
      ) : (
        <DataTable
          rows={summary}
          searchText={(r) => fullName(r.student)}
          initialSort={{ key: 'rate', dir: 'asc' }}
          columns={[
            { key: 'name', label: 'Student', sort: (r) => r.student.lastName, render: (r) => <div className="flex items-center gap-3"><Avatar name={fullName(r.student)} photo={photoKey('Student', r.student.id)} size="sm" /><span className="font-semibold">{fullName(r.student)}</span></div> },
            { key: 'P', label: 'Present' },
            { key: 'L', label: 'Late' },
            { key: 'A', label: 'Absent', render: (r) => <span className={r.A ? 'font-bold text-accent-600' : ''}>{r.A}</span> },
            { key: 'E', label: 'Excused', hideOnMobile: true },
            { key: 'rate', label: 'Rate', render: (r) => <Badge tone={r.rate >= 90 ? 'green' : r.rate >= 75 ? 'amber' : 'red'}>{r.rate}%</Badge> },
          ]}
        />
      )}
    </>
  );
}

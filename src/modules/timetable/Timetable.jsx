import { printOrShare, isPhone } from '../../lib/pdf';
import { useEffect, useMemo, useState } from 'react';
import { Printer, Pencil, Check, Coffee, Wand2, Eraser, Copy, Clock, Plus, Trash2, AlertTriangle, CalendarClock, Undo2, Lock, Info } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, sortedClasses, sortedPeriods } from '../../data/selectors';
import { DAYS } from '../../data/seed';
import { STARTER_PERIODS } from '../../data/starter';
import { uid } from '../../lib/format';
import { Card, CardHeader, PageHeader, Select, Button, IconButton, Tabs, Modal, Field, Input, EmptyState, Badge, toast, confirmDialog, cx } from '../../components/ui';

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
const FREE = 'border-dashed border-slate-200 text-slate-400 dark:border-white/10';

/** Subjects a class can be timetabled for: its own list, or (if none chosen yet) every subject of its level. */
export const classSubjects = (cls, subjects) => (cls?.subjectIds?.length ? cls.subjectIds : subjects.filter((s) => s.section === cls?.section).map((s) => s.id));

/**
 * Fills a class's week: each subject gets a fair share of the lesson periods, spread over the days,
 * never twice in a row, and never at a time its teacher is already teaching another class.
 * Each run gives a different arrangement (random order). With `keep`, lessons already placed stay and only free periods are filled.
 */
export function generateTimetable(db, classId, { keep = null, random = Math.random } = {}) {
  const cls = db.classes.find((c) => c.id === classId);
  const subs = classSubjects(cls, db.subjects);
  const lessons = sortedPeriods(db.periods).filter((p) => !p.isBreak);
  if (!subs.length || !lessons.length) return null;
  const teacherOf = (cid, sid) => db.allocations.find((a) => a.classId === cid && a.subjectId === sid)?.teacherId;
  const busy = new Set(); // teacher|day|period already used by other classes
  Object.entries(db.timetable || {}).forEach(([cid, days]) => {
    if (cid === classId) return;
    Object.entries(days || {}).forEach(([d, cells]) => Object.entries(cells || {}).forEach(([pid, sid]) => {
      const t = sid && teacherOf(cid, sid);
      if (t) busy.add(`${t}|${d}|${pid}`);
    }));
  });
  const slots = DAYS.length * lessons.length;
  const base = Math.floor(slots / subs.length);
  // Core subjects (listed first) get the spare periods.
  const left = Object.fromEntries(subs.map((s, i) => [s, base + (i < slots - base * subs.length ? 1 : 0)]));
  const perDay = Object.fromEntries(subs.map((s) => [s, Math.ceil(left[s] / DAYS.length)]));
  // A fresh random order and daily shift each run, so "Re-create" really gives a new timetable.
  const order = [...subs].sort(() => random() - 0.5);
  const shift = DAYS.map(() => Math.floor(random() * subs.length));
  const kept = (d, pid) => (keep?.[d]?.[pid] && subs.includes(keep[d][pid]) ? keep[d][pid] : null);
  if (keep) DAYS.forEach((d) => lessons.forEach((p) => { const k = kept(d, p.id); if (k) left[k]--; }));
  const grid = {};
  let clashes = 0;
  DAYS.forEach((d, di) => {
    grid[d] = {};
    const today = {};
    if (keep) lessons.forEach((p) => { const k = kept(d, p.id); if (k) { grid[d][p.id] = k; today[k] = (today[k] || 0) + 1; } });
    lessons.forEach((p, pi) => {
      if (grid[d][p.id]) return; // kept lesson
      const prev = pi > 0 ? grid[d][lessons[pi - 1].id] : null;
      const next = pi < lessons.length - 1 ? grid[d][lessons[pi + 1].id] : null;
      const rank = (s) => [
        left[s] <= 0 ? 1 : 0,
        busy.has(`${teacherOf(classId, s)}|${d}|${p.id}`) ? 1 : 0,
        (today[s] || 0) >= perDay[s] ? 1 : 0,
        s === prev || s === next ? 1 : 0,
        (((order.indexOf(s) - pi - shift[di]) % subs.length) + subs.length) % subs.length,
        -left[s],
      ];
      const pick = [...order].sort((x0, y0) => {
        const x = rank(x0), y = rank(y0);
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
        return 0;
      })[0];
      if (left[pick] <= 0) return; // every subject has its share: leave the period free
      if (busy.has(`${teacherOf(classId, pick)}|${d}|${p.id}`)) clashes++;
      grid[d][p.id] = pick;
      left[pick]--;
      today[pick] = (today[pick] || 0) + 1;
    });
  });
  return { grid, clashes };
}

/** Problems in the bell times: periods that overlap, and unexplained gaps. */
export function bellProblems(periods) {
  const list = sortedPeriods(periods).filter((p) => p.start && p.end);
  const out = [];
  list.forEach((p, i) => {
    if (p.end <= p.start) out.push({ type: 'error', text: `${p.label} ends before it starts` });
    const n = list[i + 1];
    if (!n) return;
    if (n.start < p.end) out.push({ type: 'error', text: `${n.label} starts at ${n.start}, before ${p.label} ends (${p.end})` });
    else if (n.start > p.end) out.push({ type: 'warn', text: `Nothing is set between ${p.end} and ${n.start} (after ${p.label})` });
  });
  return out;
}

export default function Timetable() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const { student } = usePortalStudent();
  const isTeacher = user.role === 'teacher';
  const canEdit = user.role === 'admin' || user.role === 'headteacher' || user.role === 'superadmin';
  const portal = ['parent', 'student'].includes(user.role);
  const classes = sortedClasses(db.classes);
  const periods = sortedPeriods(db.periods);
  const [mode, setMode] = useState(isTeacher ? 'mine' : 'class');
  const [pickedClass, setClassId] = useState(student?.classId || (isTeacher ? db.classes.find((c) => c.classTeacherId === user.linkedId)?.id : null) || classes[0]?.id);
  const [editing, setEditing] = useState(false);
  const [bells, setBells] = useState(false);
  const [copyFrom, setCopyFrom] = useState(null);
  const classId = db.classes.some((c) => c.id === pickedClass) ? pickedClass : classes[0]?.id;
  const effectiveClass = portal ? student?.classId : classId;
  const cls = L.cls(effectiveClass);
  const grid = db.timetable?.[effectiveClass] || {};
  const subs = classSubjects(cls, db.subjects);
  const colorOf = (sid) => (sid ? COLORS[Math.max(0, subs.indexOf(sid)) % COLORS.length] : FREE);
  const teacherOf = (cid, sid) => db.allocations.find((a) => a.classId === cid && a.subjectId === sid)?.teacherId;

  // Teacher personal view: cells where the teacher teaches the scheduled subject.
  const myGrid = useMemo(() => {
    if (!isTeacher) return {};
    const alloc = db.allocations.filter((a) => a.teacherId === user.linkedId);
    const g = {};
    DAYS.forEach((d) => {
      g[d] = {};
      db.periods.forEach((p) => {
        const hit = alloc.find((a) => db.timetable?.[a.classId]?.[d]?.[p.id] === a.subjectId);
        if (hit) g[d][p.id] = hit;
      });
    });
    return g;
  }, [db, isTeacher, user.linkedId]);

  // Another class that has the same teacher at the same time.
  const clashWith = (day, pid, sid) => {
    const t = sid && teacherOf(effectiveClass, sid);
    if (!t) return null;
    const other = Object.entries(db.timetable || {}).find(([cid, days]) => cid !== effectiveClass && days?.[day]?.[pid] && teacherOf(cid, days[day][pid]) === t);
    return other ? L.className(other[0]) : null;
  };

  const setCell = (day, pid, sid) => {
    db.setKey('timetable', (t) => {
      const c = { ...(t?.[effectiveClass] || {}) };
      c[day] = { ...(c[day] || {}), [pid]: sid || undefined };
      if (!sid) delete c[day][pid];
      return { ...(t || {}), [effectiveClass]: c };
    });
    const clash = clashWith(day, pid, sid);
    if (clash) toast.info('Teacher clash', `${L.staffName(teacherOf(effectiveClass, sid))} already teaches ${clash} on ${day} at that time`);
  };

  const filled = DAYS.reduce((a, d) => a + Object.values(grid[d] || {}).filter(Boolean).length, 0);

  const [ask, setAsk] = useState(null); // { all } while choosing how to create
  const [undo, setUndo] = useState(null); // timetable before the last automatic change
  const autoFill = (all = false) => {
    if (!periods.some((p) => !p.isBreak)) return toast.error('No lesson periods', 'Set your bell times first');
    setAsk({ all });
  };
  const runAuto = (keepPlaced) => {
    const all = ask.all;
    setAsk(null);
    const targets = all ? classes : [cls];
    let made = 0;
    let clashes = 0;
    const state = useDB.getState();
    const before = state.timetable || {};
    const next = { ...before };
    targets.forEach((c) => {
      const r = generateTimetable({ ...state, timetable: next }, c.id, { keep: keepPlaced ? before[c.id] : null });
      if (!r) return;
      next[c.id] = r.grid;
      made++;
      clashes += r.clashes;
    });
    if (!made) return toast.error('Nothing to timetable', 'Give the class some subjects first (Classes & Subjects → Edit class)');
    setUndo(before);
    db.setKey('timetable', next);
    toast.success(all ? `${made} timetables created` : keepPlaced ? 'Free periods filled' : 'New timetable made', clashes ? `${clashes} lesson(s) could not avoid a teacher clash — check the highlighted cells` : noTeachers ? 'Tap Undo to go back' : 'No teacher clashes · tap Undo to go back');
    setEditing(true);
  };
  const doUndo = () => {
    db.setKey('timetable', undo);
    setUndo(null);
    toast.success('Timetable restored', 'Back to how it was before');
  };
  const noTeachers = !db.allocations.length;
  const bell = bellProblems(db.periods);

  const clear = async () => {
    if (!(await confirmDialog(`Clear ${cls.name}'s timetable?`, 'Every lesson for this class is removed.', { confirmLabel: 'Clear' }))) return;
    db.setKey('timetable', (t) => { const n = { ...(t || {}) }; delete n[effectiveClass]; return n; });
    toast.success('Timetable cleared');
  };

  const doCopy = () => {
    const src = db.timetable?.[copyFrom];
    if (!src) return toast.error('That class has no timetable yet');
    const mine = new Set(subs);
    const out = Object.fromEntries(Object.entries(src).map(([d, cells]) => [d, Object.fromEntries(Object.entries(cells || {}).filter(([, sid]) => mine.has(sid)))]));
    db.setKey('timetable', (t) => ({ ...(t || {}), [effectiveClass]: out }));
    toast.success('Timetable copied', `From ${L.className(copyFrom)} · subjects ${cls.name} doesn't take were left free`);
    setCopyFrom(null);
  };

  if (!classes.length && !portal)
    return (
      <>
        <PageHeader title="Timetable" subtitle="Weekly lesson schedule" />
        <Card><EmptyState icon={CalendarClock} title="No classes yet" text="Create your classes and their subjects first (Classes & Subjects), then build each class's timetable here." /></Card>
      </>
    );
  if (portal && !cls) return <Card><EmptyState icon={CalendarClock} title="No timetable yet" text="Your class timetable will show here once the school publishes it." /></Card>;

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={mode === 'mine' ? 'Your teaching schedule for the week' : `${cls?.name} · ${filled} lesson${filled === 1 ? '' : 's'} a week`}
        actions={
          <>
            {isTeacher && <Tabs value={mode} onChange={setMode} tabs={[{ value: 'mine', label: 'My schedule' }, { value: 'class', label: 'By class' }]} />}
            {!portal && mode === 'class' && <Select className="!w-48" value={classId} onChange={(e) => { setClassId(e.target.value); }} options={classes.map((c) => ({ value: c.id, label: c.name }))} />}
            {canEdit && mode === 'class' && (
              <Button variant={editing ? 'primary' : 'secondary'} icon={editing ? Check : Pencil} onClick={() => { if (editing) toast.success('Timetable saved'); setEditing(!editing); }}>
                {editing ? 'Done' : 'Edit'}
              </Button>
            )}
            {canEdit && <Button variant="secondary" icon={Clock} onClick={() => setBells(true)}>Bell times</Button>}
            <Button variant="secondary" icon={Printer} onClick={() => printOrShare(document.querySelector('main'), document.title).catch((e) => toast.error('Could not make the PDF', e.message))}>{isPhone() ? 'Share PDF' : 'Print'}</Button>
          </>
        }
      />

      {canEdit && mode === 'class' && (
        <Card className="no-print mb-4 flex flex-wrap items-center gap-2 p-3">
          <Button size="sm" icon={Wand2} onClick={() => autoFill(false)}>{filled ? 'Re-create' : 'Create'} {cls.name} automatically</Button>
          {classes.length > 1 && <Button size="sm" variant="secondary" icon={Wand2} onClick={() => autoFill(true)}>Create all classes</Button>}
          {classes.length > 1 && <Button size="sm" variant="secondary" icon={Copy} onClick={() => setCopyFrom(classes.find((c) => c.id !== effectiveClass && db.timetable?.[c.id])?.id || classes.find((c) => c.id !== effectiveClass)?.id)}>Copy from…</Button>}
          {undo && <Button size="sm" variant="secondary" icon={Undo2} onClick={doUndo}>Undo</Button>}
          {filled > 0 && <Button size="sm" variant="ghost" icon={Eraser} className="hover:!text-accent-600" onClick={clear}>Clear</Button>}
          <p className="ml-auto text-xs text-slate-500">{editing ? 'Tap a lesson to change it. Red = the teacher is already in another class then.' : 'Tap Edit to change lessons by hand.'}</p>
        </Card>
      )}
      {canEdit && mode === 'class' && noTeachers && (
        <p className="no-print mb-4 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200"><Info className="h-4 w-4 shrink-0" /> No teachers are linked to subjects yet, so clashes between classes can't be checked. Link them in Classes & Subjects (open a class, choose each subject's teacher).</p>
      )}
      {canEdit && bell.some((x) => x.type === 'error') && (
        <p className="no-print mb-4 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-800 dark:bg-accent-500/10 dark:text-accent-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Bell times need fixing: {bell.filter((x) => x.type === 'error').map((x) => x.text).join(' · ')}. <button className="font-semibold underline" onClick={() => setBells(true)}>Open bell times</button></span></p>
      )}
      {mode === 'class' && !subs.length && (
        <p className="no-print mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> {cls.name} has no subjects yet. Add them in Classes & Subjects → Edit class.</p>
      )}
      {!periods.length ? (
        <Card><EmptyState icon={Clock} title="No bell times yet" text="Set the school's lesson periods and breaks first." action={canEdit && <Button icon={Clock} onClick={() => setBells(true)}>Set bell times</Button>} /></Card>
      ) : (
        <Card className="print-area overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-1.5 p-3">
            <thead>
              <tr>
                <th className="w-28 text-left text-xs font-semibold uppercase text-slate-400">Day</th>
                {periods.map((p) => (
                  <th key={p.id} className={cx('text-center', p.isBreak && 'w-14')}>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.label}</p>
                    <p className="text-[10px] font-medium text-slate-400">{p.start}{p.end ? `–${p.end}` : ''}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <td className="pr-2 text-sm font-bold text-slate-700 dark:text-slate-200">{d}</td>
                  {periods.map((p) => {
                    if (p.isBreak)
                      return (
                        <td key={p.id} className="rounded-xl bg-slate-50 text-center dark:bg-white/[.03]" title={p.label}>
                          <Coffee className="mx-auto h-4 w-4 text-slate-300" />
                        </td>
                      );
                    if (mode === 'mine') {
                      const a = myGrid[d]?.[p.id];
                      return (
                        <td key={p.id} className={cx('h-16 rounded-xl border p-2 align-top', a ? 'border-brand-100 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10' : FREE)}>
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
                    const teacher = teacherOf(effectiveClass, sid);
                    const clash = editing && clashWith(d, p.id, sid);
                    return (
                      <td key={p.id} className={cx('h-16 rounded-xl border p-2 align-top', colorOf(sid), clash && '!border-accent-400 ring-2 ring-accent-300')} title={clash ? `Teacher clash with ${clash}` : undefined}>
                        <div className={cx('relative', editing && 'cursor-pointer')}>
                          <p className="line-clamp-2 pr-3 text-xs font-bold">{sid ? L.subjectName(sid) : editing ? '+ Add' : 'Free'}</p>
                          {teacher && <p className="mt-0.5 truncate text-[10px] opacity-70">{L.staff(teacher)?.lastName}</p>}
                          {editing && (
                            <>
                              <Pencil className="absolute right-0 top-0 h-3 w-3 opacity-50" />
                              {/* The whole cell opens the phone's own picker. */}
                              <select aria-label={`${d} ${p.label}`} value={sid || ''} onChange={(e) => setCell(d, p.id, e.target.value)} className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer opacity-0">
                                <option value="">Free</option>
                                {subs.map((s) => <option key={s} value={s}>{L.subjectName(s)}</option>)}
                              </select>
                            </>
                          )}
                        </div>
                        {clash && <p className="mt-0.5 truncate text-[10px] font-semibold text-accent-600">Also in {clash}</p>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {mode === 'class' && subs.length > 0 && filled > 0 && (
        <Card className="no-print mt-4">
          <CardHeader title="Lessons per week" subtitle={cls.name} />
          <div className="flex flex-wrap gap-2 p-4">
            {subs.map((s) => {
              const n = DAYS.reduce((a, d) => a + Object.values(grid[d] || {}).filter((x) => x === s).length, 0);
              return <Badge key={s} tone={n ? 'blue' : 'amber'}>{L.subjectName(s)} · {n}</Badge>;
            })}
          </div>
        </Card>
      )}

      <Modal open={!!copyFrom} onClose={() => setCopyFrom(null)} title={`Copy a timetable into ${cls?.name}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setCopyFrom(null)}>Cancel</Button><Button icon={Copy} onClick={doCopy}>Copy</Button></>}>
        <Field label="Copy from">
          <Select value={copyFrom || ''} onChange={(e) => setCopyFrom(e.target.value)} options={classes.filter((c) => c.id !== effectiveClass).map((c) => ({ value: c.id, label: `${c.name}${db.timetable?.[c.id] ? '' : ' (empty)'}` }))} />
        </Field>
        <p className="mt-3 text-xs text-slate-500">{cls?.name}'s current lessons are replaced.</p>
      </Modal>

      <BellTimes open={bells} onClose={() => setBells(false)} />
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask?.all ? `Create timetables for all ${classes.length} classes` : `Create ${cls?.name}'s timetable`} size="sm">
        <div className="space-y-3">
          <button onClick={() => runAuto(false)} className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:hover:bg-white/5">
            <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Wand2 className="h-4 w-4 text-brand-600" /> New arrangement</p>
            <p className="mt-1 text-sm text-slate-500">Replaces {ask?.all ? 'every class timetable' : 'the whole timetable'} with a fresh one. Each press gives a different arrangement.</p>
          </button>
          <button onClick={() => runAuto(true)} className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:hover:bg-white/5">
            <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Lock className="h-4 w-4 text-brand-600" /> Keep my lessons, fill the free periods</p>
            <p className="mt-1 text-sm text-slate-500">Lessons already placed stay where they are; only empty periods are filled.</p>
          </button>
          <p className="text-xs text-slate-500">Each subject gets a fair share of the week, never twice in a row, and kept clear of teacher clashes where possible. You can Undo straight after.</p>
        </div>
      </Modal>
    </>
  );
}

/** The school day: lesson periods and breaks with their times. Shared by every class. */
function BellTimes({ open, onClose }) {
  const periods = useDB((s) => s.periods);
  const db = useDB.getState;
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (open) setRows(sortedPeriods(useDB.getState().periods).map((p) => ({ ...p })));
  }, [open]);
  const list = rows ?? [];
  const edit = (i, patch) => setRows(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (isBreak) => {
    const last = list[list.length - 1];
    const start = last?.end || '08:00';
    const [h, m] = start.split(':').map(Number);
    const mins = h * 60 + m + (isBreak ? 30 : 40);
    const end = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const n = list.filter((r) => !r.isBreak).length + 1;
    setRows([...list, { id: uid('per'), label: isBreak ? 'Break' : `P${n}`, start, end, isBreak, _new: true }]);
  };
  const close = () => { setRows(null); onClose(); };
  const save = async () => {
    const bad = list.find((r) => !r.label?.trim() || !r.start || !r.end || r.end <= r.start);
    if (bad) return toast.error('Check the times', `${bad.label || 'A period'}: each one needs a name and must end after it starts`);
    const probs = bellProblems(list);
    const overlap = probs.find((x) => x.type === 'error');
    if (overlap) return toast.error('Times overlap', overlap.text);
    const gaps = probs.filter((x) => x.type === 'warn');
    if (gaps.length && !(await confirmDialog('Save with gaps?', `${gaps.map((g) => g.text).join(' · ')}. Save anyway?`, { danger: false, confirmLabel: 'Save anyway' }))) return;
    const keep = new Set(list.map((r) => r.id));
    const removed = periods.filter((p) => !keep.has(p.id)).map((p) => p.id);
    const clean = list.map((r) => ({ id: r.id, label: r.label.trim(), start: r.start, end: r.end, isBreak: !!r.isBreak }));
    db().bulkUpsert('periods', clean);
    if (removed.length) {
      db().removeMany('periods', removed);
      const gone = new Set(removed);
      db().setKey('timetable', (t) => Object.fromEntries(Object.entries(t || {}).map(([cid, days]) => [cid, Object.fromEntries(Object.entries(days || {}).map(([d, cells]) => [d, Object.fromEntries(Object.entries(cells || {}).filter(([pid]) => !gone.has(pid)))]))])));
    }
    // Lessons turned into breaks lose their subject.
    const nowBreak = new Set(clean.filter((r) => r.isBreak).map((r) => r.id));
    if (nowBreak.size) db().setKey('timetable', (t) => Object.fromEntries(Object.entries(t || {}).map(([cid, days]) => [cid, Object.fromEntries(Object.entries(days || {}).map(([d, cells]) => [d, Object.fromEntries(Object.entries(cells || {}).filter(([pid]) => !nowBreak.has(pid)))]))])));
    toast.success('Bell times saved', `${clean.filter((r) => !r.isBreak).length} lessons, ${clean.filter((r) => r.isBreak).length} breaks`);
    close();
  };
  return (
    <Modal open={open} onClose={close} title="Bell times" subtitle="Lesson periods and breaks for every class" size="lg"
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button icon={Check} onClick={save}>Save bell times</Button></>}>
      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_110px_110px_90px_40px] gap-2 px-1 text-[11px] font-semibold uppercase text-slate-400 sm:grid">
          <span>Name</span><span>Starts</span><span>Ends</span><span>Break?</span><span />
        </div>
        {[...list].map((r, i) => (
          <div key={r.id} className={cx('grid grid-cols-2 gap-2 rounded-xl p-2 sm:grid-cols-[1fr_110px_110px_90px_40px] sm:items-center', r.isBreak ? 'bg-amber-50/60 dark:bg-amber-500/5' : 'bg-slate-50 dark:bg-white/[.03]')}>
            <Input className="col-span-2 sm:col-span-1" value={r.label} onChange={(e) => edit(i, { label: e.target.value })} placeholder="e.g. P1 or Lunch" aria-label="Period name" />
            <Input type="time" value={r.start} onChange={(e) => edit(i, { start: e.target.value })} aria-label="Starts" />
            <Input type="time" value={r.end} onChange={(e) => edit(i, { end: e.target.value })} aria-label="Ends" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!r.isBreak} onChange={(e) => edit(i, { isBreak: e.target.checked })} /> Break</label>
            <IconButton icon={Trash2} label="Remove" className="justify-self-end hover:!text-accent-600" onClick={() => setRows(list.filter((_, j) => j !== i))} />
          </div>
        ))}
        {!list.length && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-white/5">No periods yet.</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => addRow(false)}>Add lesson</Button>
          <Button size="sm" variant="secondary" icon={Coffee} onClick={() => addRow(true)}>Add break</Button>
          {!list.length && <Button size="sm" variant="ghost" onClick={() => setRows(STARTER_PERIODS.map((p) => ({ ...p })))}>Use a standard day (8:00–2:35)</Button>}
        </div>
        {bellProblems(list).map((x, i) => (
          <p key={i} className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs', x.type === 'error' ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {x.text}</p>
        ))}
        <p className="pt-1 text-xs text-slate-500">Periods are shown in time order. Removing a period also removes its lessons from every class.</p>
      </div>
    </Modal>
  );
}

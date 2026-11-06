import { useEffect, useMemo, useState } from 'react';
import { Save, Download, BarChart3, BookOpen } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses } from '../../data/selectors';
import { fullName, downloadCSV } from '../../lib/format';
import { gradeFor, gradeTone, CLASS_SCORE_MAX, EXAM_SCORE_MAX, SCALES, SECTION_SCALE } from '../../lib/grading';
import { Card, CardHeader, PageHeader, Select, Button, Avatar, Badge, Tabs, SearchInput, EmptyState, toast, cx } from '../../components/ui';
import { photoKey } from '../../data/photos';

const sortTerms = (terms) => [...terms].sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
const matches = (s, q) => !q.trim() || `${fullName(s)} ${s.admissionNo}`.toLowerCase().includes(q.trim().toLowerCase());

export default function Gradebook() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const isTeacher = user.role === 'teacher';
  // Teachers: only the classes and subjects they are linked to. Head Teacher / Owner: every class and its subjects.
  const myAlloc = isTeacher
    ? db.allocations.filter((a) => a.teacherId === user.linkedId)
    : db.classes.flatMap((c) => (c.subjectIds || []).map((sid) => ({ classId: c.id, subjectId: sid })));
  const classOpts = sortedClasses(db.classes).filter((c) => myAlloc.some((a) => a.classId === c.id));
  const [mode, setMode] = useState('class');
  const [classId, setClassId] = useState(classOpts[0]?.id);
  const subjOpts = myAlloc.filter((a) => a.classId === classId).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));
  const [subjectId, setSubjectId] = useState(subjOpts[0]?.value);
  const [termId, setTermId] = useState(db.settings.currentTerm || sortTerms(db.terms).slice(-1)[0]?.id);
  const [edits, setEdits] = useState({});
  const [q, setQ] = useState('');
  const cls = L.cls(classId);

  useEffect(() => {
    if (!subjOpts.some((o) => o.value === subjectId)) setSubjectId(subjOpts[0]?.value);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setEdits({}), [classId, subjectId, termId, mode]);

  const students = db.students.filter((s) => s.classId === classId && s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName));
  const recFor = (sid, sub = subjectId) => {
    const base = db.scores.find((r) => r.studentId === sid && r.subjectId === sub && r.termId === termId);
    return { classScore: base?.classScore ?? '', examScore: base?.examScore ?? '', ...edits[`${sid}|${sub}`] };
  };
  const setVal = (sid, k, raw, max, sub = subjectId) => {
    const v = raw === '' ? '' : Math.max(0, Math.min(max, Number(raw)));
    setEdits((e) => ({ ...e, [`${sid}|${sub}`]: { ...recFor(sid, sub), ...e[`${sid}|${sub}`], [k]: v } }));
  };

  const rows = students.map((s) => {
    const r = recFor(s.id);
    const total = r.classScore === '' && r.examScore === '' ? null : (Number(r.classScore) || 0) + (Number(r.examScore) || 0);
    return { s, r, total };
  });
  const ranked = useMemo(() => {
    const t = rows.filter((x) => x.total != null).map((x) => x.total).sort((a, b) => b - a);
    return (v) => (v == null ? '—' : t.indexOf(v) + 1);
  }, [rows]);
  const totals = rows.filter((x) => x.total != null).map((x) => x.total);
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const shown = rows.filter((x) => matches(x.s, q));

  // One student: find by admission number or name among the classes this person may mark.
  const [pickId, setPickId] = useState('');
  const myClassIds = new Set(classOpts.map((c) => c.id));
  const findable = db.students.filter((s) => s.status === 'Active' && myClassIds.has(s.classId));
  const hits = q.trim() ? findable.filter((s) => matches(s, q)).slice(0, 8) : [];
  const picked = db.students.find((s) => s.id === pickId);
  const pickedSubjects = picked ? myAlloc.filter((a) => a.classId === picked.classId).map((a) => a.subjectId) : [];
  const exact = q.trim() && findable.find((s) => String(s.admissionNo).toLowerCase() === q.trim().toLowerCase());
  useEffect(() => {
    if (mode === 'student' && exact && exact.id !== pickId) setPickId(exact.id);
  }, [mode, exact, pickId]);

  const save = () => {
    const n = Object.keys(edits).length;
    if (!n) return toast.info('No changes to save');
    Object.entries(edits).forEach(([key, v]) => {
      const [sid, sub] = key.split('|');
      const stu = db.students.find((x) => x.id === sid);
      db.upsert('scores', { id: `scr_${sid}_${sub}_${termId}`, studentId: sid, subjectId: sub, classId: stu?.classId || classId, termId, classScore: Number(v.classScore) || 0, examScore: Number(v.examScore) || 0 });
    });
    setEdits({});
    toast.success('Scores saved', `${n} score${n === 1 ? '' : 's'} updated`);
  };

  if (!classOpts.length)
    return (
      <>
        <PageHeader title="Gradebook" subtitle="Enter continuous assessment and exam scores" />
        <Card><EmptyState icon={BookOpen} title={isTeacher ? 'No subjects linked to you yet' : 'No subjects on your classes yet'} text={isTeacher ? 'Ask the Head Teacher to link you to your subjects (Classes & Subjects → open a class → choose the teacher for each subject). Then you can enter marks here.' : 'Give each class its subjects in Classes & Subjects, and link a teacher to each subject.'} /></Card>
      </>
    );

  const scale = SCALES[SECTION_SCALE[cls?.section] || 'basic'];

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle="Enter continuous assessment and exam scores — grades and positions calculate automatically"
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => downloadCSV(`scores-${cls?.name}-${L.subjectName(subjectId)}`, rows.map((x) => ({ Student: fullName(x.s), 'Class score': x.r.classScore, 'Exam score': x.r.examScore, Total: x.total ?? '', Grade: x.total != null ? gradeFor(x.total, cls.section).grade : '' })))}>
              Export
            </Button>
            <Button icon={Save} onClick={save}>Save scores{Object.keys(edits).length ? ` (${Object.keys(edits).length})` : ''}</Button>
          </>
        }
      />
      <Tabs className="mb-4" value={mode} onChange={(m) => { setMode(m); setQ(''); }} tabs={[{ value: 'class', label: 'Whole class' }, { value: 'student', label: 'One student' }]} />
      <Card className={cx('mb-6 grid gap-3 p-4', mode === 'class' ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
        {mode === 'class' && <label><span className="label">Class</span><Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOpts.map((c) => ({ value: c.id, label: c.name }))} /></label>}
        {mode === 'class' && <label><span className="label">Subject</span><Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} options={subjOpts} /></label>}
        <label><span className="label">Term</span><Select value={termId || ''} onChange={(e) => setTermId(e.target.value)} placeholder={db.terms.length ? undefined : 'Add terms first'} options={sortTerms(db.terms).map((t) => ({ value: t.id, label: t.name }))} /></label>
        <label><span className="label">{mode === 'class' ? 'Find in this class' : 'Student'}</span><SearchInput value={q} onChange={setQ} placeholder="Admission no. or name" /></label>
      </Card>

      {mode === 'student' ? (
        <StudentMarks {...{ q, hits, picked, setPickId, setQ, pickedSubjects, recFor, setVal, edits, L, termId, db }} />
      ) : (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 dark:bg-white/[.03]">
                <tr>
                  <th className="th">Student</th>
                  <th className="th text-center">Class ({CLASS_SCORE_MAX})</th>
                  <th className="th text-center">Exam ({EXAM_SCORE_MAX})</th>
                  <th className="th text-center">Total</th>
                  <th className="th text-center">Grade</th>
                  <th className="th text-center">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {shown.length === 0 && <tr><td colSpan={6} className="td text-center text-sm text-slate-500">{students.length ? 'No student matches that search.' : 'No active students in this class.'}</td></tr>}
                {shown.map(({ s, r, total }) => {
                  const g = total != null ? gradeFor(total, cls.section) : null;
                  return (
                    <tr key={s.id} className={cx(edits[`${s.id}|${subjectId}`] && 'bg-amber-50/60 dark:bg-amber-500/5')}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="xs" />
                          <span><span className="block font-medium">{fullName(s)}</span><span className="text-[11px] text-slate-400">{s.admissionNo}</span></span>
                        </div>
                      </td>
                      <td className="td text-center">
                        <input type="number" min="0" max={CLASS_SCORE_MAX} value={r.classScore} onChange={(e) => setVal(s.id, 'classScore', e.target.value, CLASS_SCORE_MAX)} className="input w-20 !py-1.5 text-center" />
                      </td>
                      <td className="td text-center">
                        <input type="number" min="0" max={EXAM_SCORE_MAX} value={r.examScore} onChange={(e) => setVal(s.id, 'examScore', e.target.value, EXAM_SCORE_MAX)} className="input w-20 !py-1.5 text-center" />
                      </td>
                      <td className="td text-center text-base font-extrabold">{total ?? '—'}</td>
                      <td className="td text-center">{g ? <Badge tone={gradeTone(total)}>{g.grade}</Badge> : '—'}</td>
                      <td className="td text-center text-slate-500">{ranked(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Class statistics" icon={BarChart3} />
            <div className="grid grid-cols-3 gap-2 p-5 text-center">
              <div><p className="text-2xl font-extrabold text-brand-700 dark:text-brand-300">{avg}</p><p className="text-[10px] font-semibold uppercase text-slate-400">Average</p></div>
              <div><p className="text-2xl font-extrabold text-emerald-600">{totals.length ? Math.max(...totals) : 0}</p><p className="text-[10px] font-semibold uppercase text-slate-400">Highest</p></div>
              <div><p className="text-2xl font-extrabold text-accent-600">{totals.length ? Math.min(...totals) : 0}</p><p className="text-[10px] font-semibold uppercase text-slate-400">Lowest</p></div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Grading scale" subtitle={scale.name} />
            <div className="space-y-1.5 p-5 text-sm">
              {scale.bands.map((b, i) => (
                <div key={b.grade} className="flex items-center justify-between">
                  <Badge tone={gradeTone(b.min || 1)}>{b.grade}</Badge>
                  <span className="text-slate-500">{b.min}–{i === 0 ? 100 : scale.bands[i - 1].min - 1}</span>
                  <span className="w-28 text-right text-xs text-slate-500">{b.remark}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      )}
    </>
  );
}

/** One student, every subject this person teaches them: find by admission number or name. */
function StudentMarks({ q, hits, picked, setPickId, setQ, pickedSubjects, recFor, setVal, edits, L, termId, db }) {
  if (!picked)
    return (
      <Card className="p-2">
        {!q.trim() && <p className="p-4 text-sm text-slate-500">Type the student's admission number or name above.</p>}
        {q.trim() && !hits.length && <p className="p-4 text-sm text-slate-500">No student found in the classes you mark.</p>}
        {hits.map((s) => (
          <button key={s.id} onClick={() => { setPickId(s.id); setQ(s.admissionNo || fullName(s)); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
            <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="sm" />
            <span className="flex-1"><span className="block font-semibold">{fullName(s)}</span><span className="text-xs text-slate-500">{s.admissionNo} · {L.className(s.classId)}</span></span>
          </button>
        ))}
      </Card>
    );
  const section = L.cls(picked.classId)?.section;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-white/5">
        <Avatar name={fullName(picked)} photo={photoKey('Student', picked.id)} />
        <div className="flex-1"><p className="font-bold">{fullName(picked)}</p><p className="text-xs text-slate-500">{picked.admissionNo} · {L.className(picked.classId)} · {db.terms.find((t) => t.id === termId)?.name}</p></div>
        <Button size="sm" variant="ghost" onClick={() => { setPickId(''); setQ(''); }}>Another student</Button>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50/80 dark:bg-white/[.03]">
          <tr><th className="th">Subject</th><th className="th text-center">Class ({CLASS_SCORE_MAX})</th><th className="th text-center">Exam ({EXAM_SCORE_MAX})</th><th className="th text-center">Total</th><th className="th text-center">Grade</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {pickedSubjects.map((sub) => {
            const r = recFor(picked.id, sub);
            const total = r.classScore === '' && r.examScore === '' ? null : (Number(r.classScore) || 0) + (Number(r.examScore) || 0);
            const g = total != null ? gradeFor(total, section) : null;
            return (
              <tr key={sub} className={cx(edits[`${picked.id}|${sub}`] && 'bg-amber-50/60 dark:bg-amber-500/5')}>
                <td className="td font-medium">{L.subjectName(sub)}</td>
                <td className="td text-center"><input type="number" aria-label={`${L.subjectName(sub)} class score`} min="0" max={CLASS_SCORE_MAX} value={r.classScore} onChange={(e) => setVal(picked.id, 'classScore', e.target.value, CLASS_SCORE_MAX, sub)} className="input w-20 !py-1.5 text-center" /></td>
                <td className="td text-center"><input type="number" aria-label={`${L.subjectName(sub)} exam score`} min="0" max={EXAM_SCORE_MAX} value={r.examScore} onChange={(e) => setVal(picked.id, 'examScore', e.target.value, EXAM_SCORE_MAX, sub)} className="input w-20 !py-1.5 text-center" /></td>
                <td className="td text-center text-base font-extrabold">{total ?? '—'}</td>
                <td className="td text-center">{g ? <Badge tone={gradeTone(total)}>{g.grade}</Badge> : '—'}</td>
              </tr>
            );
          })}
          {!pickedSubjects.length && <tr><td colSpan={5} className="td text-center text-sm text-slate-500">You have no subjects linked for this student's class.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

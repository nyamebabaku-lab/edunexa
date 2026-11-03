import { useEffect, useMemo, useState } from 'react';
import { Save, Download, BarChart3 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses } from '../../data/selectors';
import { fullName, downloadCSV } from '../../lib/format';
import { gradeFor, gradeTone, CLASS_SCORE_MAX, EXAM_SCORE_MAX, SCALES, SECTION_SCALE } from '../../lib/grading';
import { Card, CardHeader, PageHeader, Select, Button, Avatar, Badge, toast, cx } from '../../components/ui';
import { photoKey } from '../../data/photos';

export default function Gradebook() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const isTeacher = user.role === 'teacher';
  const myAlloc = db.allocations.filter((a) => !isTeacher || a.teacherId === user.linkedId);
  const classOpts = sortedClasses(db.classes).filter((c) => myAlloc.some((a) => a.classId === c.id));
  const [classId, setClassId] = useState(classOpts.find((c) => c.name === 'JHS 2')?.id || classOpts[0]?.id);
  const subjOpts = myAlloc.filter((a) => a.classId === classId).map((a) => ({ value: a.subjectId, label: L.subjectName(a.subjectId) }));
  const [subjectId, setSubjectId] = useState(subjOpts[0]?.value);
  const [termId, setTermId] = useState(db.settings.currentTerm);
  const [edits, setEdits] = useState({});
  const cls = L.cls(classId);

  useEffect(() => {
    if (!subjOpts.some((o) => o.value === subjectId)) setSubjectId(subjOpts[0]?.value);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setEdits({}), [classId, subjectId, termId]);

  const students = db.students.filter((s) => s.classId === classId && s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName));
  const recFor = (sid) => {
    const base = db.scores.find((r) => r.studentId === sid && r.subjectId === subjectId && r.termId === termId);
    return { classScore: base?.classScore ?? '', examScore: base?.examScore ?? '', ...edits[sid] };
  };
  const setVal = (sid, k, raw, max) => {
    const v = raw === '' ? '' : Math.max(0, Math.min(max, Number(raw)));
    setEdits((e) => ({ ...e, [sid]: { ...recFor(sid), ...e[sid], [k]: v } }));
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

  const save = () => {
    const n = Object.keys(edits).length;
    if (!n) return toast.info('No changes to save');
    Object.entries(edits).forEach(([sid, v]) => {
      db.upsert('scores', { id: `scr_${sid}_${subjectId}_${termId}`, studentId: sid, subjectId, classId, termId, classScore: Number(v.classScore) || 0, examScore: Number(v.examScore) || 0 });
    });
    setEdits({});
    toast.success('Scores saved', `${n} student(s) updated`);
  };

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
      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-3">
        <label><span className="label">Class</span><Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classOpts.map((c) => ({ value: c.id, label: c.name }))} /></label>
        <label><span className="label">Subject</span><Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} options={subjOpts} /></label>
        <label><span className="label">Term</span><Select value={termId} onChange={(e) => setTermId(e.target.value)} options={db.terms.slice(0, 2).map((t) => ({ value: t.id, label: t.name }))} /></label>
      </Card>

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
                {rows.map(({ s, r, total }) => {
                  const g = total != null ? gradeFor(total, cls.section) : null;
                  return (
                    <tr key={s.id} className={cx(edits[s.id] && 'bg-amber-50/60 dark:bg-amber-500/5')}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="xs" />
                          <span className="font-medium">{fullName(s)}</span>
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
    </>
  );
}

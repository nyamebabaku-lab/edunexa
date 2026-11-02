import { useMemo, useState } from 'react';
import { Printer, FileBadge, Trophy } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, sortedClasses, attendanceStats } from '../../data/selectors';
import { fullName, fmtDate, ordinal } from '../../lib/format';
import { gradeTone, SCALES, SECTION_SCALE } from '../../lib/grading';
import { classResults, autoRemark } from '../../lib/results';
import { Card, PageHeader, Select, Button, Avatar, Badge, DataTable } from '../../components/ui';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

export function ReportCardDoc({ row, cls, termId, total }) {
  const db = useDB();
  const L = useLookups();
  const term = db.terms.find((t) => t.id === termId);
  const s = row.student;
  const att = attendanceStats(db.attendance.filter((a) => a.classId === cls.id), s.id);
  const remarks = db.reportRemarks[`${termId}|${s.id}`] || {};
  const next = db.terms[db.terms.findIndex((t) => t.id === termId) + 1];
  const scale = SCALES[SECTION_SCALE[cls.section]];
  return (
    <Paper>
      <Letterhead title={`${cls.section === 'Diploma' ? 'Semester' : 'Terminal'} Report`} right={<p className="mt-2 text-xs text-slate-500">{term?.name}</p>} />
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
        <p>Name: <b>{fullName(s)}</b></p>
        <p>Adm. No: <b>{s.admissionNo}</b></p>
        <p>Class: <b>{cls.name}</b></p>
        <p>No. on roll: <b>{total}</b></p>
        <p>Position: <b className="text-accent-700">{ordinal(row.position)}</b></p>
        <p>Attendance: <b>{att.P + att.L} / {att.total}</b></p>
        {cls.programme && <p>Programme: <b>{cls.programme}</b></p>}
        <p>House: <b>{s.house || '—'}</b></p>
        <p>Vacation: <b>{fmtDate(term?.end)}</b></p>
      </div>
      <table className="mt-5 w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-brand-700 text-left text-white">
            <th className="border border-brand-800 px-2 py-1.5">Subject</th>
            <th className="border border-brand-800 px-2 py-1.5 text-center">Class (30)</th>
            <th className="border border-brand-800 px-2 py-1.5 text-center">Exam (70)</th>
            <th className="border border-brand-800 px-2 py-1.5 text-center">Total (100)</th>
            <th className="border border-brand-800 px-2 py-1.5 text-center">Grade</th>
            <th className="border border-brand-800 px-2 py-1.5 text-center">Pos.</th>
            <th className="border border-brand-800 px-2 py-1.5">Remark</th>
          </tr>
        </thead>
        <tbody>
          {row.subjects.map((x) => (
            <tr key={x.subjectId} className="odd:bg-slate-50">
              <td className="border border-slate-300 px-2 py-1">{L.subjectName(x.subjectId)}</td>
              <td className="border border-slate-300 px-2 py-1 text-center">{x.classScore ?? '—'}</td>
              <td className="border border-slate-300 px-2 py-1 text-center">{x.examScore ?? '—'}</td>
              <td className="border border-slate-300 px-2 py-1 text-center font-bold">{x.total ?? '—'}</td>
              <td className="border border-slate-300 px-2 py-1 text-center font-bold">{x.grade}</td>
              <td className="border border-slate-300 px-2 py-1 text-center">{x.position ? ordinal(x.position) : '—'}</td>
              <td className="border border-slate-300 px-2 py-1">{x.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 rounded-lg bg-brand-50 p-3 text-sm">
        <span>Total marks: <b>{row.total}</b></span>
        <span>Average: <b>{row.average}%</b></span>
        {cls.section === 'JHS' && <span>Aggregate (best 6): <b>{row.aggregate}</b></span>}
        {row.gpa && <span>GPA: <b>{row.gpa}</b> / 4.0</span>}
      </div>
      <div className="mt-5 space-y-3 text-sm">
        <p><span className="font-semibold">Conduct:</span> {remarks.conduct || 'Respectful and well behaved.'}</p>
        <p><span className="font-semibold">Interest:</span> {remarks.interest || 'Reading, sports and group activities.'}</p>
        <p><span className="font-semibold">Class teacher's remark:</span> {remarks.teacher || autoRemark(row.average)}</p>
        <p><span className="font-semibold">Head's remark:</span> {remarks.head || (row.average >= 60 ? 'Promising. Keep working hard.' : 'Can do better with more commitment.')}</p>
        {next && <p><span className="font-semibold">Next term begins:</span> {fmtDate(next.start, 'EEEE, d MMMM yyyy')}</p>}
      </div>
      <div className="mt-4 text-[10px] text-slate-500">
        Grading: {scale.bands.map((b) => `${b.grade} (${b.min}+)`).join(' · ')}
      </div>
      <div className="mt-10 flex justify-between text-xs">
        <div className="text-center"><div className="mb-1 h-8 w-44 border-b border-slate-400" />{L.staffName(cls.classTeacherId)}<br />Class Teacher</div>
        <div className="text-center"><div className="mb-1 h-8 w-44 border-b border-slate-400" />{db.settings.headName}<br />Head of School</div>
      </div>
    </Paper>
  );
}

export default function ReportCards() {
  const db = useDB();
  const user = useCurrentUser();
  const isTeacher = user.role === 'teacher';
  const classes = sortedClasses(db.classes).filter((c) => !isTeacher || c.classTeacherId === user.linkedId || db.allocations.some((a) => a.classId === c.id && a.teacherId === user.linkedId));
  const [classId, setClassId] = useState(classes.find((c) => c.name === 'JHS 2')?.id || classes[0]?.id);
  const [termId, setTermId] = useState(db.settings.currentTerm);
  const [print, setPrint] = useState(null);
  const res = useMemo(() => classResults(db, classId, termId), [db, classId, termId]);

  return (
    <>
      <PageHeader
        title="Report Cards"
        subtitle="Auto-generated terminal reports with positions, grades and remarks"
        actions={<Button icon={Printer} onClick={() => setPrint('all')}>Print all ({res.rows.length})</Button>}
      />
      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2">
        <label><span className="label">Class</span><Select value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} /></label>
        <label><span className="label">Term</span><Select value={termId} onChange={(e) => setTermId(e.target.value)} options={db.terms.slice(0, 2).map((t) => ({ value: t.id, label: t.name }))} /></label>
      </Card>
      {res.rows.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {res.rows.slice(0, 3).map((r, i) => (
            <Card key={r.student.id} className="flex items-center gap-4 p-5">
              <div className={['bg-amber-400', 'bg-slate-300', 'bg-orange-400'][i] + ' flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow'}>
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">{ordinal(r.position)} position</p>
                <p className="truncate font-bold text-slate-900 dark:text-white">{fullName(r.student)}</p>
                <p className="text-sm text-brand-600">{r.average}% average</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <DataTable
        rows={res.rows.map((r) => ({ ...r, id: r.student.id }))}
        searchText={(r) => fullName(r.student)}
        onRowClick={(r) => setPrint(r.student.id)}
        columns={[
          { key: 'position', label: 'Pos.', render: (r) => <span className="font-extrabold text-brand-700 dark:text-brand-300">{ordinal(r.position)}</span> },
          { key: 'name', label: 'Student', sort: (r) => r.student.lastName, render: (r) => <div className="flex items-center gap-3"><Avatar name={fullName(r.student)} size="sm" /><span className="font-semibold">{fullName(r.student)}</span></div> },
          { key: 'total', label: 'Total', hideOnMobile: true },
          { key: 'average', label: 'Average', render: (r) => <Badge tone={gradeTone(r.average)}>{r.average}%</Badge> },
          ...(res.cls?.section === 'JHS' ? [{ key: 'aggregate', label: 'Aggregate' }] : []),
          ...(res.cls?.section === 'Diploma' ? [{ key: 'gpa', label: 'GPA' }] : []),
          { key: 'complete', label: 'Status', hideOnMobile: true, render: (r) => <Badge tone={r.complete ? 'green' : 'amber'}>{r.complete ? 'Complete' : 'Missing scores'}</Badge> },
          { key: 'act', label: '', nosort: true, render: () => <FileBadge className="h-4 w-4 text-brand-600" /> },
        ]}
      />
      <PrintView open={!!print} onClose={() => setPrint(null)} title={`Report cards · ${res.cls?.name}`}>
        {print && res.rows.filter((r) => print === 'all' || r.student.id === print).map((r) => <ReportCardDoc key={r.student.id} row={r} cls={res.cls} termId={termId} total={res.rows.length} />)}
      </PrintView>
    </>
  );
}


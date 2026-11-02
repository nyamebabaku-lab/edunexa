import { useMemo, useState } from 'react';
import { Printer, Award, TrendingUp, Hash } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, usePortalStudent, useCurrentUser, attendanceStats } from '../../data/selectors';
import { fmtDate, ordinal } from '../../lib/format';
import { classResults } from '../../lib/results';
import { Card, CardHeader, PageHeader, Tabs, Button, StatCard, Badge, EmptyState } from '../../components/ui';
import PrintView from '../../components/PrintView';
import { ResultsTable } from '../students/StudentProfile';
import { ReportCardDoc } from '../academics/ReportCards';
import { StudentStatement } from '../finance/shared';

function Who() {
  const { student } = usePortalStudent();
  const L = useLookups();
  return `${student.firstName} ${student.lastName} · ${L.className(student.classId)}`;
}

export function MyResults() {
  const db = useDB();
  const { student } = usePortalStudent();
  const [termId, setTermId] = useState(db.settings.currentTerm);
  const [print, setPrint] = useState(false);
  const res = useMemo(() => classResults(db, student.classId, termId), [db, student.classId, termId]);
  const row = res.rows.find((r) => r.student.id === student.id);
  return (
    <>
      <PageHeader title="Results" subtitle={<Who />} actions={
        <>
          <Tabs value={termId} onChange={setTermId} tabs={db.terms.slice(0, 2).map((t) => ({ value: t.id, label: t.name.split(',')[0] + (t.id === db.settings.currentTerm ? ' (current)' : ' (last)') }))} />
          <Button icon={Printer} onClick={() => setPrint(true)} disabled={!row}>Report card</Button>
        </>
      } />
      {!row ? <Card><EmptyState title="No results published" /></Card> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Average" value={`${row.average}%`} icon={TrendingUp} />
            <StatCard label="Class position" value={ordinal(row.position)} icon={Award} tone="red" sub={`out of ${res.rows.length}`} />
            <StatCard label="Total marks" value={row.total} icon={Hash} tone="navy" />
            {res.cls.section === 'JHS' ? <StatCard label="BECE aggregate" value={row.aggregate} icon={Award} tone="green" sub="Best 6 subjects" />
              : row.gpa ? <StatCard label="GPA" value={row.gpa} icon={Award} tone="green" sub="out of 4.0" />
              : <StatCard label="Subjects" value={row.subjects.length} icon={Award} tone="green" />}
          </div>
          <Card className="overflow-hidden">
            <CardHeader title={db.terms.find((t) => t.id === termId)?.name} icon={Award} />
            <div className="mt-3"><ResultsTable result={row} section={res.cls.section} /></div>
          </Card>
          <PrintView open={print} onClose={() => setPrint(false)} title="Report card">
            <ReportCardDoc row={row} cls={res.cls} termId={termId} total={res.rows.length} />
          </PrintView>
        </>
      )}
    </>
  );
}

export function MyAttendance() {
  const db = useDB();
  const { student } = usePortalStudent();
  const att = attendanceStats(db.attendance, student.id);
  const recent = db.attendance.filter((a) => a.records[student.id]).sort((a, b) => b.date.localeCompare(a.date));
  const ATT = { P: ['Present', 'green'], A: ['Absent', 'red'], L: ['Late', 'amber'], E: ['Excused', 'blue'] };
  return (
    <>
      <PageHeader title="Attendance" subtitle={<Who />} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Attendance rate" value={`${att.rate}%`} icon={TrendingUp} tone="green" />
        <StatCard label="Days present" value={att.P} icon={Award} />
        <StatCard label="Days late" value={att.L} icon={Award} tone="amber" />
        <StatCard label="Days absent" value={att.A} icon={Award} tone="red" />
      </div>
      {db.settings.modules.gate !== false && (
        <Card className="mb-6">
          <CardHeader title="Gate arrivals & departures" subtitle={student.boarding === 'Boarder' ? 'Boarders only scan when leaving or returning to campus' : `Late after ${db.settings.gate.startTime}`} />
          <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 lg:grid-cols-5">
            {db.clockings.filter((c) => c.personType === 'Student' && c.personId === student.id).sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-100 p-3 dark:border-white/5">
                <p className="text-xs text-slate-500">{fmtDate(c.date, 'EEE d MMM')}</p>
                <p className="mt-1 text-sm font-bold">In {c.in} <span className="font-normal text-slate-400">· Out {c.out || '—'}</span></p>
                {c.late && <Badge tone="amber" className="mt-1">Late</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Daily register" />
        <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 lg:grid-cols-5">
          {recent.map((a) => {
            const [label, tone] = ATT[a.records[student.id]];
            return (
              <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-center dark:border-white/5">
                <p className="text-xs text-slate-500">{fmtDate(a.date, 'EEE d MMM')}</p>
                <Badge tone={tone} className="mt-2">{label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

export function MyFees() {
  const user = useCurrentUser();
  const { student } = usePortalStudent();
  return (
    <>
      <PageHeader title="Fees & Payments" subtitle={<Who />} />
      <StudentStatement studentId={student.id} selfService={user.role === 'parent'} />
    </>
  );
}

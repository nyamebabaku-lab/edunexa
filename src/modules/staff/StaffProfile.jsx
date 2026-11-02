import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Phone, Mail, BookOpen, Banknote, CalendarOff, School } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups } from '../../data/selectors';
import { fmtDate, money } from '../../lib/format';
import { payslip } from '../../lib/payroll';
import { Card, CardHeader, Avatar, Badge, Button, KeyValue, FormModal, EmptyState, toast } from '../../components/ui';
import { staffFields } from './Staff';

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const L = useLookups();
  const [edit, setEdit] = useState(false);
  const s = db.staff.find((x) => x.id === id);
  if (!s) return <Card><EmptyState title="Staff member not found" /></Card>;
  const alloc = db.allocations.filter((a) => a.teacherId === s.id);
  const formClass = db.classes.find((c) => c.classTeacherId === s.id);
  const leaves = db.leaves.filter((l) => l.staffId === s.id);
  const slip = payslip(s);

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={`${s.firstName} ${s.lastName}`} size="xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{s.title} {s.firstName} {s.lastName}</h1>
            <Badge tone={s.status === 'Active' ? 'green' : 'amber'} dot>{s.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{s.role} · {s.department} · {s.staffNo}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-brand-600" /> {s.phone}</span>
            <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-brand-600" /> {s.email}</span>
          </div>
        </div>
        <Button icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Employment details" icon={School} />
          <div className="p-5">
            <KeyValue cols={3} items={[
              ['Qualification', s.qualification], ['Date joined', fmtDate(s.dateJoined)], ['Gender', s.gender],
              ['SSNIT No.', s.ssnitNo], ['Bank', s.bank], ['Account No.', s.accountNo],
              ['Form class', formClass?.name || '—'], ['Department', s.department], ['Role', s.role],
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly pay" icon={Banknote} />
          <div className="space-y-2 p-5 text-sm">
            {[['Basic salary', slip.basic], ['Allowances', slip.allowances], ['Gross pay', slip.gross], ['SSNIT (5.5%)', -slip.ssnit], ['PAYE income tax', -slip.paye]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className={v < 0 ? 'text-accent-600' : ''}>{money(v)}</span></div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-extrabold dark:border-white/5"><span>Net pay</span><span className="text-emerald-600">{money(slip.net)}</span></div>
          </div>
        </Card>
        {s.role === 'Teacher' && (
          <Card className="xl:col-span-2">
            <CardHeader title="Teaching load" subtitle={`${alloc.length} subject allocations`} icon={BookOpen} />
            <div className="flex flex-wrap gap-2 p-5">
              {alloc.length === 0 && <p className="text-sm text-slate-500">No subjects allocated.</p>}
              {alloc.map((a) => (
                <Badge key={a.id} tone="blue">{L.subjectName(a.subjectId)} · {L.className(a.classId)}</Badge>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="Leave history" icon={CalendarOff} />
          <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
            {leaves.length === 0 && <EmptyState title="No leave taken" />}
            {leaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-3 py-3">
                <div><p className="text-sm font-semibold">{l.type}</p><p className="text-xs text-slate-500">{fmtDate(l.from, 'd MMM')} – {fmtDate(l.to)}</p></div>
                <Badge tone={l.status === 'Approved' ? 'green' : l.status === 'Pending' ? 'amber' : 'red'}>{l.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <FormModal open={edit} onClose={() => setEdit(false)} title="Edit staff member" fields={staffFields} initial={s} onSubmit={(v) => { db.update('staff', s.id, v); toast.success('Staff updated'); setEdit(false); }} />
    </>
  );
}

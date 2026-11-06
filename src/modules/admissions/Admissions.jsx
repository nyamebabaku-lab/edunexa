import { nextAdmissionNo } from '../../lib/numbers';
import { admissionItems } from '../finance/shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, XCircle, CheckCircle2, FileText, LayoutGrid, List, UserPlus, Phone, School } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, sortedClasses, TODAY } from '../../data/selectors';
import { fmtDate, age, money, uid } from '../../lib/format';
import { Button, Card, Badge, Avatar, DataTable, FormModal, PageHeader, Tabs, StatCard, toast, confirmDialog, cx } from '../../components/ui';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

export const STAGES = ['Applied', 'Entrance Exam', 'Interview', 'Offered', 'Enrolled', 'Rejected'];
const STAGE_TONE = { Applied: 'slate', 'Entrance Exam': 'blue', Interview: 'violet', Offered: 'amber', Enrolled: 'green', Rejected: 'red' };

/** Enrol an accepted applicant: creates parent, student and the current-term bill. */
export function enrolApplicant(app) {
  const db = useDB.getState();
  const cls = db.classes.find((c) => c.id === app.classId);
  const [title, ...rest] = String(app.parentName || 'Guardian').trim().split(/\s+/);
  const digits = (x) => String(x || '').replace(/\D/g, '').slice(-9);
  const existing = digits(app.parentPhone) && db.parents.find((p) => digits(p.phone) === digits(app.parentPhone));
  const parent = existing || db.add('parents', {
    title: ['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(title) ? title : 'Mr.',
    firstName: (['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(title) ? rest : [title, ...rest]).slice(0, -1).join(' ') || rest[0] || title,
    lastName: String(app.parentName || '').trim().split(/\s+/).slice(-1)[0] || 'Guardian',
    gender: title === 'Mrs.' || title === 'Ms.' ? 'Female' : 'Male',
    relation: title === 'Mrs.' || title === 'Ms.' ? 'Mother' : 'Father',
    phone: app.parentPhone,
    altPhone: '',
    email: app.parentEmail || '',
    occupation: '',
    address: '',
  });
  const student = db.add('students', {
    admissionNo: nextAdmissionNo(db),
    firstName: app.firstName,
    otherNames: '',
    lastName: app.lastName,
    gender: app.gender,
    dob: app.dob,
    classId: app.classId,
    parentId: parent.id,
    house: '',
    boarding: app.boarding || 'Day',
    dormId: null,
    busRouteId: null,
    status: 'Active',
    admissionDate: TODAY,
    address: '',
    bloodGroup: '',
    allergies: '',
    medicalNotes: '',
    nationality: 'Ghanaian',
    religion: '',
    previousSchool: app.previousSchool,
  });
  const fs = db.feeStructures.find((f) => f.section === cls?.section);
  const termItems = (fs?.items || []).filter((i) => Number(i.amount) > 0);
  // First bill: the level's general fees plus the one-off admission fees (Fees & Finance → Fee structures).
  const items = [...termItems, ...admissionItems(db)];
  if (student.boarding === 'Boarder' && Number(db.boardingFee) > 0) items.push({ name: 'Boarding & Feeding', amount: Number(db.boardingFee) });
  // No fees set up yet (new school): enrol without a bill; the accountant can bill later.
  if (!items.length || !db.settings.currentTerm) {
    db.update('applications', app.id, { stage: 'Enrolled', studentId: student.id });
    return student;
  }
  db.add('invoices', {
    id: uid('inv'),
    invoiceNo: `INV-${db.settings.currentTerm.slice(2, 4)}${db.settings.currentTerm.slice(-1)}-${String(db.invoices.length + 1).padStart(4, '0')}`,
    studentId: student.id,
    termId: db.settings.currentTerm,
    date: TODAY,
    dueDate: TODAY,
    items,
    discount: 0,
    discountReason: '',
    total: items.reduce((a, i) => a + Number(i.amount), 0),
    kind: termItems.length ? 'term' : 'admission',
  });
  db.update('applications', app.id, { stage: 'Enrolled', studentId: student.id });
  return student;
}

export default function Admissions() {
  const applications = useDB((s) => s.applications);
  const classes = useDB((s) => s.classes);
  const add = useDB((s) => s.add);
  const update = useDB((s) => s.update);
  const L = useLookups();
  const navigate = useNavigate();
  const [view, setView] = useState('board');
  const [form, setForm] = useState(null);
  const [letter, setLetter] = useState(null);

  const classOpts = sortedClasses(classes).map((c) => ({ value: c.id, label: c.name }));
  const fields = [
    { name: 'firstName', label: 'First name', required: true },
    { name: 'lastName', label: 'Surname', required: true },
    { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true },
    { name: 'dob', label: 'Date of birth', type: 'date', required: true },
    { name: 'classId', label: 'Class applying for', type: 'select', options: classOpts, required: true, emptyHint: 'No classes yet — add them in Classes & Subjects first' },
    { name: 'boarding', label: 'Day / Boarding', type: 'select', options: ['Day', 'Boarder'] },
    { name: 'previousSchool', label: 'Previous school' },
    { name: 'parentName', label: 'Parent / guardian name', required: true, placeholder: 'e.g. Mrs. Ama Owusu' },
    { name: 'parentPhone', label: 'Parent phone', type: 'tel', required: true },
    { name: 'parentEmail', label: 'Parent email', type: 'email' },
    { name: 'examScore', label: 'Entrance exam score (%)', type: 'number' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const save = (v) => {
    if (v.id) {
      update('applications', v.id, v);
      toast.success('Application updated');
    } else {
      add('applications', { ...v, appNo: `APP-${new Date().getFullYear()}-${String(applications.length + 1).padStart(3, '0')}`, stage: 'Applied', appliedOn: TODAY, boarding: v.boarding || 'Day' });
      toast.success('Application received', `${v.firstName} ${v.lastName} added to the pipeline`);
    }
    setForm(null);
  };

  const advance = (a) => {
    const i = STAGES.indexOf(a.stage);
    const next = STAGES[i + 1];
    if (next === 'Enrolled') return enrol(a);
    update('applications', a.id, { stage: next });
    toast.success(`Moved to ${next}`);
  };
  const enrol = async (a) => {
    if (!(await confirmDialog('Enrol applicant?', `This creates a student record for ${a.firstName} ${a.lastName} in ${L.className(a.classId)}, a parent record and the term's fee bill.`, { danger: false, confirmLabel: 'Enrol student' }))) return;
    const s = enrolApplicant(a);
    toast.success('Student enrolled', `${s.admissionNo} · invoice generated`);
    navigate(`/students/${s.id}`);
  };
  const reject = async (a) => {
    if (await confirmDialog('Reject application?', `${a.firstName} ${a.lastName} will be marked as rejected.`, { confirmLabel: 'Reject' })) {
      update('applications', a.id, { stage: 'Rejected' });
      toast.info('Application rejected');
    }
  };

  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, applications.filter((a) => a.stage === s).length])), [applications]);

  const AppCard = ({ a }) => (
    <Card className="p-4 transition hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar name={`${a.firstName} ${a.lastName}`} size="sm" />
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setForm(a)}>
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
            {a.firstName} {a.lastName}
          </p>
          <p className="text-xs text-slate-500">
            {a.appNo} · {age(a.dob)} yrs
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <p className="flex items-center gap-1.5"><School className="h-3.5 w-3.5" /> {L.className(a.classId)} · {a.boarding}</p>
        <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {a.parentName}</p>
        {a.examScore != null && a.examScore !== '' && <p className="font-semibold text-brand-600">Entrance score: {a.examScore}%</p>}
      </div>
      {!['Enrolled', 'Rejected'].includes(a.stage) && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" variant={a.stage === 'Offered' ? 'primary' : 'soft'} icon={a.stage === 'Offered' ? CheckCircle2 : ArrowRight} onClick={() => advance(a)}>
            {a.stage === 'Offered' ? 'Enrol' : 'Advance'}
          </Button>
          {a.stage === 'Offered' && <Button size="sm" variant="secondary" icon={FileText} onClick={() => setLetter(a)} />}
          <Button size="sm" variant="soft-red" icon={XCircle} onClick={() => reject(a)} />
        </div>
      )}
      {a.stage === 'Enrolled' && a.studentId && (
        <Button size="sm" variant="soft" className="mt-3 w-full" onClick={() => navigate(`/students/${a.studentId}`)}>
          View student
        </Button>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Admissions"
        subtitle="Track applicants from application to enrolment"
        actions={
          <>
            <Tabs value={view} onChange={setView} tabs={[{ value: 'board', label: 'Board', icon: LayoutGrid }, { value: 'list', label: 'List', icon: List }]} />
            <Button icon={Plus} onClick={() => setForm({ gender: 'Female', boarding: 'Day' })}>
              New application
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total applications" value={applications.length} icon={UserPlus} />
        <StatCard label="In progress" value={counts.Applied + counts['Entrance Exam'] + counts.Interview} icon={ArrowRight} tone="violet" />
        <StatCard label="Offers made" value={counts.Offered} icon={FileText} tone="amber" />
        <StatCard label="Enrolled" value={counts.Enrolled} icon={CheckCircle2} tone="green" />
      </div>

      {view === 'board' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1100px] grid-cols-6 gap-4">
            {STAGES.map((st) => (
              <div key={st} className="rounded-3xl bg-slate-100/70 p-3 dark:bg-white/[.03]">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{st}</p>
                  <Badge tone={STAGE_TONE[st]}>{counts[st]}</Badge>
                </div>
                <div className="space-y-3">
                  {applications
                    .filter((a) => a.stage === st)
                    .map((a) => (
                      <AppCard key={a.id} a={a} />
                    ))}
                  {counts[st] === 0 && <p className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-white/10">Empty</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DataTable
          rows={applications}
          onRowClick={setForm}
          columns={[
            { key: 'appNo', label: 'App No.' },
            { key: 'name', label: 'Applicant', sort: (a) => a.lastName, render: (a) => <span className="font-semibold">{a.firstName} {a.lastName}</span> },
            { key: 'classId', label: 'Class', render: (a) => L.className(a.classId), sort: (a) => L.cls(a.classId)?.order },
            { key: 'parentName', label: 'Parent', hideOnMobile: true },
            { key: 'parentPhone', label: 'Phone', hideOnMobile: true },
            { key: 'appliedOn', label: 'Applied', render: (a) => fmtDate(a.appliedOn) },
            { key: 'stage', label: 'Stage', render: (a) => <Badge tone={STAGE_TONE[a.stage]} dot>{a.stage}</Badge> },
          ]}
        />
      )}

      <FormModal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Application details' : 'New application'} subtitle={form?.appNo} fields={fields} initial={form} onSubmit={save} />

      <PrintView open={!!letter} onClose={() => setLetter(null)} title="Admission letter">
        {letter && <AdmissionLetter app={letter} />}
      </PrintView>
    </>
  );
}

function AdmissionLetter({ app }) {
  const s = useDB((x) => x.settings);
  const fees = useDB((x) => x.feeStructures);
  const boardingFee = useDB((x) => x.boardingFee);
  const L = useLookups();
  const cls = L.cls(app.classId);
  const fs = fees.find((f) => f.section === cls?.section);
  const adm = admissionItems(useDB.getState()).map((i) => ({ ...i, name: `${i.name} (one-off)` }));
  const items = [...(fs?.items || []).filter((i) => Number(i.amount) > 0), ...adm, ...(app.boarding === 'Boarder' && Number(boardingFee) > 0 ? [{ name: 'Boarding & Feeding', amount: Number(boardingFee) }] : [])];
  return (
    <Paper>
      <Letterhead title="Offer of Admission" right={<p className="mt-2 text-xs text-slate-500">{fmtDate(TODAY, 'd MMMM yyyy')}</p>} />
      <p className="text-sm">
        Ref: <b>{app.appNo}</b>
      </p>
      <p className="mt-4 text-sm">{app.parentName},</p>
      <p className="mt-4 text-base font-bold uppercase underline">Offer of admission – {app.firstName} {app.lastName}</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>
          We are pleased to inform you that your ward, <b>{app.firstName} {app.lastName}</b>, has been offered admission into <b>{cls.name}</b>
          {cls.programme ? ` (${cls.programme})` : ''} as a <b>{app.boarding === 'Boarder' ? 'boarding' : 'day'}</b> student of {s.schoolName} for the {s.academicYear} academic year.
        </p>
        <p>To accept this offer, kindly pay the fees below and complete the enrolment forms at the school's administration office within two (2) weeks of the date of this letter.</p>
      </div>
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.name} className="border-b border-slate-200">
              <td className="py-1.5">{i.name}</td>
              <td className="py-1.5 text-right">{money(i.amount)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-2">Total payable</td>
            <td className="py-2 text-right">{money(items.reduce((a, i) => a + i.amount, 0))}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-5 text-sm">Payment may be made by MTN MoMo (merchant code 778899), bank transfer to GCB Bank – A/C 1021 3040 5060, or at the accounts office.</p>
      <p className="mt-4 text-sm">Congratulations, and welcome to the {s.schoolName} family.</p>
      <div className="mt-12 flex justify-between text-sm">
        <div>
          <div className="mb-1 h-10 w-48 border-b border-slate-400" />
          <p className="font-bold">{s.headName}</p>
          <p className="text-xs text-slate-500">Head of School</p>
        </div>
        <div className={cx('flex h-24 w-24 items-center justify-center rounded-full border-4 border-double border-brand-700 text-center text-[9px] font-bold uppercase text-brand-700')}>
          Official
          <br />
          School
          <br />
          Stamp
        </div>
      </div>
    </Paper>
  );
}

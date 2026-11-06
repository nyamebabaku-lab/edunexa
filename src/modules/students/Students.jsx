import { nextAdmissionNo } from '../../lib/numbers';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, GraduationCap, Users, BedDouble, Bus, UserPlus, Trash2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useBalances, useCurrentUser, sortedClasses, TODAY } from '../../data/selectors';
import { fullName, age, money, downloadCSV } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { Button, Badge, Avatar, DataTable, FormModal, PageHeader, Select, StatCard, Combo, Input, toast, confirmDialog } from '../../components/ui';
import { deleteStudents, studentFootprint } from '../../lib/cleanup';
import { admissionItems, billAdmission } from '../finance/shared';
import { photoKey, usePhotos, applyPhotoChange } from '../../data/photos';
import { PhotoField } from '../../components/PhotoEditor';

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.'];
const RELATIONS = ['Father', 'Mother', 'Guardian', 'Uncle', 'Aunt', 'Grandparent'];

/** Pick an existing parent, or type in a new one (saved together with the student). */
export function ParentPicker({ value, onChange, parents }) {
  const BLANK = { title: 'Mrs.', relation: 'Mother', firstName: '', lastName: '', phone: '' };
  // No parents in the school yet: go straight to typing in a new one.
  const isNew = (typeof value === 'object' && value !== null) || (!parents.length && !value);
  const np = typeof value === 'object' && value !== null ? value : BLANK;
  const setN = (k) => (e) => onChange({ ...np, [k]: e?.target ? e.target.value : e });
  const startNew = () => onChange({ ...BLANK });
  return (
    <div className="space-y-2">
      {!isNew ? (
        <div className="flex gap-2">
          <Select className="flex-1" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={parents.length ? 'Choose a parent…' : 'No parents yet'}
            options={[...parents].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)).map((p) => ({ value: p.id, label: `${p.title} ${p.firstName} ${p.lastName} · ${p.phone}` }))} />
          <Button type="button" variant="secondary" icon={UserPlus} onClick={startNew}>New parent</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/20 dark:bg-brand-500/5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">New parent / guardian</p>
            {parents.length > 0 && <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => onChange('')}>Choose existing instead</button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Combo value={np.title} onChange={setN('title')} options={TITLES} placeholder="Title" />
            <Combo value={np.relation} onChange={setN('relation')} options={RELATIONS} placeholder="Relationship" />
            <Input value={np.firstName} onChange={setN('firstName')} placeholder="First name *" />
            <Input value={np.lastName} onChange={setN('lastName')} placeholder="Surname *" />
            <Input className="sm:col-span-2" type="tel" value={np.phone} onChange={setN('phone')} placeholder="Phone * (for texts and parent sign-up)" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Turns the parent picker's value into a parent id, creating the parent when a new one was typed in.
 * Reuses an existing parent with the same phone number. Returns null (and shows why) when details are missing.
 */
export function resolveParent(v) {
  if (typeof v === 'string') return v || (toast.error('Missing information', 'Choose the parent / guardian or add a new one'), null);
  if (!v || !v.firstName?.trim() || !v.lastName?.trim() || !v.phone?.trim()) return toast.error('Missing information', 'Enter the new parent\'s first name, surname and phone'), null;
  const db = useDB.getState();
  const digits = (x) => String(x || '').replace(/\D/g, '').slice(-9);
  const same = db.parents.find((p) => digits(p.phone) && digits(p.phone) === digits(v.phone));
  if (same) return same.id;
  const female = ['Mrs.', 'Ms.'].includes(v.title) || ['Mother', 'Aunt'].includes(v.relation);
  return db.add('parents', { title: v.title || '', relation: v.relation || 'Guardian', firstName: v.firstName.trim(), lastName: v.lastName.trim(), phone: v.phone.trim(), gender: female ? 'Female' : 'Male', altPhone: '', email: '', occupation: '', address: '' }).id;
}

/** Asks, then deletes the students with their own records. Resolves true when deleted. */
export async function confirmDeleteStudents(list) {
  const f = studentFootprint(list.map((s) => s.id));
  const extra = [f.invoices && `${f.invoices} fee bill${f.invoices === 1 ? '' : 's'}`, f.payments && `${f.payments} payment${f.payments === 1 ? '' : 's'}`, f.scores && `${f.scores} score${f.scores === 1 ? '' : 's'}`].filter(Boolean);
  const who = list.length === 1 ? `${list[0].firstName} ${list[0].lastName}` : `${list.length} students`;
  const ok = await confirmDialog(`Delete ${who}?`, `${extra.length ? `Their ${extra.join(', ')} and other records are deleted too. ` : ''}To keep the history, mark them Withdrawn or Graduated instead. This cannot be undone.`, { confirmLabel: 'Delete' });
  if (!ok) return false;
  deleteStudents(list.map((s) => s.id));
  toast.success(list.length === 1 ? 'Student deleted' : `${list.length} students deleted`);
  return true;
}

export function studentFields(classes, parents, routes, dorms) {
  return [
    {
      name: '_photo',
      label: 'Photo',
      type: 'custom',
      span: 2,
      render: (v, set) => <PhotoField value={v._photo} onChange={set} pkey={v.id ? photoKey('Student', v.id) : null} name={[v.firstName, v.lastName].filter(Boolean).join(' ')} />,
    },
    { name: 'firstName', label: 'First name', required: true },
    { name: 'otherNames', label: 'Other names' },
    { name: 'lastName', label: 'Surname', required: true },
    { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true },
    { name: 'dob', label: 'Date of birth', type: 'date', required: true },
    { name: 'classId', label: 'Class', type: 'select', options: sortedClasses(classes).map((c) => ({ value: c.id, label: c.name })), required: true, emptyHint: 'No classes yet — add them in Classes & Subjects first' },
    { name: 'parentId', label: 'Parent / guardian *', type: 'custom', span: 2, render: (v, set) => <ParentPicker value={v.parentId} onChange={set} parents={parents} /> },
    { name: 'boarding', label: 'Day / Boarding', type: 'select', options: ['Day', 'Boarder'] },
    { name: 'house', label: 'House', type: 'select', options: ['Aggrey', 'Nkrumah', 'Guggisberg', 'Yaa Asantewaa'] },
    { name: 'dormId', label: 'Dormitory', type: 'select', options: dorms.map((d) => ({ value: d.id, label: d.name })), hidden: (v) => v.boarding !== 'Boarder', emptyHint: 'Add dormitories in Hostel & Boarding' },
    { name: 'busRouteId', label: 'Bus route', type: 'select', options: routes.map((r) => ({ value: r.id, label: r.name })), placeholder: 'No bus', hidden: (v) => v.boarding === 'Boarder' },
    { name: 'admissionDate', label: 'Admission date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Suspended', 'Withdrawn', 'Graduated'] },
    { name: 'address', label: 'Residential address', span: 2 },
    { name: 'bloodGroup', label: 'Blood group', type: 'select', options: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
    { name: 'allergies', label: 'Allergies' },
    { name: 'medicalNotes', label: 'Medical notes', type: 'textarea' },
    { name: 'religion', label: 'Religion' },
    { name: 'previousSchool', label: 'Previous school' },
  ];
}

export default function Students() {
  const db = useDB();
  const L = useLookups();
  const bal = useBalances();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [section, setSection] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('Active');
  const [form, setForm] = useState(null);
  const photos = usePhotos((p) => p.map);
  const canManage = user.role === 'admin' || user.role === 'headteacher';
  const admFee = admissionItems(db).reduce((a, i) => a + i.amount, 0);

  const teacherClassIds = useMemo(() => {
    if (user.role !== 'teacher') return null;
    return new Set([...db.allocations.filter((a) => a.teacherId === user.linkedId).map((a) => a.classId), ...db.classes.filter((c) => c.classTeacherId === user.linkedId).map((c) => c.id)]);
  }, [user, db.allocations, db.classes]);

  const rows = db.students.filter((s) => {
    const c = L.cls(s.classId);
    if (teacherClassIds && !teacherClassIds.has(s.classId)) return false;
    if (section && c?.section !== section) return false;
    if (classId && s.classId !== classId) return false;
    if (status && s.status !== status) return false;
    return true;
  });
  const classOpts = sortedClasses(db.classes)
    .filter((c) => (!section || c.section === section) && (!teacherClassIds || teacherClassIds.has(c.id)))
    .map((c) => ({ value: c.id, label: c.name }));

  const save = ({ _photo, _admission, ...v }) => {
    const parentId = resolveParent(v.parentId);
    if (!parentId) return;
    v.parentId = parentId;
    const rec = db.add('students', { ...v, admissionNo: v.admissionNo?.trim() || nextAdmissionNo(db), status: v.status || 'Active', nationality: 'Ghanaian', admissionDate: v.admissionDate || TODAY });
    applyPhotoChange(photoKey('Student', rec.id), _photo);
    const bill = _admission ? billAdmission([rec.id]) : [];
    toast.success('Student added', `${v.firstName} ${v.lastName}${_photo ? ' with photo' : ''}${bill.length ? ` · admission fee ${money(bill[0].total)} billed` : ''}`);
    setForm(null);
  };

  const exportCSV = () =>
    downloadCSV(
      'students',
      rows.map((s) => ({
        'Admission No': s.admissionNo,
        Name: fullName(s),
        Gender: s.gender,
        DOB: s.dob,
        Class: L.className(s.classId),
        Parent: L.parentName(s.parentId),
        Phone: L.parent(s.parentId)?.phone,
        Boarding: s.boarding,
        Balance: bal.get(s.id).balance,
      })),
    );

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={user.role === 'teacher' ? 'Students in the classes you teach' : 'Every learner from Creche to Diploma'}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCSV}>
              Export
            </Button>
            {(user.role === 'admin' || user.role === 'headteacher') && (
              <Button icon={Plus} onClick={() => setForm({ gender: 'Female', boarding: 'Day', status: 'Active', _admission: true })}>
                Add student
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Showing" value={rows.length} icon={GraduationCap} />
        <StatCard label="Girls / Boys" value={`${rows.filter((s) => s.gender === 'Female').length} / ${rows.filter((s) => s.gender === 'Male').length}`} icon={Users} tone="violet" />
        <StatCard label="Boarders" value={rows.filter((s) => s.boarding === 'Boarder').length} icon={BedDouble} tone="navy" />
        <StatCard label="Bus riders" value={rows.filter((s) => s.busRouteId).length} icon={Bus} tone="red" sub={`${rows.filter((s) => photos[photoKey('Student', s.id)]).length} of ${rows.length} have photos`} />
      </div>
      <DataTable
        rows={rows}
        bulk={canManage ? (list, clear) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => { list.forEach((s) => db.update('students', s.id, { status: 'Withdrawn' })); toast.success(`${list.length} marked Withdrawn`); clear(); }}>Mark withdrawn</Button>
            <Button size="sm" variant="soft-red" icon={Trash2} onClick={async () => { if (await confirmDeleteStudents(list)) clear(); }}>Delete {list.length}</Button>
          </>
        ) : undefined}
        onRowClick={(s) => navigate(`/students/${s.id}`)}
        searchText={(s) => `${fullName(s)} ${s.admissionNo} ${L.className(s.classId)} ${L.parentName(s.parentId)}`}
        toolbar={
          <>
            <Select className="!w-auto" value={section} onChange={(e) => { setSection(e.target.value); setClassId(''); }} options={SECTIONS} placeholder="All sections" />
            <Select className="!w-auto" value={classId} onChange={(e) => setClassId(e.target.value)} options={classOpts} placeholder="All classes" />
            <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={['Active', 'Suspended', 'Withdrawn', 'Graduated']} placeholder="Any status" />
          </>
        }
        columns={[
          {
            key: 'name',
            label: 'Student',
            sort: (s) => s.lastName,
            render: (s) => (
              <div className="flex items-center gap-3">
                <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="sm" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{fullName(s)}</p>
                  <p className="text-xs text-slate-500">{s.admissionNo}</p>
                </div>
              </div>
            ),
          },
          { key: 'classId', label: 'Class', sort: (s) => L.cls(s.classId)?.order, render: (s) => L.className(s.classId) },
          { key: 'gender', label: 'Gender', hideOnMobile: true },
          { key: 'dob', label: 'Age', hideOnMobile: true, render: (s) => age(s.dob) },
          { key: 'parentId', label: 'Parent', hideOnMobile: true, sort: (s) => L.parentName(s.parentId), render: (s) => <span className="text-slate-600 dark:text-slate-300">{L.parentName(s.parentId)}</span> },
          { key: 'boarding', label: 'Type', hideOnMobile: true, render: (s) => <Badge tone={s.boarding === 'Boarder' ? 'violet' : 'slate'}>{s.boarding}</Badge> },
          ...((user.role === 'admin' || user.role === 'headteacher')
            ? [{ key: 'balance', label: 'Balance', sort: (s) => bal.get(s.id).balance, render: (s) => { const b = bal.get(s.id).balance; return <span className={b > 0 ? 'font-semibold text-accent-600' : 'text-emerald-600'}>{money(b)}</span>; } }]
            : []),
        ]}
      />
      <FormModal open={!!form} onClose={() => setForm(null)} title="Add student" initial={form} onSubmit={save}
        fields={[
          ...studentFields(db.classes, db.parents, db.routes, db.dorms),
          ...(admFee > 0 ? [{ name: '_admission', label: `New admission — bill the admission fee (${money(admFee)})`, type: 'checkbox', span: 2 }] : []),
        ]} />
    </>
  );
}

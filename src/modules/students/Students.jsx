import { nextAdmissionNo } from '../../lib/numbers';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, GraduationCap, Users, BedDouble, Bus } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useBalances, useCurrentUser, sortedClasses, TODAY } from '../../data/selectors';
import { fullName, age, money, downloadCSV } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { Button, Badge, Avatar, DataTable, FormModal, PageHeader, Select, StatCard, toast } from '../../components/ui';
import { photoKey, usePhotos, applyPhotoChange } from '../../data/photos';
import { PhotoField } from '../../components/PhotoEditor';

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
    { name: 'classId', label: 'Class', type: 'select', options: sortedClasses(classes).map((c) => ({ value: c.id, label: c.name })), required: true },
    { name: 'parentId', label: 'Parent / guardian', type: 'select', options: parents.map((p) => ({ value: p.id, label: `${p.title} ${p.firstName} ${p.lastName} · ${p.phone}` })), required: true, span: 2 },
    { name: 'boarding', label: 'Day / Boarding', type: 'select', options: ['Day', 'Boarder'] },
    { name: 'house', label: 'House', type: 'select', options: ['Aggrey', 'Nkrumah', 'Guggisberg', 'Yaa Asantewaa'] },
    { name: 'dormId', label: 'Dormitory', type: 'select', options: dorms.map((d) => ({ value: d.id, label: d.name })), hidden: (v) => v.boarding !== 'Boarder' },
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

  const save = ({ _photo, ...v }) => {
    const rec = db.add('students', { ...v, admissionNo: v.admissionNo?.trim() || nextAdmissionNo(db), status: v.status || 'Active', nationality: 'Ghanaian', admissionDate: v.admissionDate || TODAY });
    applyPhotoChange(photoKey('Student', rec.id), _photo);
    toast.success('Student added', `${v.firstName} ${v.lastName}${_photo ? ' with photo' : ''}`);
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
              <Button icon={Plus} onClick={() => setForm({ gender: 'Female', boarding: 'Day', status: 'Active' })}>
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
      <FormModal open={!!form} onClose={() => setForm(null)} title="Add student" fields={studentFields(db.classes, db.parents, db.routes, db.dorms)} initial={form} onSubmit={save} />
    </>
  );
}

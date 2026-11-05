import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, CalendarOff, Banknote, Check, X } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, TODAY } from '../../data/selectors';
import { fmtDate, money, sum } from '../../lib/format';
import { Avatar, Badge, PageHeader, StatCard, Tabs, Select, IconButton, toast } from '../../components/ui';
import { PhotoField } from '../../components/PhotoEditor';
import CrudPage from '../../components/CrudPage';
import { photoKey, applyPhotoChange } from '../../data/photos';

export const STAFF_ROLES = ['Teacher', 'Head Teacher', 'Administrator', 'Accountant', 'Librarian', 'Storekeeper', 'Transport Officer', 'Canteen Manager', 'Hostel Manager', 'Support Staff', 'Nurse', 'Driver', 'Security', 'Cleaner', 'Cook', 'Matron'];
export const DEPARTMENTS = ['Early Years', 'Primary', 'JHS', 'SHS', 'Diploma', 'Administration', 'Finance', 'Library', 'Stores', 'Transport', 'Health', 'Support'];

export const staffFields = [
  {
    name: '_photo',
    label: 'Photo',
    type: 'custom',
    span: 2,
    render: (v, set) => <PhotoField value={v._photo} onChange={set} pkey={v.id ? photoKey('Staff', v.id) : null} name={[v.firstName, v.lastName].filter(Boolean).join(' ')} />,
  },
  { name: 'title', label: 'Title', type: 'select', options: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Dr. Mrs.', 'Rev.'] },
  { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Surname', required: true },
  { name: 'role', label: 'Role', type: 'select', options: STAFF_ROLES, required: true },
  { name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS, required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'qualification', label: 'Qualification' },
  { name: 'dateJoined', label: 'Date joined', type: 'date' },
  { name: 'salary', label: 'Basic salary (per month)', type: 'number', required: true },
  { name: 'allowances', label: 'Allowances (per month)', type: 'number' },
  { name: 'ssnitNo', label: 'SSNIT number' },
  { name: 'bank', label: 'Bank' },
  { name: 'accountNo', label: 'Account number' },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'On leave', 'Suspended', 'Exited'] },
];

export default function Staff() {
  const staff = useDB((s) => s.staff);
  const leaves = useDB((s) => s.leaves);
  const update = useDB((s) => s.update);
  const L = useLookups();
  const navigate = useNavigate();
  const [tab, setTab] = useState('staff');
  const [role, setRole] = useState('');
  const pending = leaves.filter((l) => l.status === 'Pending');

  return (
    <>
      <PageHeader title="Staff & HR" subtitle="Teaching and non-teaching staff, leave and records" actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: 'staff', label: 'Directory' }, { value: 'leave', label: 'Leave', count: pending.length }]} />} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total staff" value={staff.length} icon={Users} />
        <StatCard label="Teachers" value={staff.filter((s) => s.role === 'Teacher').length} icon={GraduationCap} tone="violet" />
        <StatCard label="On leave today" value={leaves.filter((l) => l.status === 'Approved' && l.from <= TODAY && l.to >= TODAY).length} icon={CalendarOff} tone="amber" />
        <StatCard label="Monthly wage bill" value={money(sum(staff.filter((s) => s.status === 'Active'), (s) => s.salary + (s.allowances || 0)))} icon={Banknote} tone="red" />
      </div>

      {tab === 'staff' ? (
        <CrudPage
          collection="staff"
          noun="staff member"
          rows={staff.filter((s) => !role || s.role === role)}
          onRowClick={(s) => navigate(`/staff/${s.id}`)}
          defaults={{ title: 'Mr.', gender: 'Male', role: 'Teacher', status: 'Active', dateJoined: TODAY, allowances: 0 }}
          toRecord={(v) => (v.staffNo ? v : { ...v, staffNo: `BFIS/ST/${String(staff.length + 1).padStart(3, '0')}` })}
          onSaved={(rec, v) => applyPhotoChange(photoKey('Staff', rec.id), v._photo)}
          searchText={(s) => `${s.firstName} ${s.lastName} ${s.role} ${s.department} ${s.staffNo}`}
          toolbar={<Select className="!w-auto" value={role} onChange={(e) => setRole(e.target.value)} options={STAFF_ROLES} placeholder="All roles" />}
          fields={staffFields}
          canDelete={false}
          columns={[
            {
              key: 'name',
              label: 'Staff member',
              sort: (s) => s.lastName,
              render: (s) => (
                <div className="flex items-center gap-3">
                  <Avatar name={`${s.firstName} ${s.lastName}`} photo={photoKey('Staff', s.id)} size="sm" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{s.title} {s.firstName} {s.lastName}</p>
                    <p className="text-xs text-slate-500">{s.staffNo}</p>
                  </div>
                </div>
              ),
            },
            { key: 'role', label: 'Role', render: (s) => <Badge tone={s.role === 'Teacher' ? 'blue' : 'slate'}>{s.role}</Badge> },
            { key: 'department', label: 'Department', hideOnMobile: true },
            { key: 'phone', label: 'Phone', hideOnMobile: true },
            { key: 'qualification', label: 'Qualification', hideOnMobile: true },
            { key: 'status', label: 'Status', render: (s) => <Badge tone={s.status === 'Active' ? 'green' : 'amber'} dot>{s.status}</Badge> },
          ]}
        />
      ) : (
        <CrudPage
          collection="leaves"
          noun="leave request"
          initialSort={{ key: 'from', dir: 'desc' }}
          defaults={{ type: 'Annual Leave', status: 'Pending', from: TODAY, to: TODAY }}
          fields={[
            { name: 'staffId', label: 'Staff member', type: 'select', options: staff.map((s) => ({ value: s.id, label: `${s.title} ${s.firstName} ${s.lastName}` })), required: true, span: 2 },
            { name: 'type', label: 'Leave type', type: 'select', options: ['Annual Leave', 'Sick Leave', 'Maternity Leave', 'Paternity Leave', 'Study Leave', 'Compassionate Leave'] },
            { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Declined'] },
            { name: 'from', label: 'From', type: 'date', required: true },
            { name: 'to', label: 'To', type: 'date', required: true },
            { name: 'reason', label: 'Reason', type: 'textarea' },
          ]}
          columns={[
            { key: 'staffId', label: 'Staff', sort: (l) => L.staffName(l.staffId), render: (l) => <span className="font-semibold">{L.staffName(l.staffId)}</span> },
            { key: 'type', label: 'Type' },
            { key: 'from', label: 'Period', render: (l) => `${fmtDate(l.from, 'd MMM')} – ${fmtDate(l.to, 'd MMM yyyy')}` },
            { key: 'reason', label: 'Reason', hideOnMobile: true, render: (l) => <span className="text-slate-500">{l.reason}</span> },
            {
              key: 'status',
              label: 'Status',
              render: (l) =>
                l.status === 'Pending' ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Badge tone="amber">Pending</Badge>
                    <IconButton icon={Check} label="Approve" tone="soft" onClick={() => { update('leaves', l.id, { status: 'Approved' }); toast.success('Leave approved'); }} />
                    <IconButton icon={X} label="Decline" tone="soft-red" onClick={() => { update('leaves', l.id, { status: 'Declined' }); toast.info('Leave declined'); }} />
                  </div>
                ) : (
                  <Badge tone={l.status === 'Approved' ? 'green' : 'red'}>{l.status}</Badge>
                ),
            },
          ]}
        />
      )}
    </>
  );
}


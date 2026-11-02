import { useState } from 'react';
import { HeartPulse, ShieldAlert, Stethoscope, AlertTriangle } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, TODAY } from '../../data/selectors';
import { fmtDate, fullName } from '../../lib/format';
import { PageHeader, Tabs, Badge, StatCard } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

export default function Welfare() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const [tab, setTab] = useState('health');
  const studentOpts = [...db.students].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }));
  const allergies = db.students.filter((s) => s.allergies || s.medicalNotes);
  return (
    <>
      <PageHeader title="Health & Discipline" subtitle="Infirmary records, medical alerts and student conduct" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Infirmary visits" value={db.healthVisits.length} icon={Stethoscope} tone="green" />
        <StatCard label="Medical alerts" value={allergies.length} icon={HeartPulse} tone="red" sub="Allergies / conditions" />
        <StatCard label="Incidents" value={db.incidents.length} icon={ShieldAlert} tone="amber" />
        <StatCard label="Open cases" value={db.incidents.filter((i) => i.status === 'Open').length} icon={AlertTriangle} tone="navy" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'health', label: 'Infirmary' }, { value: 'alerts', label: 'Medical alerts' }, { value: 'discipline', label: 'Discipline' }]} />
      {tab === 'health' && (
        <CrudPage collection="healthVisits" noun="visit" initialSort={{ key: 'date', dir: 'desc' }} defaults={{ date: TODAY, attendedBy: db.staff.find((s) => s.role === 'Nurse')?.id, parentNotified: false }}
          fields={[
            { name: 'studentId', label: 'Student', type: 'select', options: studentOpts, required: true, span: 2 },
            { name: 'date', label: 'Date', type: 'date' }, { name: 'parentNotified', label: 'Parent notified', type: 'checkbox' },
            { name: 'complaint', label: 'Complaint', required: true, span: 2 }, { name: 'treatment', label: 'Treatment / action', type: 'textarea' },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (v) => fmtDate(v.date) },
            { key: 'student', label: 'Student', render: (v) => <div><p className="font-semibold">{L.studentName(v.studentId)}</p><p className="text-xs text-slate-500">{L.studentClass(v.studentId)?.name}</p></div> },
            { key: 'complaint', label: 'Complaint' },
            { key: 'treatment', label: 'Treatment', hideOnMobile: true, render: (v) => <span className="text-slate-500">{v.treatment}</span> },
            { key: 'parentNotified', label: 'Parent', render: (v) => <Badge tone={v.parentNotified ? 'green' : 'slate'}>{v.parentNotified ? 'Notified' : 'No'}</Badge> },
          ]}
        />
      )}
      {tab === 'alerts' && (
        <CrudPage collection="students" noun="student" rows={allergies} canEdit={false}
          columns={[
            { key: 'name', label: 'Student', render: (s) => <span className="font-semibold">{fullName(s)}</span> },
            { key: 'class', label: 'Class', render: (s) => L.className(s.classId) },
            { key: 'allergies', label: 'Allergy', render: (s) => s.allergies ? <Badge tone="red">{s.allergies}</Badge> : '—' },
            { key: 'medicalNotes', label: 'Condition', render: (s) => s.medicalNotes || '—' },
            { key: 'bloodGroup', label: 'Blood', hideOnMobile: true },
            { key: 'phone', label: 'Emergency', hideOnMobile: true, render: (s) => L.parent(s.parentId)?.phone },
          ]}
        />
      )}
      {tab === 'discipline' && (
        <CrudPage collection="incidents" noun="incident" initialSort={{ key: 'date', dir: 'desc' }} defaults={{ date: TODAY, status: 'Open', reportedBy: user.linkedId }}
          fields={[
            { name: 'studentId', label: 'Student', type: 'select', options: studentOpts, required: true, span: 2 },
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'type', label: 'Offence', type: 'select', options: ['Lateness', 'Uniform violation', 'Fighting', 'Bullying', 'Use of phone in class', 'Truancy', 'Disrespect to staff', 'Examination malpractice', 'Other'], required: true },
            { name: 'action', label: 'Action taken', type: 'select', options: ['Verbal warning', 'Detention', 'Parent invited', 'Community service', 'Suspension (2 days)', 'Counselling'] },
            { name: 'status', label: 'Status', type: 'select', options: ['Open', 'Resolved'] },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (v) => fmtDate(v.date) },
            { key: 'student', label: 'Student', render: (v) => <div><p className="font-semibold">{L.studentName(v.studentId)}</p><p className="text-xs text-slate-500">{L.studentClass(v.studentId)?.name}</p></div> },
            { key: 'type', label: 'Offence', render: (v) => <Badge tone="amber">{v.type}</Badge> },
            { key: 'action', label: 'Action', hideOnMobile: true },
            { key: 'reportedBy', label: 'Reported by', hideOnMobile: true, render: (v) => L.staffName(v.reportedBy) },
            { key: 'status', label: 'Status', render: (v) => <Badge tone={v.status === 'Open' ? 'red' : 'green'} dot>{v.status}</Badge> },
          ]}
        />
      )}
    </>
  );
}

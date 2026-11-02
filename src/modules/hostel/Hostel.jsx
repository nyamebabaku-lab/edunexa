import { useState } from 'react';
import { BedDouble, Users, DoorOpen, Home, X, UserPlus, Check } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, TODAY } from '../../data/selectors';
import { fmtDate, fullName } from '../../lib/format';
import { Card, PageHeader, Tabs, Badge, Avatar, Button, StatCard, Progress, Modal, Select, IconButton, toast } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

export default function Hostel() {
  const db = useDB();
  const L = useLookups();
  const [tab, setTab] = useState('dorms');
  const [open, setOpen] = useState(null);
  const [pick, setPick] = useState('');
  const boarders = db.students.filter((s) => s.boarding === 'Boarder' && s.status === 'Active');
  const occupants = (id) => boarders.filter((s) => s.dormId === id);
  const d = open && db.dorms.find((x) => x.id === open);
  const unassigned = boarders.filter((s) => !s.dormId);
  const out = db.exeats.filter((e) => e.status === 'Approved');

  return (
    <>
      <PageHeader title="Hostel & Boarding" subtitle="Halls, bed allocation and exeats" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Boarders" value={boarders.length} icon={Users} />
        <StatCard label="Beds" value={`${boarders.filter((s) => s.dormId).length}/${db.dorms.reduce((a, x) => a + x.capacity, 0)}`} icon={BedDouble} tone="navy" sub="occupied" />
        <StatCard label="On exeat" value={out.length} icon={DoorOpen} tone="amber" />
        <StatCard label="Pending exeats" value={db.exeats.filter((e) => e.status === 'Pending').length} icon={Home} tone="red" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'dorms', label: 'Halls' }, { value: 'exeats', label: 'Exeats' }, { value: 'manage', label: 'Manage halls' }]} />
      {tab === 'dorms' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {db.dorms.map((dm) => {
            const n = occupants(dm.id).length;
            return (
              <Card key={dm.id} className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setOpen(dm.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/30"><BedDouble className="h-5 w-5" /></div>
                  <Badge tone={dm.gender === 'Female' ? 'red' : 'blue'}>{dm.gender === 'Female' ? 'Girls' : 'Boys'}</Badge>
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{dm.name}</p>
                <p className="text-xs text-slate-500">Housemaster: {L.staffName(dm.masterId)}</p>
                <div className="mt-4 flex items-center gap-2 text-xs"><Progress value={(n / dm.capacity) * 100} /><span className="shrink-0 font-semibold">{n}/{dm.capacity}</span></div>
              </Card>
            );
          })}
        </div>
      )}
      {tab === 'exeats' && (
        <CrudPage collection="exeats" noun="exeat" initialSort={{ key: 'departure', dir: 'desc' }} defaults={{ departure: TODAY, returnDate: TODAY, status: 'Pending', guardian: 'Parent' }}
          fields={[
            { name: 'studentId', label: 'Student', type: 'select', options: boarders.map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` })), required: true, span: 2 },
            { name: 'reason', label: 'Reason', required: true, span: 2 },
            { name: 'departure', label: 'Departure', type: 'date' }, { name: 'returnDate', label: 'Expected return', type: 'date' },
            { name: 'guardian', label: 'Picked up by' }, { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Returned', 'Declined'] },
          ]}
          columns={[
            { key: 'student', label: 'Student', render: (e) => <span className="font-semibold">{L.studentName(e.studentId)}</span> },
            { key: 'reason', label: 'Reason' },
            { key: 'departure', label: 'Out', render: (e) => fmtDate(e.departure, 'd MMM') },
            { key: 'returnDate', label: 'Back', render: (e) => fmtDate(e.returnDate, 'd MMM') },
            { key: 'status', label: 'Status', render: (e) => e.status === 'Pending' ? (
              <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                <Badge tone="amber">Pending</Badge>
                <IconButton icon={Check} label="Approve" tone="soft" onClick={() => { db.update('exeats', e.id, { status: 'Approved' }); toast.success('Exeat approved', 'Parent notified by SMS'); }} />
              </div>
            ) : <Badge tone={e.status === 'Approved' ? 'blue' : e.status === 'Returned' ? 'green' : 'red'}>{e.status}</Badge> },
          ]}
        />
      )}
      {tab === 'manage' && (
        <CrudPage collection="dorms" noun="hall" defaults={{ gender: 'Male', capacity: 24 }}
          fields={[
            { name: 'name', label: 'Hall name', required: true }, { name: 'house', label: 'House' },
            { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] }, { name: 'capacity', label: 'Beds', type: 'number' },
            { name: 'masterId', label: 'House master / mistress', type: 'select', options: db.staff.filter((s) => ['Teacher', 'Matron'].includes(s.role)).map((s) => ({ value: s.id, label: `${s.title} ${s.firstName} ${s.lastName}` })), span: 2 },
          ]}
          columns={[{ key: 'name', label: 'Hall', render: (x) => <span className="font-semibold">{x.name}</span> }, { key: 'gender', label: 'Gender' }, { key: 'capacity', label: 'Beds' }, { key: 'masterId', label: 'Master', render: (x) => L.staffName(x.masterId) }]}
        />
      )}
      <Modal open={!!d} onClose={() => setOpen(null)} title={d?.name} subtitle={d && `${occupants(d.id).length}/${d.capacity} beds · ${L.staffName(d.masterId)}`} size="lg">
        {d && (
          <>
            <div className="mb-4 flex gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} placeholder={`Allocate a ${d.gender === 'Female' ? 'girl' : 'boy'} boarder…`} options={boarders.filter((s) => s.gender === d.gender && s.dormId !== d.id).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}${s.dormId ? ' (move)' : ''}` }))} />
              <Button icon={UserPlus} onClick={() => { if (!pick) return; db.update('students', pick, { dormId: d.id, house: d.house, bed: `${d.name.slice(0, 3).toUpperCase()}-${occupants(d.id).length + 1}` }); toast.success('Bed allocated'); setPick(''); }}>Allocate</Button>
            </div>
            {unassigned.length > 0 && <p className="mb-3 text-xs text-accent-600">{unassigned.length} boarder(s) have no bed yet.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {occupants(d.id).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-white/5">
                  <Avatar name={fullName(s)} size="xs" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{fullName(s)}</p><p className="text-xs text-slate-500">{L.className(s.classId)} · Bed {s.bed}</p></div>
                  <IconButton icon={X} label="Remove" onClick={() => db.update('students', s.id, { dormId: null, bed: '' })} />
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

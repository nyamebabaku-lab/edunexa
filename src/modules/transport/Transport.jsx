import { useState } from 'react';
import { Bus, MapPin, Clock, Phone, Users, Wrench, UserPlus, X, Route as RouteIcon } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, TODAY } from '../../data/selectors';
import { fmtDate, money, fullName, daysBetween } from '../../lib/format';
import { Card, CardHeader, PageHeader, Tabs, Badge, Avatar, Button, StatCard, Modal, Select, Progress, IconButton, EmptyState, toast } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

function ParentBus() {
  const db = useDB();
  const L = useLookups();
  const { student } = usePortalStudent();
  const route = db.routes.find((r) => r.id === student.busRouteId);
  const bus = route && db.buses.find((b) => b.id === route.busId);
  return (
    <>
      <PageHeader title="School Bus" subtitle={`${student.firstName}'s transport`} />
      {!route ? (
        <Card><EmptyState icon={Bus} title={`${student.firstName} is not on a bus route`} text="Contact the transport office to subscribe to school transport." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
              <Bus className="h-8 w-8" />
              <p className="mt-3 text-xl font-bold">{route.name}</p>
              <p className="text-sm text-brand-100">Morning pick-up from {route.departure} · {money(route.fee)} per term</p>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <p className="flex items-center gap-2"><Bus className="h-4 w-4 text-brand-600" /> {bus?.model} · <b>{bus?.regNo}</b> <Badge tone={bus?.status === 'Active' ? 'green' : 'red'}>{bus?.status}</Badge></p>
              <p className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" /> Driver: <b>{L.staffName(bus?.driverId)}</b></p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-600" /> {L.staff(bus?.driverId)?.phone}</p>
              {bus?.status !== 'Active' && <p className="rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">This bus is under maintenance. A replacement bus is covering the route this week.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Stops" icon={MapPin} />
            <ol className="relative m-5 space-y-4 border-l-2 border-brand-200 pl-6 dark:border-brand-500/30">
              {route.stops.split(',').map((s, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-white dark:ring-navy-900" />
                  <p className="text-sm font-semibold">{s.trim()}</p>
                </li>
              ))}
              <li className="relative">
                <span className="absolute -left-[31px] top-0.5 h-4 w-4 rounded-full bg-accent-600 ring-4 ring-white dark:ring-navy-900" />
                <p className="text-sm font-bold text-accent-600">School</p>
              </li>
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}

function Routes() {
  const db = useDB();
  const L = useLookups();
  const [open, setOpen] = useState(null);
  const [pick, setPick] = useState('');
  const r = open && db.routes.find((x) => x.id === open);
  const riders = (rid) => db.students.filter((s) => s.busRouteId === rid);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.routes.map((rt) => {
          const bus = db.buses.find((b) => b.id === rt.busId);
          const n = riders(rt.id).length;
          return (
            <Card key={rt.id} className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setOpen(rt.id)}>
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><RouteIcon className="h-5 w-5" /></div>
                <Badge tone={bus?.status === 'Active' ? 'green' : 'red'} dot>{bus?.status}</Badge>
              </div>
              <p className="mt-4 font-bold text-slate-900 dark:text-white">{rt.name}</p>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{rt.stops}</p>
              <div className="mt-4 flex justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {rt.departure}</span>
                <span>{bus?.regNo}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{money(rt.fee)}/term</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs"><Progress value={(n / (bus?.capacity || 1)) * 100} tone={n > (bus?.capacity || 0) ? 'red' : 'blue'} /><span className="shrink-0 font-semibold">{n}/{bus?.capacity}</span></div>
            </Card>
          );
        })}
      </div>
      <Modal open={!!r} onClose={() => setOpen(null)} title={r?.name} subtitle={r && `${db.buses.find((b) => b.id === r.busId)?.regNo} · driver ${L.staffName(db.buses.find((b) => b.id === r.busId)?.driverId)}`} size="lg">
        {r && (
          <>
            <div className="mb-4 flex gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Add a day student to this route…" options={db.students.filter((s) => s.boarding === 'Day' && s.busRouteId !== r.id && s.status === 'Active').map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }))} />
              <Button icon={UserPlus} onClick={() => { if (!pick) return; db.update('students', pick, { busRouteId: r.id }); toast.success('Rider added', L.studentName(pick)); setPick(''); }}>Add</Button>
            </div>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
              {riders(r.id).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3">
                  <Avatar name={fullName(s)} size="xs" />
                  <div className="flex-1"><p className="text-sm font-semibold">{fullName(s)}</p><p className="text-xs text-slate-500">{L.className(s.classId)} · {L.parent(s.parentId)?.address}</p></div>
                  <span className="hidden text-xs text-slate-500 sm:block">{L.parent(s.parentId)?.phone}</span>
                  <IconButton icon={X} label="Remove" onClick={() => { db.update('students', s.id, { busRouteId: null }); toast.info('Rider removed'); }} />
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

export default function Transport() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const [tab, setTab] = useState('routes');
  if (user.role === 'parent') return <ParentBus />;
  const drivers = db.staff.filter((s) => s.role === 'Driver').map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }));
  const busOpts = db.buses.map((b) => ({ value: b.id, label: `${b.regNo} · ${b.model}` }));
  const expiring = db.buses.filter((b) => daysBetween(TODAY, b.roadworthyExpiry) < 30 || daysBetween(TODAY, b.insuranceExpiry) < 30);
  return (
    <>
      <PageHeader title="Transport" subtitle="Buses, routes, riders, trips and maintenance" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fleet" value={db.buses.length} icon={Bus} sub={`${db.buses.filter((b) => b.status === 'Active').length} active`} />
        <StatCard label="Riders" value={db.students.filter((s) => s.busRouteId).length} icon={Users} tone="navy" />
        <StatCard label="In maintenance" value={db.buses.filter((b) => b.status !== 'Active').length} icon={Wrench} tone="red" />
        <StatCard label="Docs expiring (30d)" value={expiring.length} icon={Clock} tone="amber" sub="Insurance / roadworthy" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'routes', label: 'Routes & riders' }, { value: 'buses', label: 'Buses' }, { value: 'trips', label: 'Trip log' }, { value: 'maintenance', label: 'Maintenance' }]} />
      {tab === 'routes' && <Routes />}
      {tab === 'buses' && (
        <CrudPage collection="buses" noun="bus" defaults={{ status: 'Active', capacity: 30 }}
          fields={[
            { name: 'regNo', label: 'Registration no.', required: true }, { name: 'model', label: 'Model', required: true },
            { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'driverId', label: 'Driver', type: 'select', options: drivers },
            { name: 'routeId', label: 'Route', type: 'select', options: db.routes.map((r) => ({ value: r.id, label: r.name })) },
            { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Maintenance', 'Retired'] },
            { name: 'insuranceExpiry', label: 'Insurance expiry', type: 'date' }, { name: 'roadworthyExpiry', label: 'Roadworthy expiry', type: 'date' },
            { name: 'mileage', label: 'Mileage (km)', type: 'number' },
          ]}
          columns={[
            { key: 'regNo', label: 'Reg. no.', render: (b) => <span className="font-mono font-semibold">{b.regNo}</span> },
            { key: 'model', label: 'Model' },
            { key: 'capacity', label: 'Seats', hideOnMobile: true },
            { key: 'driverId', label: 'Driver', render: (b) => L.staffName(b.driverId) },
            { key: 'routeId', label: 'Route', hideOnMobile: true, render: (b) => db.routes.find((r) => r.id === b.routeId)?.name },
            { key: 'roadworthyExpiry', label: 'Roadworthy', hideOnMobile: true, render: (b) => <Badge tone={daysBetween(TODAY, b.roadworthyExpiry) < 30 ? 'red' : 'slate'}>{fmtDate(b.roadworthyExpiry)}</Badge> },
            { key: 'status', label: 'Status', render: (b) => <Badge tone={b.status === 'Active' ? 'green' : 'red'} dot>{b.status}</Badge> },
          ]}
        />
      )}
      {tab === 'trips' && (
        <CrudPage collection="trips" noun="trip" initialSort={{ key: 'date', dir: 'desc' }} defaults={{ date: TODAY, type: 'Morning pick-up', status: 'Completed' }}
          fields={[
            { name: 'busId', label: 'Bus', type: 'select', options: busOpts, required: true }, { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'type', label: 'Trip', type: 'select', options: ['Morning pick-up', 'Afternoon drop-off', 'Excursion', 'Sports event'] },
            { name: 'riders', label: 'Riders on board', type: 'number' }, { name: 'departed', label: 'Departed', type: 'time' }, { name: 'arrived', label: 'Arrived', type: 'time' },
            { name: 'status', label: 'Status', type: 'select', options: ['Completed', 'Delayed', 'Cancelled'] }, { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (t) => fmtDate(t.date) },
            { key: 'busId', label: 'Bus', render: (t) => db.buses.find((b) => b.id === t.busId)?.regNo },
            { key: 'type', label: 'Trip' },
            { key: 'time', label: 'Time', hideOnMobile: true, render: (t) => `${t.departed} → ${t.arrived}` },
            { key: 'riders', label: 'Riders' },
            { key: 'notes', label: 'Notes', hideOnMobile: true, render: (t) => <span className="text-xs text-slate-500">{t.notes}</span> },
          ]}
        />
      )}
      {tab === 'maintenance' && (
        <CrudPage collection="maintenance" noun="maintenance record" defaults={{ date: TODAY, status: 'In progress' }}
          fields={[
            { name: 'busId', label: 'Bus', type: 'select', options: busOpts, required: true }, { name: 'date', label: 'Date', type: 'date' },
            { name: 'type', label: 'Work done', required: true }, { name: 'vendor', label: 'Vendor / garage' },
            { name: 'cost', label: 'Cost', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In progress', 'Completed'] },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
            { key: 'busId', label: 'Bus', render: (m) => db.buses.find((b) => b.id === m.busId)?.regNo },
            { key: 'type', label: 'Work', render: (m) => <span className="font-semibold">{m.type}</span> },
            { key: 'vendor', label: 'Vendor', hideOnMobile: true },
            { key: 'cost', label: 'Cost', render: (m) => money(m.cost) },
            { key: 'status', label: 'Status', render: (m) => <Badge tone={m.status === 'Completed' ? 'green' : 'amber'}>{m.status}</Badge> },
          ]}
        />
      )}
    </>
  );
}

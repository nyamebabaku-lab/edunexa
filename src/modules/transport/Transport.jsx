import { useState } from 'react';
import { Bus, MapPin, Clock, Phone, Users, Wrench, UserPlus, X, Route as RouteIcon, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Navigation, School, CheckCircle2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, TODAY } from '../../data/selectors';
import { fmtDate, money, fullName, daysBetween, uid } from '../../lib/format';
import { stopsOf, busOfRoute, routeOfBus, etaMinutes } from '../../lib/transport';
import { Card, CardHeader, PageHeader, Tabs, Badge, Avatar, Button, StatCard, Modal, Select, Progress, IconButton, EmptyState, Field, Input, toast, confirmDialog, cx } from '../../components/ui';
import CrudPage from '../../components/CrudPage';
import { photoKey } from '../../data/photos';
import LiveMap from './LiveMap';
import CrewTrip from './CrewTrip';
import { useTransportLive } from './useTransportLive';

const ago = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};

// ---------------------------------------------------------------- parents
function ParentBus() {
  const db = useDB();
  const { student } = usePortalStudent();
  const live = useTransportLive();
  const route = db.routes.find((r) => r.id === student?.busRouteId);
  const bus = busOfRoute(db, route);
  const stops = stopsOf(route);
  const myStop = stops.find((s) => s.id === student?.busStopId);
  const run = live.trips.find((t) => t.trip.routeId === route?.id);
  const crew = live.crew[route?.id] || {};
  const me = run?.trip.riders?.[student?.id] || {};
  const eta = run?.pos && myStop ? etaMinutes(run.pos, myStop) : null;
  if (!student) return null;
  return (
    <>
      <PageHeader title="School Bus" subtitle={`${student.firstName}'s transport`} />
      {!route ? (
        <Card><EmptyState icon={Bus} title={`${student.firstName} is not on a bus route`} text="Contact the transport office to subscribe to school transport." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <div className={cx('flex flex-wrap items-center gap-3 p-5 text-white', run ? 'bg-gradient-to-r from-accent-600 to-accent-500' : 'bg-gradient-to-r from-brand-700 to-brand-600')}>
              <Bus className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold">{run ? `${run.trip.type} · on the way` : route.name}</p>
                <p className="text-sm text-white/85">
                  {run
                    ? run.pos ? `Updated ${ago(run.pos.at)}${eta && !me.off ? ` · about ${eta} min to ${myStop.name}` : ''}` : 'Waiting for the bus location…'
                    : 'No trip running now — the map shows the bus during each trip'}
                </p>
              </div>
              {run && me.on && <Badge tone={me.off ? 'green' : 'blue'}>{me.off ? (run.trip.type === 'Morning pick-up' ? `At school ${me.off}` : `Dropped off ${me.off}`) : `On the bus since ${me.on}`}</Badge>}
            </div>
            <div className="p-3">
              <LiveMap buses={run?.pos ? [{ id: run.trip.busId, lat: run.pos.lat, lng: run.pos.lng, label: bus?.regNo || 'Bus', mine: true }] : []} routes={[route]} myStopId={myStop?.id} height={380} />
            </div>
            <p className="px-5 pb-4 text-xs text-slate-500">You get a notification when the bus is about 5 minutes from your stop, when {student.firstName} gets on, and when {student.firstName} is dropped off.</p>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title={`${student.firstName}'s stop`} icon={MapPin} />
              <div className="space-y-2 p-5 text-sm">
                {myStop ? (
                  <>
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{myStop.name}</p>
                    <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" /> Morning pick-up: <b>{myStop.am || '—'}</b></p>
                    <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent-600" /> Afternoon drop-off: <b>{myStop.pm || '—'}</b></p>
                  </>
                ) : <p className="text-slate-500">No stop set yet — the transport office will add it.</p>}
                <p className="pt-2 text-xs text-slate-500">{route.name} · {money(route.fee)} per term</p>
              </div>
            </Card>
            <Card>
              <CardHeader title="Bus and crew" icon={Bus} />
              <div className="space-y-3 p-5 text-sm">
                <p className="flex items-center gap-2"><Bus className="h-4 w-4 text-brand-600" /> {bus?.model} · <b>{bus?.regNo}</b> <Badge tone={bus?.status === 'Active' ? 'green' : 'red'}>{bus?.status}</Badge></p>
                {[['Driver', crew.driver], ['Bus attendant', crew.attendant]].map(([label, p]) => p && (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0 flex-1"><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{label}</p></div>
                    {p.phone && <a href={`tel:${p.phone}`}><Button size="sm" variant="soft" icon={Phone}>Call</Button></a>}
                  </div>
                ))}
                {bus?.status !== 'Active' && <p className="rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">This bus is under maintenance. A replacement bus is covering the route.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- live map for the transport office
function LiveTab() {
  const db = useDB();
  const live = useTransportLive();
  const today = db.trips.filter((t) => t.date === TODAY).sort((a, b) => String(b.departed).localeCompare(String(a.departed)));
  const buses = live.trips.filter((t) => t.pos).map((t) => ({ id: t.trip.busId, lat: t.pos.lat, lng: t.pos.lng, label: db.buses.find((b) => b.id === t.trip.busId)?.regNo || 'Bus' }));
  const routes = db.routes.filter((r) => live.trips.some((t) => t.trip.routeId === r.id));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card className="p-3">
        <LiveMap buses={buses} routes={routes.length ? routes : db.routes} follow={false} height={460} />
        {!live.trips.length && <p className="p-3 text-sm text-slate-500">No bus is on a trip right now. Buses appear here when the driver or attendant starts a trip in their app.</p>}
      </Card>
      <Card>
        <CardHeader title="Trips today" icon={Navigation} />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {!today.length && <p className="p-5 text-sm text-slate-500">No trips yet today.</p>}
          {today.map((t) => {
            const lv = live.trips.find((x) => x.trip.id === t.id);
            const riders = Object.values(t.riders || {});
            const onBoard = riders.filter((r) => r.on && !r.off).length;
            return (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-bold">{db.buses.find((b) => b.id === t.busId)?.regNo} · {t.type}</p>
                  <Badge tone={t.status === 'Running' ? 'red' : t.status === 'Completed' ? 'green' : 'amber'} dot>{t.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">{t.routeName || db.routes.find((r) => r.id === t.routeId)?.name} · left {t.departed}{t.arrived ? ` · arrived ${t.arrived}` : ''}</p>
                <p className="text-xs text-slate-500">{t.status === 'Running' ? `${onBoard} on board · ${lv?.pos ? `location ${ago(lv.pos.at)}` : 'no location yet'}` : `${t.ridersCount ?? riders.filter((r) => r.on).length ?? t.riders} rode`}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- routes, stops, riders
function StopEditor({ value, onChange }) {
  const list = value || [];
  const set = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, d) => {
    const n = [...list];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_96px_96px_auto] gap-2 px-1 text-[11px] font-semibold uppercase text-slate-400 sm:grid"><span>Stop</span><span>Pick-up</span><span>Drop-off</span><span /></div>
      {list.map((s, i) => (
        <div key={s.id} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-white/[.03] sm:grid-cols-[1fr_96px_96px_auto] sm:items-center">
          <Input className="col-span-2 sm:col-span-1" value={s.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={`Stop ${i + 1}, e.g. Baatsona Junction`} aria-label="Stop name" />
          <Input type="time" value={s.am || ''} onChange={(e) => set(i, { am: e.target.value })} aria-label="Morning pick-up" />
          <Input type="time" value={s.pm || ''} onChange={(e) => set(i, { pm: e.target.value })} aria-label="Afternoon drop-off" />
          <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
            {s.lat != null ? <Badge tone="green" title="Saved from the bus">📍</Badge> : <Badge tone="slate" title="The crew saves it from the bus">no pin</Badge>}
            <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" />
            <IconButton icon={ArrowDown} label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30" />
            <IconButton icon={Trash2} label="Remove stop" className="hover:!text-accent-600" onClick={() => onChange(list.filter((_, j) => j !== i))} />
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...list, { id: uid('stp'), name: '', am: '', pm: '', lat: null, lng: null }])}>Add stop</Button>
      <p className="text-xs text-slate-500">In order from the first pick-up to school. The bus crew saves each stop's map pin from the bus ("Save location here"), which turns on the "5 minutes away" alerts.</p>
    </div>
  );
}

function RouteForm({ route, onClose }) {
  const db = useDB();
  const [v, setV] = useState(() => (route ? { ...route, stopList: stopsOf(route) } : { name: '', busId: '', fee: 0, pmDeparture: '14:45', stopList: [] }));
  if (!v) return null;
  const save = () => {
    if (!v.name.trim()) return toast.error('Enter the route name');
    const stopList = v.stopList.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() }));
    if (!stopList.length) return toast.error('Add the stops', 'At least one stop with a name');
    const rec = { name: v.name.trim(), busId: v.busId || '', fee: Number(v.fee) || 0, pmDeparture: v.pmDeparture || '', stopList, stops: stopList.map((s) => s.name).join(', '), departure: stopList[0]?.am || '' };
    // One bus runs one route: free the bus from any other route.
    if (rec.busId) db.routes.filter((r) => r.busId === rec.busId && r.id !== route?.id).forEach((r) => db.update('routes', r.id, { busId: '' }));
    if (route) db.update('routes', route.id, rec);
    else db.add('routes', rec);
    // Riders whose stop was removed lose it.
    if (route) {
      const keep = new Set(stopList.map((s) => s.id));
      db.students.filter((s) => s.busRouteId === route.id && s.busStopId && !keep.has(s.busStopId)).forEach((s) => db.update('students', s.id, { busStopId: '' }));
    }
    toast.success(route ? 'Route updated' : 'Route added', `${rec.name} · ${stopList.length} stops`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={route ? 'Edit route' : 'New route'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save route</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Route name *" className="sm:col-span-2"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Route A – Spintex" /></Field>
        <Field label="Bus"><Select value={v.busId || ''} onChange={(e) => setV({ ...v, busId: e.target.value })} placeholder="No bus yet" options={db.buses.map((b) => ({ value: b.id, label: `${b.regNo} · ${b.model}${routeOfBus(db, b) && routeOfBus(db, b).id !== route?.id ? ` (now on ${routeOfBus(db, b).name})` : ''}` }))} /></Field>
        <Field label="Fee per term"><Input type="number" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} /></Field>
        <Field label="Leaves school in the afternoon" className="sm:col-span-2"><Input type="time" value={v.pmDeparture || ''} onChange={(e) => setV({ ...v, pmDeparture: e.target.value })} /></Field>
        <div className="sm:col-span-2"><span className="label">Stops and times</span><StopEditor value={v.stopList} onChange={(stopList) => setV({ ...v, stopList })} /></div>
      </div>
    </Modal>
  );
}

function Routes() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const canEdit = ['admin', 'headteacher', 'transport', 'superadmin'].includes(user.role);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [pick, setPick] = useState('');
  const r = open && db.routes.find((x) => x.id === open);
  const riders = (rid) => db.students.filter((s) => s.busRouteId === rid);
  const del = async (rt) => {
    const n = riders(rt.id).length;
    if (!(await confirmDialog(`Delete ${rt.name}?`, n ? `${n} rider(s) are taken off this route (no transport fee on their next bill).` : 'This cannot be undone.', { confirmLabel: 'Delete' }))) return;
    riders(rt.id).forEach((s) => db.update('students', s.id, { busRouteId: null, busStopId: '' }));
    db.remove('routes', rt.id);
    setOpen(null);
    toast.success('Route deleted');
  };
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => setEdit('new')}>New route</Button></div>}
      {!db.routes.length && <Card><EmptyState icon={RouteIcon} title="No routes yet" text="Add your bus routes with their stops and pick-up / drop-off times." action={canEdit && <Button icon={Plus} onClick={() => setEdit('new')}>New route</Button>} /></Card>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.routes.map((rt) => {
          const bus = busOfRoute(db, rt);
          const n = riders(rt.id).length;
          const stops = stopsOf(rt);
          return (
            <Card key={rt.id} className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => setOpen(rt.id)}>
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><RouteIcon className="h-5 w-5" /></div>
                {bus ? <Badge tone={bus.status === 'Active' ? 'green' : 'red'} dot>{bus.status}</Badge> : <Badge tone="amber">No bus</Badge>}
              </div>
              <p className="mt-4 font-bold text-slate-900 dark:text-white">{rt.name}</p>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{stops.map((s) => s.name).join(' → ')}</p>
              <div className="mt-4 flex justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {stops[0]?.am || rt.departure || '—'}{rt.pmDeparture ? ` / ${rt.pmDeparture}` : ''}</span>
                <span>{bus?.regNo}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{money(rt.fee)}/term</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs"><Progress value={(n / (bus?.capacity || 1)) * 100} tone={n > (bus?.capacity || 0) ? 'red' : 'blue'} /><span className="shrink-0 font-semibold">{n}/{bus?.capacity || '—'}</span></div>
            </Card>
          );
        })}
      </div>
      <Modal open={!!r} onClose={() => setOpen(null)} title={r?.name} subtitle={r && `${busOfRoute(db, r)?.regNo || 'No bus'} · driver ${L.staffName(busOfRoute(db, r)?.driverId)} · attendant ${L.staffName(busOfRoute(db, r)?.attendantId)}`} size="lg"
        footer={canEdit && r && <><Button variant="soft-red" icon={Trash2} onClick={() => del(r)}>Delete route</Button><Button variant="secondary" icon={Pencil} onClick={() => { setEdit(r); setOpen(null); }}>Edit route & stops</Button></>}>
        {r && (
          <>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-slate-400"><th className="py-1">#</th><th>Stop</th><th>Pick-up</th><th>Drop-off</th><th>Riders</th></tr></thead>
                <tbody>
                  {stopsOf(r).map((s, i) => (
                    <tr key={s.id} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5 text-slate-400">{i + 1}</td><td className="font-medium">{s.name} {s.lat != null && '📍'}</td><td>{s.am || '—'}</td><td>{s.pm || '—'}</td><td>{riders(r.id).filter((x) => x.busStopId === s.id).length}</td></tr>
                  ))}
                  <tr className="border-t border-slate-100 dark:border-white/5"><td /><td className="py-1.5 font-bold text-accent-600"><School className="mr-1 inline h-3.5 w-3.5" />School</td><td /><td>{r.pmDeparture ? `leaves ${r.pmDeparture}` : ''}</td><td /></tr>
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="mb-4 flex gap-2">
                <Select value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Add a day student to this route…" options={db.students.filter((s) => s.boarding !== 'Boarder' && s.busRouteId !== r.id && s.status === 'Active').map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }))} />
                <Button icon={UserPlus} onClick={() => { if (!pick) return; db.update('students', pick, { busRouteId: r.id, busStopId: '' }); toast.success('Rider added', `${L.studentName(pick)} — now choose their stop`); setPick(''); }}>Add</Button>
              </div>
            )}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
              {!riders(r.id).length && <p className="p-4 text-sm text-slate-500">No riders yet.</p>}
              {riders(r.id).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <Avatar name={fullName(s)} photo={photoKey('Student', s.id)} size="xs" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{fullName(s)}</p><p className="text-xs text-slate-500">{L.className(s.classId)} · {L.parent(s.parentId)?.phone || s.parentPhone || 'no phone'}</p></div>
                  {canEdit ? (
                    <Select className="!w-48 !py-1.5" aria-label={`${s.firstName}'s stop`} value={s.busStopId || ''} onChange={(e) => db.update('students', s.id, { busStopId: e.target.value })} placeholder="Choose stop" options={stopsOf(r).map((x) => ({ value: x.id, label: `${x.name}${x.am ? ` · ${x.am}` : ''}` }))} />
                  ) : <Badge tone="slate">{stopsOf(r).find((x) => x.id === s.busStopId)?.name || 'No stop'}</Badge>}
                  {canEdit && <IconButton icon={X} label="Remove" onClick={() => { db.update('students', s.id, { busRouteId: null, busStopId: '' }); toast.info('Rider removed'); }} />}
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
      {edit && <RouteForm route={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

export default function Transport() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const [tab, setTab] = useState('live');
  if (user.role === 'parent') return <ParentBus />;
  if (user.role === 'driver' || user.role === 'attendant') return <CrewTrip />;
  const crewOpts = (role) => db.staff.filter((s) => s.status !== 'Exited' && (role === 'Driver' ? /driver/i : /attendant|matron/i).test(s.role || '')).map((s) => ({ value: s.id, label: `${s.title ? s.title + ' ' : ''}${s.firstName} ${s.lastName}` }));
  const busOpts = db.buses.map((b) => ({ value: b.id, label: `${b.regNo} · ${b.model}` }));
  const soon = (date) => !!date && daysBetween(TODAY, date) < 30;
  const expiring = db.buses.filter((b) => soon(b.roadworthyExpiry) || soon(b.insuranceExpiry));
  const running = db.trips.filter((t) => t.status === 'Running').length;
  return (
    <>
      <PageHeader title="Transport" subtitle="Live buses, routes and stops, riders, crew, trips and maintenance" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="On the road now" value={running} icon={Navigation} tone="red" sub={`${db.buses.length} buses · ${db.buses.filter((b) => b.status === 'Active').length} active`} />
        <StatCard label="Riders" value={db.students.filter((s) => s.busRouteId).length} icon={Users} tone="navy" sub={`${db.students.filter((s) => s.busRouteId && !s.busStopId).length} without a stop`} />
        <StatCard label="In maintenance" value={db.buses.filter((b) => b.status !== 'Active').length} icon={Wrench} tone="amber" />
        <StatCard label="Docs expiring (30d)" value={expiring.length} icon={Clock} tone="amber" sub="Insurance / roadworthy" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'live', label: 'Live map', count: running || undefined }, { value: 'routes', label: 'Routes & riders' }, { value: 'buses', label: 'Buses & crew' }, { value: 'trips', label: 'Trip log' }, { value: 'maintenance', label: 'Maintenance' }]} />
      {tab === 'live' && <LiveTab />}
      {tab === 'routes' && <Routes />}
      {tab === 'buses' && (
        <CrudPage collection="buses" noun="bus" defaults={{ status: 'Active', capacity: 30 }}
          fields={[
            { name: 'regNo', label: 'Registration no.', required: true }, { name: 'model', label: 'Model', required: true },
            { name: 'capacity', label: 'Capacity', type: 'number' },
            { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Maintenance', 'Retired'] },
            { name: 'driverId', label: 'Driver', type: 'select', options: crewOpts('Driver'), placeholder: 'None', emptyHint: 'Add staff with the role Driver in Staff & HR' },
            { name: 'attendantId', label: 'Bus attendant', type: 'select', options: crewOpts('Attendant'), placeholder: 'None', emptyHint: 'Add staff with the role Bus Attendant in Staff & HR' },
            { name: 'insuranceExpiry', label: 'Insurance expiry', type: 'date' }, { name: 'roadworthyExpiry', label: 'Roadworthy expiry', type: 'date' },
            { name: 'mileage', label: 'Mileage (km)', type: 'number' },
          ]}
          toRecord={(v) => { const out = { ...v }; delete out.routeId; return out; }} // the route chooses its bus (Routes tab)
          columns={[
            { key: 'regNo', label: 'Reg. no.', render: (b) => <span className="font-mono font-semibold">{b.regNo}</span> },
            { key: 'model', label: 'Model', hideOnMobile: true },
            { key: 'driverId', label: 'Driver', render: (b) => L.staffName(b.driverId) },
            { key: 'attendantId', label: 'Attendant', hideOnMobile: true, render: (b) => L.staffName(b.attendantId) },
            { key: 'route', label: 'Route', hideOnMobile: true, render: (b) => routeOfBus(db, b)?.name || '—' },
            { key: 'roadworthyExpiry', label: 'Roadworthy', hideOnMobile: true, render: (b) => (b.roadworthyExpiry ? <Badge tone={soon(b.roadworthyExpiry) ? 'red' : 'slate'}>{fmtDate(b.roadworthyExpiry)}</Badge> : <span className="text-xs text-slate-400">Not set</span>) },
            { key: 'status', label: 'Status', render: (b) => <Badge tone={b.status === 'Active' ? 'green' : 'red'} dot>{b.status}</Badge> },
          ]}
        />
      )}
      {tab === 'trips' && (
        <CrudPage collection="trips" noun="trip" initialSort={{ key: 'date', dir: 'desc' }} defaults={{ date: TODAY, type: 'Excursion', status: 'Completed' }}
          fields={[
            { name: 'busId', label: 'Bus', type: 'select', options: busOpts, required: true }, { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'type', label: 'Trip', type: 'select', options: ['Morning pick-up', 'Afternoon drop-off', 'Excursion', 'Sports event'] },
            { name: 'ridersCount', label: 'Riders on board', type: 'number' }, { name: 'departed', label: 'Departed', type: 'time' }, { name: 'arrived', label: 'Arrived', type: 'time' },
            { name: 'status', label: 'Status', type: 'select', options: ['Completed', 'Delayed', 'Cancelled'] }, { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          columns={[
            { key: 'date', label: 'Date', render: (t) => fmtDate(t.date) },
            { key: 'busId', label: 'Bus', render: (t) => db.buses.find((b) => b.id === t.busId)?.regNo },
            { key: 'type', label: 'Trip' },
            { key: 'time', label: 'Time', hideOnMobile: true, render: (t) => `${t.departed || ''} → ${t.arrived || (t.status === 'Running' ? 'on the road' : '')}` },
            { key: 'riders', label: 'Riders', render: (t) => (t.riders && typeof t.riders === 'object' ? Object.values(t.riders).filter((x) => x.on).length : t.ridersCount ?? t.riders) },
            { key: 'status', label: 'Status', render: (t) => <Badge tone={t.status === 'Running' ? 'red' : t.status === 'Completed' ? 'green' : 'amber'} dot>{t.status === 'Running' ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Running</span> : t.status}</Badge> },
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

// Bus crew screen (Driver and Bus Attendant): start the morning or afternoon trip, share the bus location from this
// phone, tick children on and off at each stop, save stop locations, end the trip. Both crew phones share the location,
// so the driver never needs to touch the phone while driving — the attendant does the ticking.
import { useMemo } from 'react';
import { Bus, Play, Square, MapPin, Navigation, Phone, CheckCircle2, Circle, School, AlertTriangle, Satellite } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useLookups, TODAY } from '../../data/selectors';
import { fullName, uid } from '../../lib/format';
import { stopsOf, crewBus, routeOfBus, runningTrip, startSharing, stopSharing, useSharing } from '../../lib/transport';
import { Card, CardHeader, PageHeader, Button, Badge, EmptyState, toast, confirmDialog, cx } from '../../components/ui';
import LiveMap from './LiveMap';

const hm = () => new Date().toTimeString().slice(0, 5);

export default function CrewTrip() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const bus = crewBus(db, user.linkedId);
  const route = routeOfBus(db, bus);
  const trip = bus ? runningTrip(db, bus.id) : null;
  const sharing = useSharing();
  const sharingThis = trip && sharing.tripId === trip.id;
  const stops = stopsOf(route);
  const riders = useMemo(() => db.students.filter((s) => route && s.busRouteId === route.id && s.status === 'Active'), [db.students, route]);
  const isAttendant = user.role === 'attendant';

  if (!bus || !route)
    return (
      <>
        <PageHeader title="My bus" subtitle={user.role === 'driver' ? 'Driver' : 'Bus attendant'} />
        <Card><EmptyState icon={Bus} title={bus ? 'Your bus has no route yet' : 'You are not on a bus yet'} text="Ask the Transport Officer to put you on a bus (Transport → Buses: driver or attendant) and give the bus a route." /></Card>
      </>
    );

  const morning = new Date().getHours() < 12;
  const start = async (type) => {
    const rec = { id: uid('trp'), date: TODAY, busId: bus.id, routeId: route.id, routeName: route.name, type, status: 'Running', startedAt: new Date().toISOString(), departed: hm(), arrived: '', riders: {}, startedBy: user.linkedId };
    db.add('trips', rec);
    toast.success(`${type} started`, 'This phone is now sharing the bus location');
    await startSharing(rec.id);
  };
  const end = async () => {
    const onBoard = Object.values(trip.riders || {}).filter((r) => r.on && !r.off).length;
    if (!(await confirmDialog('End this trip?', onBoard ? `${onBoard} child(ren) are still ticked as on the bus.` : 'The bus location stops being shared.', { danger: false, confirmLabel: 'End trip' }))) return;
    db.update('trips', trip.id, { status: 'Completed', arrived: hm(), endedAt: new Date().toISOString(), ridersCount: Object.values(trip.riders || {}).filter((r) => r.on).length });
    await stopSharing();
    toast.success('Trip ended', 'Saved in the trip log');
  };
  const mark = (s, field) => {
    const cur = trip.riders?.[s.id] || {};
    const stop = stops.find((x) => x.id === s.busStopId);
    const next = cur[field] ? { ...cur, [field]: '' } : { ...cur, [field]: hm(), stopId: s.busStopId || '', stopName: stop?.name || '' };
    db.update('trips', trip.id, (t) => ({ riders: { ...(t.riders || {}), [s.id]: next } }));
  };
  const allOffAtSchool = () => {
    const now = hm();
    const r = { ...(trip.riders || {}) };
    Object.entries(r).forEach(([id, v]) => { if (v.on && !v.off) r[id] = { ...v, off: now }; });
    db.update('trips', trip.id, { riders: r });
    toast.success('Everyone is off at school');
  };
  const saveStopHere = async (stop) => {
    const here = sharing.last || (await new Promise((res) => navigator.geolocation?.getCurrentPosition((g) => res({ lat: g.coords.latitude, lng: g.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 15000 })));
    if (!here) return toast.error('No location yet', 'Wait for the phone to find its location, then try again');
    db.update('routes', route.id, (r) => ({ stopList: stopsOf(r).map((x) => (x.id === stop.id ? { ...x, lat: here.lat, lng: here.lng } : x)) }));
    toast.success('Stop location saved', `${stop.name} — parents now get "5 minutes away" alerts for it`);
  };

  const seq = trip?.type === 'Afternoon drop-off' ? [...stops].reverse() : stops;
  const atStop = (stopId) => riders.filter((s) => (s.busStopId || '') === stopId);
  const noStop = riders.filter((s) => !stops.some((x) => x.id === s.busStopId));

  const ChildRow = ({ s }) => {
    const r = trip?.riders?.[s.id] || {};
    const parent = L.parent(s.parentId);
    return (
      <div className="flex flex-wrap items-center gap-2 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{fullName(s)}</p>
          <p className="text-xs text-slate-500">{L.className(s.classId)}{r.on ? ` · on ${r.on}` : ''}{r.off ? ` · off ${r.off}` : ''}</p>
        </div>
        {parent?.phone && <a href={`tel:${parent.phone}`} className="rounded-lg p-2 text-brand-600 hover:bg-brand-50" aria-label={`Call ${s.firstName}'s parent`}><Phone className="h-4 w-4" /></a>}
        {trip && (
          <>
            <Button size="sm" variant={r.on ? 'primary' : 'secondary'} icon={r.on ? CheckCircle2 : Circle} onClick={() => mark(s, 'on')}>On</Button>
            <Button size="sm" variant={r.off ? 'primary' : 'secondary'} icon={r.off ? CheckCircle2 : Circle} disabled={!r.on} onClick={() => mark(s, 'off')}>Off</Button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader title="My bus" subtitle={`${bus.regNo} · ${route.name} · ${user.role === 'driver' ? 'Driver' : 'Bus attendant'}`} />
      {!trip ? (
        <Card className="mb-6 p-6">
          <p className="font-bold text-slate-900 dark:text-white">Start a trip</p>
          <p className="mt-1 text-sm text-slate-500">Parents follow the bus on the map and get alerts while a trip is running. The location is only shared during a trip.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button size="lg" variant={morning ? 'primary' : 'secondary'} icon={Play} onClick={() => start('Morning pick-up')}>Start morning pick-up</Button>
            <Button size="lg" variant={!morning ? 'primary' : 'secondary'} icon={Play} onClick={() => start('Afternoon drop-off')}>Start afternoon drop-off</Button>
          </div>
          {user.role === 'driver' && <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" /> Start the trip before you drive, then put the phone away. It keeps sharing the location by itself — the attendant ticks the children.</p>}
        </Card>
      ) : (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-brand-700 to-brand-600 p-5 text-white">
            <Navigation className="h-6 w-6" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">{trip.type} · running</p>
              <p className="text-sm text-brand-100">Started {trip.departed} · {Object.values(trip.riders || {}).filter((r) => r.on && !r.off).length} on board</p>
            </div>
            <Button variant="danger" icon={Square} onClick={end}>End trip</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Satellite className={cx('h-5 w-5', sharingThis && !sharing.error ? 'text-emerald-600' : 'text-slate-400')} />
            {sharingThis ? (
              <span className="flex-1">{sharing.error ? <span className="text-accent-600">{sharing.error}</span> : sharing.last ? <>Sharing the bus location · {sharing.sent} update{sharing.sent === 1 ? '' : 's'} sent</> : 'Finding the location…'}</span>
            ) : (
              <>
                <span className="flex-1 text-slate-500">This phone is not sharing the location.</span>
                <Button size="sm" icon={Navigation} onClick={() => startSharing(trip.id)}>Share location from this phone</Button>
              </>
            )}
          </div>
        </Card>
      )}

      {trip && sharing.last && (
        <Card className="mb-6 p-3"><LiveMap buses={[{ id: bus.id, lat: sharing.last.lat, lng: sharing.last.lng, label: bus.regNo, mine: true }]} routes={[route]} height={260} /></Card>
      )}

      <Card>
        <CardHeader title={trip ? (isAttendant ? 'Tick the children' : 'Children on this route') : 'Stops and children'} subtitle={`${riders.length} rider${riders.length === 1 ? '' : 's'} · ${stops.length} stops`} icon={MapPin} />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {trip?.type === 'Afternoon drop-off' && (
            <div className="px-5 py-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-bold"><School className="h-4 w-4 text-accent-600" /> At school — tick each child getting on</p>
            </div>
          )}
          {seq.map((st, i) => (
            <div key={st.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{trip?.type === 'Afternoon drop-off' ? seq.length - i : i + 1}</span>
                <p className="flex-1 font-bold">{st.name}</p>
                <Badge tone="slate">{trip?.type === 'Afternoon drop-off' ? st.pm || '—' : st.am || '—'}</Badge>
                {st.lat == null ? <Button size="sm" variant="soft" icon={MapPin} onClick={() => saveStopHere(st)}>Save location here</Button> : <Badge tone="green">Location saved</Badge>}
              </div>
              <div className="pl-8">{atStop(st.id).map((s) => <ChildRow key={s.id} s={s} />)}{!atStop(st.id).length && <p className="py-1 text-xs text-slate-400">No children at this stop</p>}</div>
            </div>
          ))}
          {noStop.length > 0 && (
            <div className="px-5 py-3">
              <p className="font-bold text-amber-700">No stop set</p>
              <div className="pl-8">{noStop.map((s) => <ChildRow key={s.id} s={s} />)}</div>
            </div>
          )}
          {trip?.type === 'Morning pick-up' && (
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <School className="h-5 w-5 text-accent-600" />
              <p className="flex-1 font-bold">School</p>
              <Button size="sm" icon={CheckCircle2} onClick={allOffAtSchool}>Everyone off at school</Button>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

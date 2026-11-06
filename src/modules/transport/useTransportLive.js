// Running trips with the latest bus position, refreshed every 10 seconds while the screen is open.
// Live apps ask the server (which only returns what the person may see); the demo works it out on the device.
import { useEffect, useState } from 'react';
import { LIVE } from '../../config';
import { supabase } from '../../lib/supabase';
import { useDB } from '../../data/store';
import { useDemoPositions, simulatedPosition } from '../../lib/transport';

export function useTransportLive() {
  const [view, setView] = useState({ trips: [], crew: {}, loaded: false });
  const db = useDB();
  const demoPos = useDemoPositions((s) => s.map);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    supabase.rpc('transport_view').then(({ data }) => alive && data && setView({ trips: data.trips || [], crew: data.crew || {}, loaded: true }));
    return () => { alive = false; };
  }, [tick]);
  if (LIVE) return view;
  const staffBy = new Map(db.staff.map((s) => [s.id, s]));
  const person = (id) => (staffBy.get(id) ? { name: `${staffBy.get(id).title || ''} ${staffBy.get(id).firstName} ${staffBy.get(id).lastName}`.trim(), phone: staffBy.get(id).phone } : null);
  const trips = db.trips
    .filter((t) => t.status === 'Running' && t.startedAt && Date.now() - new Date(t.startedAt).getTime() < 3 * 3600 * 1000)
    .map((t) => ({ trip: t, pos: demoPos[t.id] || simulatedPosition(db.routes.find((r) => r.id === t.routeId), t) }));
  const crew = Object.fromEntries(db.routes.map((r) => {
    const b = db.buses.find((x) => x.id === r.busId);
    return [r.id, { driver: person(b?.driverId), attendant: person(b?.attendantId) }];
  }));
  return { trips, crew, loaded: true, tick };
}

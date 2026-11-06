// School transport helpers: route stops, trips, and sharing the bus location from the crew's phones.
import { create } from 'zustand';
import { LIVE, IS_NATIVE } from '../config';
import { supabase } from './supabase';

/** A route's stops in order. Older routes only had a comma-separated list of names. */
export function stopsOf(route) {
  if (!route) return [];
  if (Array.isArray(route.stopList)) return route.stopList;
  return String(route.stops || '').split(',').map((x) => x.trim()).filter(Boolean).map((name, i) => ({ id: `${route.id}_s${i + 1}`, name, am: i === 0 ? route.departure || '' : '', pm: '', lat: null, lng: null }));
}
export const busOfRoute = (db, route) => (route ? db.buses.find((b) => b.id === route.busId) : null);
export const routeOfBus = (db, bus) => (bus ? db.routes.find((r) => r.busId === bus.id) : null);
export const crewBus = (db, staffId) => db.buses.find((b) => staffId && (b.driverId === staffId || b.attendantId === staffId));

/** Today's running trip for a bus (if any). */
export const runningTrip = (db, busId) => db.trips.find((t) => t.busId === busId && t.status === 'Running');

export function metres(a, b) {
  const R = 6371000;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough minutes to reach a point at the current speed (at least ~22 km/h). */
export const etaMinutes = (pos, stop) => (pos && stop?.lat != null ? Math.max(1, Math.round(metres(pos, stop) / Math.max(pos.speed || 0, 6) / 60)) : null);

// ---------------------------------------------------------------- sharing the bus location
export const useSharing = create(() => ({ tripId: null, last: null, error: null, sent: 0 }));
let watcher = null;
let lastSent = 0;
let lastRaw = null;
let heartbeat = null;
let failedAt = 0;

async function send(tripId, p) {
  lastRaw = p;
  const pos = { lat: p.latitude, lng: p.longitude, speed: p.speed ?? null, heading: p.bearing ?? p.heading ?? null, accuracy: p.accuracy ?? null, at: new Date().toISOString() };
  useSharing.setState({ last: pos });
  if (Date.now() - lastSent < 14000 && !failedAt) return;
  lastSent = Date.now();
  if (!LIVE) {
    // Demo: positions stay on this device.
    useDemoPositions.setState((s) => ({ map: { ...s.map, [tripId]: pos } }));
    useSharing.setState((s) => ({ sent: s.sent + 1 }));
    return;
  }
  const { data, error } = await supabase.rpc('post_position', { trip_id: tripId, lat: pos.lat, lng: pos.lng, speed: pos.speed, heading: pos.heading, accuracy: pos.accuracy });
  if (error) {
    // e.g. the new trip has not reached the server yet, or no signal: try again shortly with the same position.
    failedAt = Date.now();
    useSharing.setState({ error: /not found/i.test(error.message) ? null : 'No connection — retrying…' });
    setTimeout(() => useSharing.getState().tripId === tripId && lastRaw && send(tripId, lastRaw), 5000);
    return;
  }
  failedAt = 0;
  useSharing.setState((s) => ({ sent: s.sent + 1, error: null }));
  if (data?.stop) stopSharing(); // the trip was ended (or is over 3 hours old)
}

/** Starts sending this phone's location for a running trip (keeps going with the screen off on Android). */
export async function startSharing(tripId) {
  await stopSharing();
  useSharing.setState({ tripId, error: null, sent: 0 });
  lastSent = 0;
  const startedAt = Date.now();
  const guard = (p) => {
    if (Date.now() - startedAt > 3 * 3600 * 1000) return stopSharing(); // never longer than 3 hours
    send(tripId, p);
  };
  // A bus standing still gets no new fixes: re-send the last one every 30 s so parents see it is fresh.
  heartbeat = setInterval(() => lastRaw && Date.now() - lastSent > 28000 && guard(lastRaw), 10000);
  if (IS_NATIVE) {
    const { registerPlugin } = await import('@capacitor/core');
    const BG = registerPlugin('BackgroundGeolocation');
    const id = await BG.addWatcher(
      { backgroundMessage: 'EduNexa is sharing the school bus location for this trip.', backgroundTitle: 'Sharing bus location', requestPermissions: true, stale: false, distanceFilter: 25 },
      (loc, err) => {
        if (err) return useSharing.setState({ error: err.code === 'NOT_AUTHORIZED' ? 'Location permission is off — allow it in the phone settings' : err.message });
        if (loc) guard(loc);
      },
    );
    watcher = { native: BG, id };
    return;
  }
  if (!navigator.geolocation) return useSharing.setState({ error: 'This device cannot share its location' });
  const id = navigator.geolocation.watchPosition(
    (g) => guard({ latitude: g.coords.latitude, longitude: g.coords.longitude, speed: g.coords.speed, heading: g.coords.heading, accuracy: g.coords.accuracy }),
    (e) => useSharing.setState({ error: e.code === 1 ? 'Location permission is off — allow it for this site' : 'Could not get the location' }),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
  );
  watcher = { web: id };
}

export async function stopSharing() {
  clearInterval(heartbeat);
  heartbeat = null;
  lastRaw = null;
  failedAt = 0;
  if (watcher?.native) await watcher.native.removeWatcher({ id: watcher.id }).catch(() => {});
  if (watcher?.web != null) navigator.geolocation?.clearWatch(watcher.web);
  watcher = null;
  useSharing.setState({ tripId: null });
}

// Demo: positions shared on this device, and a simulated bus for running trips with no phone sharing.
export const useDemoPositions = create(() => ({ map: {} }));
export function simulatedPosition(route, trip, now = Date.now()) {
  const stops = stopsOf(route).filter((s) => s.lat != null);
  if (stops.length < 2 || !trip?.startedAt) return null;
  const seq = trip.type === 'Afternoon drop-off' ? [...stops].reverse() : stops;
  const t = (now - new Date(trip.startedAt).getTime()) / 1000 / 240; // a stop every 4 minutes
  const i = Math.min(seq.length - 2, Math.max(0, Math.floor(t)));
  const f = Math.min(1, Math.max(0, t - i));
  const a = seq[i];
  const b = seq[i + 1];
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, speed: 7, at: new Date(now).toISOString(), simulated: true };
}

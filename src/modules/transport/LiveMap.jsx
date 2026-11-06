// Map of school buses (OpenStreetMap, no fees). Shows each running bus, the route's stops, and a highlighted stop.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { stopsOf } from '../../lib/transport';

const busIcon = (label, mine) =>
  L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
      <div style="width:36px;height:36px;border-radius:9999px;background:${mine ? '#dc2626' : '#1d43d8'};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></div>
      <div style="margin-top:2px;padding:1px 6px;border-radius:6px;background:white;font:600 10px system-ui;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</div></div>`,
  });
const stopIcon = (n, mine) =>
  L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${mine ? '#16a34a' : 'white'};border:2px solid ${mine ? 'white' : '#1d43d8'};color:${mine ? 'white' : '#1d43d8'};font:700 10px system-ui;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">${n}</div>`,
  });

/**
 * buses: [{ id, lat, lng, label, mine }]; routes: route records whose stops to draw; myStopId: the family's stop.
 */
export default function LiveMap({ buses = [], routes = [], myStopId, height = 360, follow = true }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);
  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([5.6037, -0.187], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);
  useEffect(() => {
    const g = layer.current;
    g.clearLayers();
    const pts = [];
    routes.forEach((r) => {
      const stops = stopsOf(r).filter((s) => s.lat != null);
      if (stops.length > 1) L.polyline(stops.map((s) => [s.lat, s.lng]), { color: '#1d43d8', weight: 3, opacity: 0.35, dashArray: '6 6' }).addTo(g);
      stops.forEach((s, i) => {
        L.marker([s.lat, s.lng], { icon: stopIcon(i + 1, s.id === myStopId), zIndexOffset: s.id === myStopId ? 500 : 0 }).bindTooltip(`${s.name}${s.am ? ` · pick-up ${s.am}` : ''}${s.pm ? ` · drop-off ${s.pm}` : ''}`).addTo(g);
        pts.push([s.lat, s.lng]);
      });
    });
    buses.forEach((b) => {
      if (b.lat == null) return;
      L.marker([b.lat, b.lng], { icon: busIcon(b.label, b.mine), zIndexOffset: 1000 }).addTo(g);
      pts.push([b.lat, b.lng]);
    });
    if (!pts.length) return;
    if (!fitted.current || !follow) {
      map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
      fitted.current = true;
    } else if (buses.length === 1 && buses[0].lat != null) {
      map.current.panTo([buses[0].lat, buses[0].lng], { animate: true });
    }
  }, [buses, routes, myStopId, follow]);
  return <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-2xl" />;
}

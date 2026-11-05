import { LIVE } from '../config';
// Offline & slow-network support: connectivity state, queued outbound messages,
// durable storage and the "install app" prompt.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useDB } from './store';
import { nowISO } from '../lib/format';

const conn = () => (typeof navigator !== 'undefined' ? navigator.connection || navigator.mozConnection || navigator.webkitConnection : null);

export function networkInfo() {
  const c = conn();
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const effectiveType = c?.effectiveType || 'unknown';
  const saveData = !!c?.saveData;
  const slow = saveData || ['slow-2g', '2g', '3g'].includes(effectiveType) || (c?.downlink != null && c.downlink > 0 && c.downlink < 1.5);
  return { online, effectiveType, saveData, slow, downlink: c?.downlink };
}

export function useNetwork() {
  const [info, setInfo] = useState(networkInfo);
  useEffect(() => {
    const update = () => setInfo(networkInfo());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    conn()?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      conn()?.removeEventListener?.('change', update);
    };
  }, []);
  return info;
}

export const useInstall = create(() => ({ prompt: null, installed: false, persisted: null }));

/** Sends anything queued while offline. Returns how many items were sent. */
export function flushQueue() {
  if (LIVE) return 0; // the live apps send queued texts through sync.js
  const db = useDB.getState();
  const queued = db.smsLog.filter((m) => m.status === 'Queued');
  queued.forEach((m) => db.update('smsLog', m.id, { status: 'Delivered', sentAt: nowISO() }));
  return queued.length;
}

let started = false;
export function startOfflineServices(onFlush) {
  if (started) return;
  started = true;
  window.addEventListener('online', () => {
    const n = flushQueue();
    onFlush?.(n);
  });
  if (navigator.onLine) flushQueue();
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }));
  if (window.matchMedia?.('(display-mode: standalone)').matches) useInstall.setState({ installed: true });
  // Ask the browser not to clear offline data when the device is short of space.
  navigator.storage?.persisted?.().then((p) => {
    if (p) return useInstall.setState({ persisted: true });
    return navigator.storage.persist?.().then((ok) => useInstall.setState({ persisted: !!ok }));
  });
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage || 0, quota: e.quota || 0 } : null;
  } catch {
    return null;
  }
}

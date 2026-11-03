import { WifiOff, Gauge } from 'lucide-react';
import { useNetwork } from '../data/offline';
import { useDB } from '../data/store';

/** Full-width notice while offline. */
export function OfflineBanner() {
  const { online } = useNetwork();
  const queued = useDB((s) => s.smsLog.filter((m) => m.status === 'Queued').length);
  const appName = useDB((s) => s.settings.appName) || 'EduNexa';
  if (online) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-navy-950 sm:text-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — {appName} keeps working and saves your changes on this device.{queued ? ` ${queued} text message(s) will send when you reconnect.` : ' Messages will send when you reconnect.'}</span>
    </div>
  );
}

/** Small top-bar chip when the connection is slow. */
export function SlowChip() {
  const { online, slow, effectiveType, saveData } = useNetwork();
  if (!online || !slow) return null;
  return (
    <span title="Images are compressed and live video uses less data" className="hidden items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 md:flex">
      <Gauge className="h-3.5 w-3.5" /> {saveData ? 'Data saver' : `Slow connection (${effectiveType})`}
    </span>
  );
}

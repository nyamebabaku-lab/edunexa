// The signed-in person's notifications (the same ones that arrive as phone push notifications).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, UserCheck, DoorOpen, Wallet, Award, MonitorPlay, Video, Megaphone, CalendarX, BellRing } from 'lucide-react';
import { useLive, markNotificationsRead } from '../../data/sync';
import { PUSH_READY } from '../../lib/push';
import { IS_NATIVE, APK_URL, ADMIN_APK_URL, ADMIN_APP } from '../../config';
import { fmtDateTime } from '../../lib/format';
import { Card, EmptyState, PageHeader, cx } from '../../components/ui';

const ICON = { message: MessageSquare, notice: Megaphone, approval: UserCheck, account: UserCheck, gate: DoorOpen, absent: CalendarX, fees: Wallet, results: Award, lms: MonitorPlay, live: Video };

export default function Notifications() {
  const list = useLive((s) => s.notifications);
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => markNotificationsRead().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [list.length]);
  return (
    <>
      <PageHeader title="Notifications" subtitle="Messages, approvals, attendance, fees, results and classes" />
      {!IS_NATIVE && (
        <Card className="mb-5 flex items-center gap-3 p-4 text-sm">
          <BellRing className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="flex-1 text-slate-600 dark:text-slate-300">Get these as phone notifications: install the <a className="font-semibold text-brand-600 hover:underline" href={ADMIN_APP ? ADMIN_APK_URL : APK_URL}>Android app</a>.</p>
        </Card>
      )}
      {IS_NATIVE && !PUSH_READY && <p className="mb-4 text-xs text-slate-500">Phone notifications are being set up for this app version — they appear here meanwhile.</p>}
      <Card className="divide-y divide-slate-100 dark:divide-white/5">
        {list.length === 0 && <EmptyState icon={Bell} title="No notifications yet" text="You'll see new messages, approvals, gate arrivals, fees and results here." />}
        {list.map((n) => {
          const Icon = ICON[n.kind] || Bell;
          return (
            <button key={n.id} onClick={() => n.link && navigate(n.link)} className={cx('flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5', !n.read_at && 'bg-brand-50/50 dark:bg-brand-500/10')}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
                {n.body && <span className="mt-0.5 block text-sm text-slate-500">{n.body}</span>}
                <span className="mt-1 block text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-600" />}
            </button>
          );
        })}
      </Card>
    </>
  );
}

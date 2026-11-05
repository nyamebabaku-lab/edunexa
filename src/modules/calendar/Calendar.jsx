import { useState } from 'react';
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, TODAY } from '../../data/selectors';
import { fmtDate } from '../../lib/format';
import { Card, CardHeader, PageHeader, Button, IconButton, Badge, FormModal, toast, cx } from '../../components/ui';

const TYPE_TONE = { Academic: 'blue', Holiday: 'red', Meeting: 'violet', Sports: 'green', Event: 'amber', Finance: 'teal', Staff: 'slate' };
const DOT = { Academic: 'bg-brand-600', Holiday: 'bg-accent-600', Meeting: 'bg-violet-500', Sports: 'bg-emerald-500', Event: 'bg-amber-500', Finance: 'bg-teal-500', Staff: 'bg-slate-400' };

export default function CalendarPage() {
  const db = useDB();
  const user = useCurrentUser();
  const [month, setMonth] = useState(startOfMonth(parseISO(TODAY)));
  const [form, setForm] = useState(null);
  const isAdmin = (user.role === 'admin' || user.role === 'headteacher');
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const byDate = (d) => db.events.filter((e) => e.date === format(d, 'yyyy-MM-dd'));
  const upcoming = db.events.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader title="School Calendar" subtitle="Term dates, exams, holidays, meetings and events"
        actions={isAdmin && <Button icon={Plus} onClick={() => setForm({ date: TODAY, type: 'Event' })}>Add event</Button>} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">{format(month, 'MMMM yyyy')}</p>
            <div className="flex items-center gap-1">
              <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth(addMonths(month, -1))} />
              <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(parseISO(TODAY)))}>Today</Button>
              <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth(addMonths(month, 1))} />
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-semibold uppercase text-slate-400 dark:border-white/5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const evs = byDate(d);
              const isToday = format(d, 'yyyy-MM-dd') === TODAY;
              return (
                <div key={d.toISOString()} onClick={() => isAdmin && setForm({ date: format(d, 'yyyy-MM-dd'), type: 'Event' })}
                  className={cx('min-h-[72px] border-b border-r border-slate-100 p-1.5 dark:border-white/5 sm:min-h-[104px]', !isSameMonth(d, month) && 'bg-slate-50/60 text-slate-300 dark:bg-white/[.02] dark:text-slate-600', isAdmin && 'cursor-pointer hover:bg-brand-50/40')}>
                  <span className={cx('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold', isToday && 'bg-accent-600 text-white')}>{format(d, 'd')}</span>
                  <div className="mt-1 space-y-1">
                    {evs.map((e) => (
                      <div key={e.id} title={e.title} className="flex items-center gap-1 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">
                        <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[e.type])} />
                        <span className="hidden truncate sm:inline">{e.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Coming up" />
          <div className="space-y-1 p-3">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
                  <span className="text-[10px] font-bold uppercase text-accent-600">{fmtDate(e.date, 'MMM')}</span>
                  <span className="text-base font-extrabold leading-none text-brand-700 dark:text-brand-300">{fmtDate(e.date, 'd')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="text-xs text-slate-500">{fmtDate(e.date, 'EEEE')}</p>
                </div>
                <Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <FormModal open={!!form} onClose={() => setForm(null)} title="Add event" initial={form} size="md"
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2 },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'Type', type: 'select', options: Object.keys(TYPE_TONE) },
          { name: 'description', label: 'Details', type: 'textarea' },
        ]}
        onSubmit={(v) => { db.add('events', v); toast.success('Event added'); setForm(null); }}
      />
    </>
  );
}

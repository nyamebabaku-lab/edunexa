// Terms of the academic year: add, rename, change dates, delete and choose the current term.
// The length of each term (weeks) and the holiday before the next one are worked out from the dates.
import { useState } from 'react';
import { Plus, Pencil, Trash2, CalendarRange, CheckCircle2, CalendarPlus, Sun } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { fmtDate, uid } from '../../lib/format';
import { parseTerm } from '../../lib/importer';
import { Card, CardHeader, Badge, Button, IconButton, FormModal, EmptyState, toast, confirmDialog, cx } from '../../components/ui';

const DAY = 86400000;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

/** "13 weeks" / "12 weeks 3 days" from the start and end dates (both days count). */
export function termLength(t) {
  if (!t?.start || !t?.end) return '—';
  const d = days(t.start, t.end) + 1;
  if (d <= 0) return 'End is before start';
  return dayText(d);
}

export function dayText(d) {
  const w = Math.floor(d / 7);
  const r = d % 7;
  return [w && `${w} week${w === 1 ? '' : 's'}`, r && `${r} day${r === 1 ? '' : 's'}`].filter(Boolean).join(' ');
}

const sortTerms = (terms) => [...terms].sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
const shiftYear = (iso, n = 1) => (iso ? `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}` : '');

export default function TermsEditor({ compact = false }) {
  const terms = useDB((s) => s.terms);
  const settings = useDB((s) => s.settings);
  const db = useDB.getState;
  const user = useCurrentUser();
  const canEdit = ['admin', 'headteacher', 'superadmin'].includes(user?.role);
  const canSetCurrent = ['admin', 'superadmin'].includes(user?.role);
  const [form, setForm] = useState(null);
  const list = sortTerms(terms);

  const usage = (id) => {
    const s = db();
    const n = (col) => (s[col] || []).filter((r) => r.termId === id).length;
    return { bills: n('invoices'), scores: n('scores') };
  };

  const save = (v) => {
    if (v.end < v.start) return toast.error('Check the dates', 'The term must end after it starts');
    const clash = list.find((t) => t.id !== v.id && t.start && t.end && v.start <= t.end && v.end >= t.start);
    if (v.id) {
      db().update('terms', v.id, { name: v.name.trim(), start: v.start, end: v.end });
      toast.success('Term updated', `${v.name} · ${termLength(v)}`);
    } else {
      const guess = parseTerm(v.name)?.id;
      const id = guess && !terms.some((t) => t.id === guess) ? guess : uid('term');
      db().add('terms', { id, name: v.name.trim(), start: v.start, end: v.end });
      if (!settings.currentTerm && canSetCurrent) db().updateSettings({ currentTerm: id });
      toast.success('Term added', `${v.name} · ${termLength(v)}`);
    }
    if (clash) toast.info('Dates overlap', `${v.name} overlaps ${clash.name} — check the dates`);
    setForm(null);
  };

  const del = async (t) => {
    if (t.id === settings.currentTerm) return toast.error('This is the current term', 'Choose another current term first, then delete this one');
    const u = usage(t.id);
    const used = [u.bills && `${u.bills} fee bill${u.bills === 1 ? '' : 's'}`, u.scores && `${u.scores} score${u.scores === 1 ? '' : 's'}`].filter(Boolean);
    const ok = await confirmDialog(`Delete ${t.name}?`, used.length ? `${used.join(' and ')} belong to this term. They are kept but will show no term name.` : 'This cannot be undone.', { confirmLabel: 'Delete term' });
    if (!ok) return;
    db().remove('terms', t.id);
    toast.success('Term deleted');
  };

  const makeCurrent = (t) => {
    db().updateSettings({ currentTerm: t.id, ...(parseTerm(t.id)?.yr || parseTerm(t.name)?.yr ? { academicYear: parseTerm(t.id)?.yr || parseTerm(t.name)?.yr } : {}) });
    toast.success('Current term changed', `${t.name} — new bills, scores and reports use this term`);
  };

  /** Next academic year: the last three terms moved on by one year. */
  const nextYear = async () => {
    const last = list.slice(-3);
    if (!last.length) return;
    const yrOf = (t) => parseTerm(t.id)?.yr || parseTerm(t.name)?.yr;
    const yr = yrOf(last[last.length - 1]);
    const ny = yr ? `${Number(yr.slice(0, 4)) + 1}/${Number(yr.slice(5)) + 1}` : null;
    const fresh = last.map((t, i) => {
      const n = parseTerm(t.id)?.n || parseTerm(t.name)?.n || i + 1;
      const id = ny ? `${ny}-T${n}` : uid('term');
      return { id, name: ny ? `Term ${n}, ${ny}` : `${t.name} (next year)`, start: shiftYear(t.start), end: shiftYear(t.end) };
    }).filter((t) => !terms.some((x) => x.id === t.id));
    if (!fresh.length) return toast.info('Already added', 'Next year\'s terms are already in the list');
    if (!(await confirmDialog(`Add ${ny || 'next year'}?`, `${fresh.map((t) => `${t.name}: ${fmtDate(t.start)} – ${fmtDate(t.end)}`).join(' · ')}. You can change the dates afterwards.`, { danger: false, confirmLabel: 'Add terms' }))) return;
    db().addMany('terms', fresh);
    toast.success(`${fresh.length} terms added`, ny || '');
  };

  const nextName = () => {
    const last = list[list.length - 1];
    const p = last && (parseTerm(last.id) || parseTerm(last.name));
    if (!p) return `Term 1, ${settings.academicYear || ''}`.trim();
    if (p.n < 3) return `Term ${p.n + 1}, ${p.yr}`;
    return `Term 1, ${Number(p.yr.slice(0, 4)) + 1}/${Number(p.yr.slice(5)) + 1}`;
  };
  const nextStart = () => {
    const last = list[list.length - 1];
    if (!last?.end) return '';
    const d = new Date(new Date(last.end).getTime() + 21 * DAY);
    return d.toISOString().slice(0, 10);
  };

  return (
    <Card>
      <CardHeader
        title="Terms & term dates"
        subtitle={compact ? undefined : 'Add each term with its first and last day. The length is worked out for you.'}
        icon={CalendarRange}
        action={canEdit && (
          <div className="flex flex-wrap gap-2">
            {list.length >= 3 && <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={nextYear}>Next year</Button>}
            <Button size="sm" icon={Plus} onClick={() => setForm({ name: nextName(), start: nextStart(), end: '' })}>Add term</Button>
          </div>
        )}
      />
      {!list.length ? (
        <EmptyState icon={CalendarRange} title="No terms yet" text="Add your first term with its start and end dates." action={canEdit && <Button icon={Plus} onClick={() => setForm({ name: nextName(), start: '', end: '' })}>Add term</Button>} />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {list.map((t, i) => {
            const next = list[i + 1];
            const gap = next?.start && t.end ? days(t.end, next.start) - 1 : null;
            const current = t.id === settings.currentTerm;
            return (
              <div key={t.id}>
                <div className={cx('flex flex-wrap items-center gap-3 px-5 py-3.5', current && 'bg-emerald-50/50 dark:bg-emerald-500/5')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</p>
                      {current && <Badge tone="green" dot>Current</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{t.start ? fmtDate(t.start, 'EEE d MMM yyyy') : '—'} → {t.end ? fmtDate(t.end, 'EEE d MMM yyyy') : '—'}</p>
                  </div>
                  <Badge tone="blue">{termLength(t)}</Badge>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {!current && canSetCurrent && <Button size="sm" variant="ghost" icon={CheckCircle2} onClick={() => makeCurrent(t)}>Make current</Button>}
                      <IconButton icon={Pencil} label="Edit term" onClick={() => setForm(t)} />
                      <IconButton icon={Trash2} label="Delete term" className="hover:!bg-accent-50 hover:!text-accent-600" onClick={() => del(t)} />
                    </div>
                  )}
                </div>
                {gap !== null && gap > 0 && (
                  <p className="flex items-center gap-1.5 bg-slate-50/70 px-5 py-1.5 text-[11px] font-medium text-slate-400 dark:bg-white/[.02]"><Sun className="h-3 w-3" /> Holiday: {dayText(gap)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <FormModal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit term' : 'Add term'}
        subtitle="Choose the first and last day of the term"
        initial={form}
        onSubmit={save}
        size="md"
        fields={[
          { name: 'name', label: 'Term name', required: true, span: 2, placeholder: 'e.g. Term 1, 2026/2027' },
          { name: 'start', label: 'First day (reopening)', type: 'date', required: true },
          { name: 'end', label: 'Last day (vacation)', type: 'date', required: true },
          { name: '_len', label: 'Term length', type: 'custom', span: 2, render: (v) => <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">{v.start && v.end ? termLength(v) : 'Pick both dates'}</p> },
        ]}
      />
    </Card>
  );
}

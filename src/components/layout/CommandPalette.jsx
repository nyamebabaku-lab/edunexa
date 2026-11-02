import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, GraduationCap, BriefcaseBusiness, CornerDownLeft } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useLookups } from '../../data/selectors';
import { navFor, canAccess } from '../../lib/permissions';
import { fullName } from '../../lib/format';
import { cx } from '../ui';

export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const user = useCurrentUser();
  const students = useDB((s) => s.students);
  const staff = useDB((s) => s.staff);
  const L = useLookups();
  const modules = useDB((s) => s.settings.modules);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!user) return [];
    const needle = q.toLowerCase().trim();
    const pages = navFor(user.role, modules)
      .flatMap((g) => g.items)
      .filter((i) => !needle || i.label.toLowerCase().includes(needle))
      .map((i) => ({ id: i.key, label: i.label, sub: 'Go to page', icon: i.icon, to: i.path }));
    if (!needle) return pages.slice(0, 8);
    const out = [...pages];
    if (canAccess(user.role, 'students')) {
      students
        .filter((s) => `${fullName(s)} ${s.admissionNo}`.toLowerCase().includes(needle))
        .slice(0, 6)
        .forEach((s) => out.push({ id: s.id, label: fullName(s), sub: `${s.admissionNo} · ${L.className(s.classId)}`, icon: GraduationCap, to: `/students/${s.id}` }));
    }
    if (canAccess(user.role, 'staff')) {
      staff
        .filter((s) => `${s.firstName} ${s.lastName} ${s.role}`.toLowerCase().includes(needle))
        .slice(0, 5)
        .forEach((s) => out.push({ id: s.id, label: `${s.title} ${s.firstName} ${s.lastName}`, sub: s.role, icon: BriefcaseBusiness, to: `/staff/${s.id}` }));
    }
    return out.slice(0, 12);
  }, [q, user, students, staff, L, modules]);

  if (!open) return null;
  const go = (r) => {
    navigate(r.to);
    onClose();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && results[idx]) go(results[idx]);
    else if (e.key === 'Escape') onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-navy-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 dark:border-white/5">
          <Search className="h-5 w-5 text-brand-600" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={onKey}
            placeholder="Search students, staff or pages…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="rounded-md border border-slate-200 px-1.5 text-[10px] font-semibold text-slate-400 dark:border-white/10">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No matches for “{q}”.</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(r)}
              className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === idx ? 'bg-brand-50 dark:bg-brand-500/15' : '')}
            >
              <div className={cx('flex h-9 w-9 items-center justify-center rounded-xl', i === idx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5')}>
                <r.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{r.label}</p>
                <p className="truncate text-xs text-slate-500">{r.sub}</p>
              </div>
              {i === idx && <CornerDownLeft className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useId } from 'react';
import { useDB } from '../../data/store';
import { cx } from '../ui';

export function LogoMark({ className = 'h-10 w-10' }) {
  const gid = `lg-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'rgb(var(--brand-700))' }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--brand-500))' }} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${gid})`} />
      <path d="M18 42 L50 27 L82 42 L50 57 Z" fill="#fff" />
      <path d="M30 50 V62 Q50 72 70 62 V50 L50 59 Z" fill="#fff" />
      <rect x="73.5" y="42" width="3" height="24" style={{ fill: 'rgb(var(--accent-600))' }} />
      <circle cx="75" cy="68" r="3.5" style={{ fill: 'rgb(var(--accent-600))' }} />
    </svg>
  );
}

/** The school's uploaded logo, or the default mark. */
export function SchoolLogo({ className = 'h-10 w-10' }) {
  const logo = useDB((s) => s.settings.logo);
  if (logo) return <img src={logo} alt="" className={cx('rounded-xl bg-white object-contain p-0.5', className)} />;
  return <LogoMark className={className} />;
}

/** Splits "EduNexa" into "Edu" + "Nexa" for the two-tone wordmark. */
function splitName(name) {
  const m = /^([A-Z][a-z]+)([A-Z].*)$/.exec(name);
  if (m) return [m[1], m[2]];
  const parts = name.split(' ');
  return parts.length > 1 ? [`${parts.slice(0, -1).join(' ')} `, parts[parts.length - 1]] : [name, ''];
}

export default function Logo({ compact, dark }) {
  const appName = useDB((s) => s.settings.appName) || 'EduNexa';
  const tagline = useDB((s) => s.settings.tagline) || 'School Suite';
  const [a, b] = splitName(appName);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <SchoolLogo className="h-9 w-9 shrink-0" />
      {!compact && (
        <div className="min-w-0 leading-none">
          <p className={cx('truncate text-lg font-extrabold tracking-tight', dark ? 'text-white' : 'text-slate-900 dark:text-white')}>
            {a}<span className="text-accent-500">{b}</span>
          </p>
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{tagline}</p>
        </div>
      )}
    </div>
  );
}

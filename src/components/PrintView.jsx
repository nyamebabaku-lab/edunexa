import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useDB } from '../data/store';
import { Button } from './ui';
import { SchoolLogo } from './layout/Logo';

/** Full-screen printable document. Hides the app when printing. */
export default function PrintView({ open, onClose, title, children, actions }) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('has-print');
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => {
      document.body.classList.remove('has-print');
      window.removeEventListener('keydown', h);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="print-overlay fixed inset-0 z-[55] overflow-y-auto bg-slate-200/90 backdrop-blur-sm dark:bg-navy-950/95 print:static print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
        <p className="flex-1 truncate font-bold text-slate-800 dark:text-white">{title}</p>
        {actions}
        <Button icon={Printer} onClick={() => window.print()}>
          Print / PDF
        </Button>
        <Button variant="secondary" icon={X} onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mx-auto my-6 max-w-[820px] px-3 print:m-0 print:max-w-none print:p-0">{children}</div>
    </div>,
    document.body,
  );
}

export function Paper({ children, className = '' }) {
  return <div className={`print-area mb-6 break-after-page rounded-lg bg-white p-8 text-slate-800 shadow-xl sm:p-10 ${className}`}>{children}</div>;
}

export function Letterhead({ title, right }) {
  const s = useDB((x) => x.settings);
  return (
    <div className="mb-6 flex items-start justify-between gap-6 border-b-4 border-brand-700 pb-5">
      <div className="flex items-center gap-4">
        <SchoolLogo className="h-16 w-16" />
        <div>
          <p className="text-xl font-extrabold uppercase tracking-tight text-brand-800">{s.schoolName}</p>
          <p className="text-xs italic text-accent-700">{s.motto}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {s.address} · {s.phone} · {s.email}
          </p>
        </div>
      </div>
      <div className="text-right">
        {title && <p className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">{title}</p>}
        {right}
      </div>
    </div>
  );
}

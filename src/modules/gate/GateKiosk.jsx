import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, QrCode, ScanLine, LogIn, LogOut, Maximize } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, TODAY } from '../../data/selectors';
import { gateToken, gateCode, slotNow, parseBadge, clock } from '../../lib/gate';
import { QRCode, QRScanner } from '../../components/QR';
import { SchoolLogo } from '../../components/layout/Logo';
import { cx, Avatar } from '../../components/ui';
import { useCurrentUser } from '../../data/selectors';
import { signOut } from '../../data/sync';
import { photoKey, usePhoto } from '../../data/photos';

/** Full-screen display for a tablet or TV at the school entrance. */
export default function GateKiosk() {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const kioskAccount = useCurrentUser()?.role === 'kiosk';
  const gate = db.settings.gate;
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState('display');
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const slot = slotNow(gate.rotateSeconds);
  const token = useMemo(() => gateToken(gate, slot), [gate, slot]);
  const code = useMemo(() => gateCode(gate, slot), [gate, slot]);
  const left = gate.rotateSeconds - (Math.floor(now / 1000) % gate.rotateSeconds);

  const todays = db.clockings.filter((c) => c.date === TODAY);
  const recent = [...todays].sort((a, b) => (b.out || b.in).localeCompare(a.out || a.in)).slice(0, 7);
  const nameOf = (c) => (c.personType === 'Student' ? L.studentName(c.personId) : L.staffName(c.personId));

  const onBadge = (text) => {
    const b = parseBadge(text);
    const r = b ? clock(b.personType, b.personId, 'ID card') : { action: 'invalid' };
    setFlash(r);
    setTimeout(() => setFlash(null), 3000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950 text-white">
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-3xl" />
      <div className="absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-accent-600/20 blur-3xl" />

      <header className="relative flex items-center gap-4 px-6 py-5 sm:px-10">
        <SchoolLogo className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold sm:text-xl">{db.settings.schoolName}</p>
          <p className="text-sm text-slate-400">{gate.name} · Attendance kiosk</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-3xl font-extrabold tabular-nums">{format(now, 'HH:mm:ss')}</p>
          <p className="text-sm text-slate-400">{format(now, 'EEEE d MMMM')}</p>
        </div>
      </header>

      <main className="relative grid gap-8 px-6 pb-24 sm:px-10 lg:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col items-center justify-center rounded-[2rem] bg-white/5 p-6 ring-1 ring-white/10 sm:p-10">
          <div className="mb-6 inline-flex rounded-2xl bg-white/10 p-1">
            {[['display', 'Show gate QR', QrCode], ['scan', 'Scan ID badges', ScanLine]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setMode(k)} className={cx('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition', mode === k ? 'bg-white text-brand-800' : 'text-slate-300 hover:text-white')}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          {mode === 'display' ? (
            <>
              <p className="text-center text-2xl font-extrabold sm:text-3xl">Scan to clock in or out</p>
              <p className="mt-2 text-center text-slate-400">Open {db.settings.appName} on your phone → <b className="text-white">Clock in / out</b> → scan this code</p>
              <div className="mt-8 rounded-[1.75rem] bg-white p-5 shadow-2xl shadow-brand-900/50">
                <QRCode value={token} size={300} className="!h-auto max-w-[68vw]" />
              </div>
              <div className="mt-6 flex items-center gap-4">
                <div className="relative h-12 w-12">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(var(--accent-500))" strokeWidth="3" strokeDasharray={`${(left / gate.rotateSeconds) * 97.4} 97.4`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{left}</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Or enter code</p>
                  <p className="font-mono text-3xl font-extrabold tracking-[.3em]">{code}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-2xl font-extrabold">Hold your ID badge up to the camera</p>
              <p className="mt-2 text-center text-slate-400">For pupils and staff without a phone</p>
              <QRScanner onResult={onBadge} facingMode="user" className="mt-6 aspect-square w-full max-w-md" />
            </>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Students in', todays.filter((c) => c.personType === 'Student').length],
              ['Staff in', todays.filter((c) => c.personType === 'Staff').length],
              ['Late today', todays.filter((c) => c.late).length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-3xl font-extrabold tabular-nums">{v}</p>
                <p className="text-xs text-slate-400">{k}</p>
              </div>
            ))}
          </div>
          <div className="flex-1 rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Latest</p>
            <div className="space-y-2">
              {recent.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <div className="relative">
                    <Avatar name={nameOf(c)} photo={photoKey(c.personType, c.personId)} size="md" className="!ring-0" />
                    <span className={cx('absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-navy-950', c.out ? 'bg-slate-500' : c.late ? 'bg-amber-500' : 'bg-emerald-500')}>
                      {c.out ? <LogOut className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{nameOf(c)}</p>
                    <p className="text-xs text-slate-400">{c.personType === 'Student' ? L.studentClass(c.personId)?.name : L.staff(c.personId)?.role} · {c.out ? 'left' : 'arrived'}{c.late && !c.out ? ' late' : ''}</p>
                  </div>
                  <span className="font-mono text-lg font-bold">{c.out || c.in}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {flash && (
        <div className={cx('fixed inset-0 z-50 flex flex-col items-center justify-center text-center', flash.action === 'in' ? (flash.late ? 'bg-amber-500' : 'bg-emerald-600') : flash.action === 'out' ? 'bg-brand-700' : 'bg-accent-700')}>
          <p className="text-6xl font-extrabold">{flash.action === 'in' ? 'Welcome!' : flash.action === 'out' ? 'Goodbye!' : flash.action === 'repeat' || flash.action === 'done' ? 'Already recorded' : 'Not recognised'}</p>
          {flash.record && <FlashPortrait flash={flash} />}
          {flash.name && <p className="mt-4 text-3xl font-bold">{flash.name}</p>}
          {flash.record && <p className="mt-2 text-xl opacity-90">{flash.action === 'out' ? `Out ${flash.record.out}` : `In ${flash.record.in}`}{flash.late ? ' · late' : ''}</p>}
        </div>
      )}

      <div className="fixed bottom-4 left-4 flex gap-2">
        <button onClick={() => (kioskAccount ? window.confirm('Sign this kiosk out?') && signOut() : navigate('/gate'))} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20"><ArrowLeft className="h-4 w-4" /> {kioskAccount ? 'Sign out' : 'Exit kiosk'}</button>
        <button onClick={() => document.documentElement.requestFullscreen?.()} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/20"><Maximize className="h-4 w-4" /> Full screen</button>
      </div>
    </div>
  );
}

/** Large photo on the scan confirmation so the guard can check the face matches. */
function FlashPortrait({ flash }) {
  const img = usePhoto(photoKey(flash.record.personType, flash.record.personId));
  return img ? <img src={img} alt={flash.name} className="mt-8 h-48 w-48 rounded-[2rem] object-cover shadow-2xl ring-8 ring-white/25" /> : null;
}

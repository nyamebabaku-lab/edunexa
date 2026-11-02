import { useMemo, useState } from 'react';
import { ScanLine, LogIn, LogOut, KeyRound, Clock, CheckCircle2, AlertTriangle, QrCode, Timer } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, TODAY } from '../../data/selectors';
import { fmtDate, pct, fullName } from '../../lib/format';
import { verifyGate, clock, personForUser, badgeToken } from '../../lib/gate';
import { Card, CardHeader, PageHeader, Button, Badge, StatCard, Modal, Input, DataTable, EmptyState, toast, cx } from '../../components/ui';
import { QRScanner, QRCode } from '../../components/QR';

export function ClockResult({ result, onClose }) {
  if (!result) return null;
  const ok = result.action === 'in' || result.action === 'out';
  const msg = {
    in: result.late ? `Clocked in at ${result.record.in} — marked late` : `Clocked in at ${result.record.in}`,
    out: `Clocked out at ${result.record.out}. See you tomorrow!`,
    repeat: `Already clocked in at ${result.record?.in}. Scan again when you leave.`,
    done: `You already clocked out today at ${result.record?.out}.`,
    unknown: 'This person is not registered at the school.',
    invalid: result.reason,
  }[result.action];
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className={cx('flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl', ok ? (result.late ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-accent-600')}>
        {ok ? (result.action === 'in' ? <LogIn className="h-9 w-9" /> : <LogOut className="h-9 w-9" />) : <AlertTriangle className="h-9 w-9" />}
      </div>
      <p className="mt-5 text-2xl font-extrabold text-slate-900 dark:text-white">
        {{ in: `Welcome, ${result.name?.split(' ')[0]}!`, out: `Goodbye, ${result.name?.split(' ')[0]}!`, repeat: 'Already recorded', done: 'Already recorded' }[result.action] || 'Not recorded'}
      </p>
      <p className="mt-2 max-w-sm text-slate-500">{msg}</p>
      {onClose && <Button className="mt-6" onClick={onClose}>Done</Button>}
    </div>
  );
}

export default function ClockIn() {
  const db = useDB();
  const user = useCurrentUser();
  const person = personForUser(user);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [badge, setBadge] = useState(false);
  const gate = db.settings.gate;

  const mine = useMemo(() => (person ? db.clockings.filter((c) => c.personType === person.personType && c.personId === person.personId).sort((a, b) => b.date.localeCompare(a.date)) : []), [db.clockings, person]);
  if (!person) return <Card><EmptyState icon={ScanLine} title="Clock-in is not available for this account" /></Card>;

  const today = mine.find((c) => c.date === TODAY);
  const personRec = person.personType === 'Student' ? db.students.find((s) => s.id === person.personId) : db.staff.find((s) => s.id === person.personId);
  const isBoarder = person.personType === 'Student' && personRec?.boarding === 'Boarder';

  const handle = (text) => {
    const v = verifyGate(text, gate);
    if (!v.ok) {
      setResult({ action: 'invalid', reason: v.reason });
      setScan(false);
      return;
    }
    const r = clock(person.personType, person.personId, text.length === 6 ? 'Gate code' : 'Gate QR');
    setResult(r);
    setScan(false);
    setCode('');
    if (r.action === 'in' || r.action === 'out') toast.success(r.action === 'in' ? 'Clocked in' : 'Clocked out', `${gate.name} · ${r.action === 'in' ? r.record.in : r.record.out}`);
  };

  const past = mine.filter((c) => c.date !== TODAY);
  const onTime = past.filter((c) => !c.late).length;
  const avgIn = past.length ? Math.round(past.reduce((a, c) => a + Number(c.in.slice(0, 2)) * 60 + Number(c.in.slice(3)), 0) / past.length) : null;

  return (
    <>
      <PageHeader title="Clock in / out" subtitle={`Scan the QR code on the ${gate.name} screen when you arrive and when you leave`} actions={<Button variant="secondary" icon={QrCode} onClick={() => setBadge(true)}>My ID badge</Button>} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold text-brand-100">{fmtDate(TODAY, 'EEEE, d MMMM yyyy')}</p>
            <p className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {!today ? 'You have not clocked in yet' : today.out ? `Clocked out at ${today.out}` : `On campus since ${today.in}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {today && <Badge tone={today.late ? 'amber' : 'green'} className="!bg-white/15 !text-white !ring-white/20">{today.late ? 'Late arrival' : 'On time'}</Badge>}
              <Badge className="!bg-white/15 !text-white !ring-white/20">School starts {gate.startTime}</Badge>
              {isBoarder && <Badge className="!bg-white/15 !text-white !ring-white/20">Boarder: scan when leaving or returning to campus</Badge>}
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <Button size="lg" icon={ScanLine} onClick={() => { setResult(null); setScan(true); }} disabled={!!today?.out}>
              {!today ? 'Scan to clock in' : today.out ? 'Done for today' : 'Scan to clock out'}
            </Button>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) handle(code); else toast.error('Enter the 6-digit code shown on the gate screen'); }}>
              <Input inputMode="numeric" maxLength={6} placeholder="Or type 6-digit gate code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <Button type="submit" variant="secondary" icon={KeyRound} disabled={!!today?.out}>Go</Button>
            </form>
          </div>
          {result && (
            <div className="border-t border-slate-100 dark:border-white/5">
              <ClockResult result={result} />
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
          <StatCard label="Days recorded" value={past.length} icon={Clock} sub="Last 3 weeks" />
          <StatCard label="On-time rate" value={`${pct(onTime, past.length)}%`} icon={CheckCircle2} tone="green" />
          <StatCard label="Average arrival" value={avgIn == null ? '—' : `${String(Math.floor(avgIn / 60)).padStart(2, '0')}:${String(avgIn % 60).padStart(2, '0')}`} icon={Timer} tone="navy" />
          <StatCard label="Late arrivals" value={past.length - onTime} icon={AlertTriangle} tone="red" />
        </div>
      </div>

      <h3 className="mb-3 mt-8 text-lg font-extrabold text-slate-900 dark:text-white">My history</h3>
      <DataTable
        rows={mine}
        search={false}
        empty={<EmptyState icon={Clock} title="No clock-ins yet" />}
        columns={[
          { key: 'date', label: 'Date', render: (c) => fmtDate(c.date, 'EEE d MMM') },
          { key: 'in', label: 'In', render: (c) => <span className="font-semibold">{c.in}</span> },
          { key: 'out', label: 'Out', render: (c) => c.out || <span className="text-slate-400">—</span> },
          { key: 'late', label: 'Status', render: (c) => <Badge tone={c.late ? 'amber' : 'green'}>{c.late ? 'Late' : 'On time'}</Badge> },
          { key: 'inMethod', label: 'Method', hideOnMobile: true },
        ]}
      />

      <Modal open={scan} onClose={() => setScan(false)} title="Scan the gate QR code" subtitle="Point your camera at the code on the gate screen">
        {scan && <QRScanner onResult={handle} className="aspect-square w-full" />}
        <p className="mt-4 text-center text-xs text-slate-500">The code changes every {gate.rotateSeconds} seconds, so photos of it won't work later.</p>
      </Modal>
      <Modal open={badge} onClose={() => setBadge(false)} title="My ID badge" subtitle="Show this at the gate if you can't scan" size="sm">
        <div className="flex flex-col items-center text-center">
          <QRCode value={badgeToken(person.personType, person.personId)} size={220} />
          <p className="mt-4 text-lg font-bold">{fullName(personRec)}</p>
          <p className="text-sm text-slate-500">{person.personType === 'Student' ? personRec.admissionNo : personRec.staffNo}</p>
        </div>
      </Modal>
    </>
  );
}

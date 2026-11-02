import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, UserCheck, Users, AlertTriangle, DoorOpen, UserX, Download, Printer, LogIn } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, sortedClasses, TODAY } from '../../data/selectors';
import { fullName, pct, downloadCSV } from '../../lib/format';
import { badgeToken, clock } from '../../lib/gate';
import { Card, PageHeader, Tabs, Button, Badge, Avatar, StatCard, DataTable, Select, Input, Modal, Field, toast } from '../../components/ui';
import { QRCode } from '../../components/QR';
import PrintView from '../../components/PrintView';
import { SchoolLogo } from '../../components/layout/Logo';
import { ClockResult } from './ClockIn';

const mins = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const hhmm = (m) => (m == null ? '—' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`);

function Badges({ list }) {
  const db = useDB();
  const L = useLookups();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
      {list.map((p) => (
        <div key={p.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800">
          <div className="flex items-center gap-2 bg-brand-700 px-3 py-2 text-white">
            <SchoolLogo className="h-6 w-6" />
            <p className="truncate text-[10px] font-extrabold uppercase">{db.settings.schoolName}</p>
          </div>
          <div className="flex flex-col items-center p-3">
            <QRCode value={badgeToken(p.type, p.id)} size={120} />
            <p className="mt-2 text-center text-sm font-bold">{p.name}</p>
            <p className="text-[11px] text-slate-500">{p.type === 'Student' ? `${p.code} · ${L.className(p.classId)}` : `${p.code} · ${p.role}`}</p>
          </div>
          <div className="bg-accent-600 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white">{p.type === 'Student' ? 'Student' : 'Staff'} gate badge</div>
        </div>
      ))}
    </div>
  );
}

export default function Gate() {
  const db = useDB();
  const L = useLookups();
  const navigate = useNavigate();
  const [tab, setTab] = useState('today');
  const [who, setWho] = useState('Student');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(TODAY);
  const [manual, setManual] = useState(null);
  const [badgeSel, setBadgeSel] = useState(null);
  const [printBadges, setPrintBadges] = useState(null);

  const dayStudents = db.students.filter((s) => s.status === 'Active' && s.boarding === 'Day');
  const activeStaff = db.staff.filter((s) => s.status === 'Active');
  const today = db.clockings.filter((c) => c.date === TODAY);
  const tStudents = today.filter((c) => c.personType === 'Student');
  const tStaff = today.filter((c) => c.personType === 'Staff');

  const todayRows = useMemo(() => {
    const people = who === 'Student'
      ? dayStudents.map((s) => ({ id: s.id, type: 'Student', name: fullName(s), sub: L.className(s.classId) }))
      : activeStaff.map((s) => ({ id: s.id, type: 'Staff', name: `${s.title} ${s.firstName} ${s.lastName}`, sub: s.role }));
    return people
      .map((p) => {
        const c = today.find((x) => x.personType === p.type && x.personId === p.id);
        const st = !c ? 'Not arrived' : c.out ? 'Left' : 'On campus';
        return { ...p, c, st };
      })
      .filter((r) => !status || r.st === status || (status === 'Late' && r.c?.late));
  }, [who, status, today, dayStudents, activeStaff, L]);

  const history = db.clockings.filter((c) => c.date === date);

  const punctuality = useMemo(() => {
    const byStaff = {};
    db.clockings.filter((c) => c.personType === 'Staff').forEach((c) => (byStaff[c.personId] ||= []).push(c));
    const days = new Set(db.clockings.map((c) => c.date)).size;
    return activeStaff.map((s) => {
      const list = byStaff[s.id] || [];
      const ins = list.map((c) => mins(c.in));
      const outs = list.filter((c) => c.out).map((c) => mins(c.out));
      return {
        id: s.id, s, days: list.length, total: days, late: list.filter((c) => c.late).length,
        avgIn: ins.length ? ins.reduce((a, b) => a + b, 0) / ins.length : null,
        avgOut: outs.length ? outs.reduce((a, b) => a + b, 0) / outs.length : null,
      };
    });
  }, [db.clockings, activeStaff]);

  const doManual = () => {
    if (!manual?.personId) return toast.error('Choose a person');
    const r = clock(manual.type, manual.personId, 'Manual');
    setManual({ ...manual, result: r });
  };

  const openBadges = () => {
    const list = badgeSel.type === 'Students'
      ? db.students.filter((s) => s.classId === badgeSel.classId).map((s) => ({ id: s.id, type: 'Student', name: fullName(s), code: s.admissionNo, classId: s.classId }))
      : activeStaff.map((s) => ({ id: s.id, type: 'Staff', name: `${s.firstName} ${s.lastName}`, code: s.staffNo, role: s.role }));
    setPrintBadges(list);
    setBadgeSel(null);
  };

  return (
    <>
      <PageHeader
        title="Gate Attendance"
        subtitle={`QR clock-in/out at the ${db.settings.gate.name} · school starts ${db.settings.gate.startTime}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => setBadgeSel({ type: 'Students', classId: sortedClasses(db.classes)[0].id })}>Print badges</Button>
            <Button variant="secondary" icon={LogIn} onClick={() => setManual({ type: 'Student' })}>Manual clock-in</Button>
            <Button icon={MonitorSmartphone} onClick={() => navigate('/gate/kiosk')}>Open gate kiosk</Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Students in" value={`${tStudents.length}/${dayStudents.length}`} icon={UserCheck} tone="green" sub={`${pct(tStudents.length, dayStudents.length)}% of day students`} />
        <StatCard label="Staff in" value={`${tStaff.length}/${activeStaff.length}`} icon={Users} tone="blue" />
        <StatCard label="Late today" value={today.filter((c) => c.late).length} icon={AlertTriangle} tone="amber" />
        <StatCard label="On campus now" value={today.filter((c) => !c.out).length} icon={DoorOpen} tone="navy" />
        <StatCard label="Not arrived" value={dayStudents.length - tStudents.length + activeStaff.length - tStaff.length} icon={UserX} tone="red" sub="Students + staff" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'today', label: 'Today' }, { value: 'history', label: 'History' }, { value: 'staff', label: 'Staff punctuality' }]} />

      {tab === 'today' && (
        <DataTable
          rows={todayRows}
          searchText={(r) => `${r.name} ${r.sub}`}
          toolbar={
            <>
              <Select className="!w-auto" value={who} onChange={(e) => setWho(e.target.value)} options={[{ value: 'Student', label: 'Day students' }, { value: 'Staff', label: 'Staff' }]} />
              <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={['On campus', 'Left', 'Late', 'Not arrived']} placeholder="Any status" />
            </>
          }
          columns={[
            { key: 'name', label: 'Name', render: (r) => <div className="flex items-center gap-3"><Avatar name={r.name} size="sm" /><div><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-500">{r.sub}</p></div></div> },
            { key: 'in', label: 'In', sort: (r) => r.c?.in || '99', render: (r) => (r.c ? <span className="font-semibold">{r.c.in}</span> : '—') },
            { key: 'out', label: 'Out', sort: (r) => r.c?.out || '', render: (r) => r.c?.out || '—' },
            { key: 'method', label: 'Method', hideOnMobile: true, render: (r) => r.c?.inMethod || '—' },
            { key: 'st', label: 'Status', render: (r) => <div className="flex gap-1"><Badge tone={r.st === 'On campus' ? 'green' : r.st === 'Left' ? 'slate' : 'red'} dot>{r.st}</Badge>{r.c?.late && <Badge tone="amber">Late</Badge>}</div> },
          ]}
        />
      )}

      {tab === 'history' && (
        <DataTable
          rows={history}
          initialSort={{ key: 'in', dir: 'asc' }}
          searchText={(c) => (c.personType === 'Student' ? L.studentName(c.personId) : L.staffName(c.personId))}
          toolbar={
            <>
              <Input type="date" className="!w-auto" max={TODAY} value={date} onChange={(e) => setDate(e.target.value)} />
              <Button variant="secondary" icon={Download} onClick={() => downloadCSV(`gate-${date}`, history.map((c) => ({ Date: c.date, Type: c.personType, Name: c.personType === 'Student' ? L.studentName(c.personId) : L.staffName(c.personId), In: c.in, Out: c.out || '', Late: c.late ? 'Yes' : 'No', Method: c.inMethod })))}>Export</Button>
            </>
          }
          columns={[
            { key: 'name', label: 'Name', sort: (c) => (c.personType === 'Student' ? L.studentName(c.personId) : L.staffName(c.personId)), render: (c) => <span className="font-semibold">{c.personType === 'Student' ? L.studentName(c.personId) : L.staffName(c.personId)}</span> },
            { key: 'personType', label: 'Type', render: (c) => <Badge tone={c.personType === 'Student' ? 'blue' : 'violet'}>{c.personType}</Badge> },
            { key: 'in', label: 'In' },
            { key: 'out', label: 'Out', render: (c) => c.out || '—' },
            { key: 'inMethod', label: 'Method', hideOnMobile: true },
            { key: 'late', label: 'Status', render: (c) => <Badge tone={c.late ? 'amber' : 'green'}>{c.late ? 'Late' : 'On time'}</Badge> },
          ]}
        />
      )}

      {tab === 'staff' && (
        <DataTable
          rows={punctuality}
          initialSort={{ key: 'late', dir: 'desc' }}
          searchText={(r) => `${r.s.firstName} ${r.s.lastName} ${r.s.role}`}
          columns={[
            { key: 'name', label: 'Staff', sort: (r) => r.s.lastName, render: (r) => <div><p className="font-semibold">{r.s.title} {r.s.firstName} {r.s.lastName}</p><p className="text-xs text-slate-500">{r.s.role}</p></div> },
            { key: 'days', label: 'Days present', render: (r) => `${r.days}/${r.total}` },
            { key: 'late', label: 'Late', render: (r) => <span className={r.late ? 'font-bold text-amber-600' : ''}>{r.late}</span> },
            { key: 'avgIn', label: 'Avg arrival', render: (r) => hhmm(r.avgIn) },
            { key: 'avgOut', label: 'Avg departure', hideOnMobile: true, render: (r) => hhmm(r.avgOut) },
            { key: 'rate', label: 'On time', sort: (r) => pct(r.days - r.late, r.days), render: (r) => <Badge tone={pct(r.days - r.late, r.days) >= 90 ? 'green' : 'amber'}>{pct(r.days - r.late, r.days)}%</Badge> },
          ]}
        />
      )}

      <Modal open={!!manual} onClose={() => setManual(null)} title="Manual clock-in / out" subtitle="For someone who forgot their phone and badge" size="sm"
        footer={!manual?.result && <><Button variant="secondary" onClick={() => setManual(null)}>Cancel</Button><Button onClick={doManual}>Record</Button></>}>
        {manual && (manual.result ? <ClockResult result={manual.result} onClose={() => setManual(null)} /> : (
          <div className="space-y-4">
            <Field label="Type"><Select value={manual.type} onChange={(e) => setManual({ type: e.target.value })} options={['Student', 'Staff']} /></Field>
            <Field label="Person">
              <Select value={manual.personId || ''} onChange={(e) => setManual({ ...manual, personId: e.target.value })} placeholder="Select…"
                options={manual.type === 'Student' ? [...db.students].filter((s) => s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` })) : activeStaff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} · ${s.role}` }))} />
            </Field>
          </div>
        ))}
      </Modal>
      <Modal open={!!badgeSel} onClose={() => setBadgeSel(null)} title="Print gate badges" size="sm" footer={<Button icon={Printer} onClick={openBadges}>Preview badges</Button>}>
        {badgeSel && (
          <div className="space-y-4">
            <Field label="Badges for"><Select value={badgeSel.type} onChange={(e) => setBadgeSel({ ...badgeSel, type: e.target.value })} options={['Students', 'Staff']} /></Field>
            {badgeSel.type === 'Students' && <Field label="Class"><Select value={badgeSel.classId} onChange={(e) => setBadgeSel({ ...badgeSel, classId: e.target.value })} options={sortedClasses(db.classes).map((c) => ({ value: c.id, label: c.name }))} /></Field>}
            <p className="text-xs text-slate-500">Each badge carries a QR code the gate kiosk can scan, useful for young pupils and staff without smartphones.</p>
          </div>
        )}
      </Modal>
      <PrintView open={!!printBadges} onClose={() => setPrintBadges(null)} title={`Gate badges (${printBadges?.length || 0})`}>
        <div className="print-area rounded-lg bg-white p-6 shadow-xl">{printBadges && <Badges list={printBadges} />}</div>
      </PrintView>
    </>
  );
}


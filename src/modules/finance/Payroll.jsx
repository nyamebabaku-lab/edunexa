import { useState } from 'react';
import { format, parseISO, addMonths } from 'date-fns';
import { Play, CheckCircle2, Printer, Banknote, Users, Landmark, Receipt } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, TODAY } from '../../data/selectors';
import { money, moneyShort, sum, fmtDate, downloadCSV } from '../../lib/format';
import { payslip } from '../../lib/payroll';
import { Card, PageHeader, Button, Badge, DataTable, StatCard, Select, toast, confirmDialog } from '../../components/ui';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

function PayslipDoc({ line, month }) {
  const L = useLookups();
  const s = L.staff(line.staffId);
  return (
    <Paper>
      <Letterhead title="Payslip" right={<p className="mt-2 text-sm font-bold">{fmtDate(`${month}-01`, 'MMMM yyyy')}</p>} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <p>Name: <b>{L.staffName(line.staffId)}</b></p>
        <p>Staff No: <b>{s?.staffNo}</b></p>
        <p>Position: <b>{s?.role} · {s?.department}</b></p>
        <p>SSNIT No: <b>{s?.ssnitNo}</b></p>
        <p>Bank: <b>{s?.bank}</b></p>
        <p>Account: <b>{s?.accountNo}</b></p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-2 border-b-2 border-slate-800 pb-1 font-bold">Earnings</p>
          <div className="flex justify-between py-1"><span>Basic salary</span><span>{money(line.basic)}</span></div>
          <div className="flex justify-between py-1"><span>Allowances</span><span>{money(line.allowances)}</span></div>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Gross pay</span><span>{money(line.gross)}</span></div>
        </div>
        <div>
          <p className="mb-2 border-b-2 border-slate-800 pb-1 font-bold">Deductions</p>
          <div className="flex justify-between py-1"><span>SSNIT (5.5%)</span><span>{money(line.ssnit)}</span></div>
          <div className="flex justify-between py-1"><span>PAYE income tax</span><span>{money(line.paye)}</span></div>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total deductions</span><span>{money(line.ssnit + line.paye)}</span></div>
        </div>
      </div>
      <div className="mt-6 rounded-xl border-2 border-brand-700 p-4 text-center">
        <p className="text-xs uppercase text-slate-500">Net pay</p>
        <p className="text-3xl font-extrabold text-brand-800">{money(line.net)}</p>
      </div>
      <p className="mt-4 text-xs text-slate-500">Employer SSNIT contribution (13%): {money(line.employerSsnit)}. This is a computer-generated payslip.</p>
    </Paper>
  );
}

export default function Payroll() {
  const db = useDB();
  const L = useLookups();
  const runs = [...db.payrollRuns].sort((a, b) => b.month.localeCompare(a.month));
  const [month, setMonth] = useState(runs[0]?.month);
  const [print, setPrint] = useState(null);
  const run = db.payrollRuns.find((r) => r.month === month);
  const nextMonth = runs[0] ? format(addMonths(parseISO(`${runs[0].month}-01`), 1), 'yyyy-MM') : TODAY.slice(0, 7);

  const runPayroll = async () => {
    if (!(await confirmDialog(`Run payroll for ${fmtDate(`${nextMonth}-01`, 'MMMM yyyy')}?`, `Calculates pay, SSNIT and PAYE for ${db.staff.filter((s) => s.status === 'Active').length} active staff.`, { danger: false, confirmLabel: 'Run payroll' }))) return;
    db.add('payrollRuns', { id: `prl_${nextMonth}`, month: nextMonth, status: 'Draft', paidOn: null, createdAt: TODAY, lines: db.staff.filter((s) => s.status === 'Active').map(payslip) });
    setMonth(nextMonth);
    toast.success('Payroll calculated', 'Review and approve to pay');
  };
  const approve = async () => {
    if (!(await confirmDialog('Approve & mark as paid?', `Net pay of ${money(sum(run.lines, (l) => l.net))} will be recorded as paid.`, { danger: false, confirmLabel: 'Approve' }))) return;
    db.update('payrollRuns', run.id, { status: 'Paid', paidOn: TODAY });
    toast.success('Payroll paid', 'Bank schedule ready for export');
  };

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Monthly salaries with Ghana SSNIT and PAYE deductions"
        actions={
          <>
            <Select className="!w-48" value={month} onChange={(e) => setMonth(e.target.value)} options={runs.map((r) => ({ value: r.month, label: fmtDate(`${r.month}-01`, 'MMMM yyyy') }))} />
            <Button variant="secondary" icon={Play} onClick={runPayroll}>Run {fmtDate(`${nextMonth}-01`, 'MMM')}</Button>
            {run?.status === 'Draft' && <Button icon={CheckCircle2} onClick={approve}>Approve & pay</Button>}
          </>
        }
      />
      {run && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Gross pay" value={moneyShort(sum(run.lines, (l) => l.gross))} icon={Banknote} sub={`${run.lines.length} staff`} />
            <StatCard label="Net pay" value={moneyShort(sum(run.lines, (l) => l.net))} icon={Users} tone="green" />
            <StatCard label="PAYE to GRA" value={moneyShort(sum(run.lines, (l) => l.paye))} icon={Landmark} tone="red" />
            <StatCard label="SSNIT (both)" value={moneyShort(sum(run.lines, (l) => l.ssnit + l.employerSsnit))} icon={Receipt} tone="amber" sub={<Badge tone={run.status === 'Paid' ? 'green' : 'amber'}>{run.status}{run.paidOn ? ` · ${fmtDate(run.paidOn, 'd MMM')}` : ''}</Badge>} />
          </div>
          <DataTable
            rows={run.lines.map((l) => ({ ...l, id: l.staffId }))}
            onRowClick={(l) => setPrint(l)}
            searchText={(l) => L.staffName(l.staffId)}
            toolbar={<Button variant="secondary" onClick={() => downloadCSV(`bank-schedule-${month}`, run.lines.map((l) => ({ Name: L.staffName(l.staffId), Bank: L.staff(l.staffId)?.bank, Account: L.staff(l.staffId)?.accountNo, NetPay: l.net })))}>Bank schedule CSV</Button>}
            columns={[
              { key: 'name', label: 'Staff', sort: (l) => L.staffName(l.staffId), render: (l) => <div><p className="font-semibold">{L.staffName(l.staffId)}</p><p className="text-xs text-slate-500">{L.staff(l.staffId)?.role}</p></div> },
              { key: 'basic', label: 'Basic', hideOnMobile: true, render: (l) => money(l.basic) },
              { key: 'allowances', label: 'Allow.', hideOnMobile: true, render: (l) => money(l.allowances) },
              { key: 'gross', label: 'Gross', render: (l) => money(l.gross) },
              { key: 'ssnit', label: 'SSNIT', hideOnMobile: true, render: (l) => <span className="text-accent-600">{money(l.ssnit)}</span> },
              { key: 'paye', label: 'PAYE', hideOnMobile: true, render: (l) => <span className="text-accent-600">{money(l.paye)}</span> },
              { key: 'net', label: 'Net pay', render: (l) => <span className="font-bold text-emerald-600">{money(l.net)}</span> },
              { key: 'p', label: '', nosort: true, render: () => <Printer className="h-4 w-4 text-slate-400" /> },
            ]}
          />
        </>
      )}
      {!run && <Card className="p-10 text-center text-slate-500">No payroll runs yet.</Card>}
      <PrintView open={!!print} onClose={() => setPrint(null)} title="Payslip">{print && <PayslipDoc line={print} month={month} />}</PrintView>
    </>
  );
}

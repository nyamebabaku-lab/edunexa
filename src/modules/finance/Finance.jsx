import { useMemo, useState } from 'react';
import { Plus, Printer, Send, FileStack, Wallet, AlertCircle, FileText, Receipt, Download, Trash2, Save } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useBalances, invoiceNet, sortedClasses, TODAY } from '../../data/selectors';
import { money, moneyShort, fmtDate, fullName, sum, pct, uid, nowISO, downloadCSV } from '../../lib/format';
import { SECTIONS } from '../../data/seed';
import { Card, CardHeader, PageHeader, Tabs, Button, Badge, Avatar, DataTable, StatCard, Select, Input, Progress, IconButton, toast, confirmDialog } from '../../components/ui';
import CrudPage from '../../components/CrudPage';
import PrintView from '../../components/PrintView';
import { RecordPaymentModal, ReceiptDoc, InvoiceDoc, invoiceStatus } from './shared';

function Overview() {
  const db = useDB();
  const term = db.settings.currentTerm;
  const inv = db.invoices.filter((i) => i.termId === term);
  const bySection = SECTIONS.map((sec) => {
    const ids = new Set(db.students.filter((s) => db.classes.find((c) => c.id === s.classId)?.section === sec).map((s) => s.id));
    const list = inv.filter((i) => ids.has(i.studentId));
    const billed = sum(list, invoiceNet);
    const paid = sum(list, (i) => invoiceStatus(i, db.payments).paid);
    return { sec, billed, paid, rate: pct(paid, billed), count: list.length };
  });
  const byItem = useMemo(() => {
    const m = {};
    inv.forEach((i) => i.items.forEach((it) => (m[it.name] = (m[it.name] || 0) + it.amount)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [inv]);
  const total = sum(byItem, (x) => x[1]);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Collection by section" subtitle={db.terms.find((t) => t.id === term)?.name} icon={Wallet} />
        <div className="space-y-5 p-5">
          {bySection.map((r) => (
            <div key={r.sec}>
              <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{r.sec} <span className="font-normal text-slate-400">· {r.count} bills</span></span>
                <span><b>{moneyShort(r.paid)}</b> <span className="text-slate-400">of {moneyShort(r.billed)} · {r.rate}%</span></span>
              </div>
              <Progress value={r.rate} tone={r.rate >= 75 ? 'green' : r.rate >= 50 ? 'blue' : 'red'} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Billing by fee item" subtitle="Current term" icon={FileText} />
        <div className="divide-y divide-slate-100 px-5 pb-3 dark:divide-white/5">
          {byItem.map(([name, amt]) => (
            <div key={name} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{name}</span>
              <span className="font-semibold">{money(amt)} <span className="ml-1 text-xs font-normal text-slate-400">{pct(amt, total)}%</span></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Invoices() {
  const db = useDB();
  const L = useLookups();
  const [termId, setTermId] = useState(db.settings.currentTerm);
  const [status, setStatus] = useState('');
  const [print, setPrint] = useState(null);
  const rows = db.invoices.filter((i) => i.termId === termId).map((i) => ({ ...i, st: invoiceStatus(i, db.payments) })).filter((i) => !status || i.st.label === status);

  const generate = async () => {
    const billed = new Set(db.invoices.filter((i) => i.termId === termId).map((i) => i.studentId));
    const todo = db.students.filter((s) => s.status === 'Active' && !billed.has(s.id));
    if (!todo.length) return toast.info('All active students already billed for this term');
    if (!(await confirmDialog('Generate term bills?', `Create ${todo.length} invoice(s) for ${db.terms.find((t) => t.id === termId)?.name} using current fee structures.`, { danger: false, confirmLabel: 'Generate' }))) return;
    let n = db.invoices.length;
    const recs = todo.map((s) => {
      const c = L.cls(s.classId);
      const items = [...db.feeStructures.find((f) => f.section === c.section).items];
      if (s.boarding === 'Boarder') items.push({ name: 'Boarding & Feeding', amount: db.boardingFee });
      const r = db.routes.find((x) => x.id === s.busRouteId);
      if (r) items.push({ name: 'Transport', amount: r.fee });
      n++;
      return { id: uid('inv'), invoiceNo: `INV-${termId.slice(2, 4)}${termId.slice(-1)}-${String(n).padStart(4, '0')}`, studentId: s.id, termId, date: TODAY, dueDate: TODAY, items, discount: 0, discountReason: '', total: sum(items, (i) => i.amount) };
    });
    db.addMany('invoices', recs);
    toast.success('Bills generated', `${recs.length} invoices created`);
  };

  return (
    <>
      <DataTable
        rows={rows}
        onRowClick={setPrint}
        searchText={(i) => `${i.invoiceNo} ${L.studentName(i.studentId)} ${L.className(L.student(i.studentId)?.classId)}`}
        toolbar={
          <>
            <Select className="!w-auto" value={termId} onChange={(e) => setTermId(e.target.value)} options={db.terms.map((t) => ({ value: t.id, label: t.name }))} />
            <Select className="!w-auto" value={status} onChange={(e) => setStatus(e.target.value)} options={['Paid', 'Part paid', 'Unpaid']} placeholder="Any status" />
            <Button icon={FileStack} onClick={generate}>Generate bills</Button>
          </>
        }
        columns={[
          { key: 'invoiceNo', label: 'Invoice', render: (i) => <span className="font-mono text-xs font-semibold">{i.invoiceNo}</span> },
          { key: 'student', label: 'Student', sort: (i) => L.studentName(i.studentId), render: (i) => <span className="font-semibold">{L.studentName(i.studentId)}</span> },
          { key: 'class', label: 'Class', hideOnMobile: true, sort: (i) => L.studentClass(i.studentId)?.order, render: (i) => L.studentClass(i.studentId)?.name },
          { key: 'net', label: 'Amount', sort: invoiceNet, render: (i) => money(invoiceNet(i)) },
          { key: 'paid', label: 'Paid', hideOnMobile: true, sort: (i) => i.st.paid, render: (i) => <span className="text-emerald-600">{money(i.st.paid)}</span> },
          { key: 'due', label: 'Balance', sort: (i) => i.st.due, render: (i) => <span className={i.st.due ? 'font-semibold text-accent-600' : ''}>{money(i.st.due)}</span> },
          { key: 'status', label: 'Status', sort: (i) => i.st.label, render: (i) => <Badge tone={i.st.tone} dot>{i.st.label}</Badge> },
        ]}
      />
      <PrintView open={!!print} onClose={() => setPrint(null)} title="Invoice">{print && <InvoiceDoc invoice={print} />}</PrintView>
    </>
  );
}

function Payments() {
  const db = useDB();
  const L = useLookups();
  const [rec, setRec] = useState(false);
  const [print, setPrint] = useState(null);
  const [method, setMethod] = useState('');
  const rows = db.payments.filter((p) => !method || p.method === method);
  return (
    <>
      <DataTable
        rows={rows}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={setPrint}
        searchText={(p) => `${p.receiptNo} ${L.studentName(p.studentId)} ${p.reference} ${p.method}`}
        toolbar={
          <>
            <Select className="!w-auto" value={method} onChange={(e) => setMethod(e.target.value)} options={['Mobile Money', 'Cash', 'Bank Transfer', 'Cheque', 'Card']} placeholder="All methods" />
            <Button variant="secondary" icon={Download} onClick={() => downloadCSV('payments', rows.map((p) => ({ Receipt: p.receiptNo, Date: p.date, Student: L.studentName(p.studentId), Amount: p.amount, Method: p.method, Network: p.network, Reference: p.reference })))}>Export</Button>
            <Button icon={Plus} onClick={() => setRec(true)}>Record payment</Button>
          </>
        }
        columns={[
          { key: 'receiptNo', label: 'Receipt', render: (p) => <span className="font-mono text-xs font-semibold">{p.receiptNo}</span> },
          { key: 'date', label: 'Date', render: (p) => fmtDate(p.date) },
          { key: 'student', label: 'Student', sort: (p) => L.studentName(p.studentId), render: (p) => <span className="font-semibold">{L.studentName(p.studentId)}</span> },
          { key: 'amount', label: 'Amount', render: (p) => <span className="font-bold text-emerald-600">{money(p.amount)}</span> },
          { key: 'method', label: 'Method', render: (p) => <Badge tone={p.method === 'Mobile Money' ? 'amber' : 'slate'}>{p.network || p.method}</Badge> },
          { key: 'reference', label: 'Reference', hideOnMobile: true, render: (p) => <span className="font-mono text-xs text-slate-500">{p.reference || '—'}</span> },
          { key: 'p', label: '', nosort: true, render: () => <Printer className="h-4 w-4 text-slate-400" /> },
        ]}
      />
      <RecordPaymentModal open={rec} onClose={() => setRec(false)} onDone={(ps) => setPrint(ps[0])} />
      <PrintView open={!!print} onClose={() => setPrint(null)} title="Receipt">{print && <ReceiptDoc payment={print} />}</PrintView>
    </>
  );
}

function Arrears() {
  const db = useDB();
  const L = useLookups();
  const bal = useBalances();
  const [classId, setClassId] = useState('');
  const [pay, setPay] = useState(null);
  const rows = db.students
    .filter((s) => !classId || s.classId === classId)
    .map((s) => ({ id: s.id, s, ...bal.get(s.id) }))
    .filter((r) => r.balance > 0);
  const remind = async () => {
    if (!(await confirmDialog('Send SMS reminders?', `Send a fee reminder to ${rows.length} parent(s).`, { danger: false, confirmLabel: 'Send SMS' }))) return;
    db.add('smsLog', { date: nowISO(), audience: `Parents with arrears${classId ? ` · ${L.className(classId)}` : ''}`, message: `${db.settings.schoolName}: Dear parent, kindly settle your ward's outstanding fees. Pay via MoMo merchant code 778899. Thank you.`, recipients: rows.length, status: 'Delivered' });
    toast.success('Reminders sent', `${rows.length} SMS delivered`);
  };
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Students owing" value={rows.length} icon={AlertCircle} tone="red" />
        <StatCard label="Total arrears" value={money(sum(rows, (r) => r.balance))} icon={Wallet} tone="amber" />
        <StatCard label="Average owed" value={money(rows.length ? sum(rows, (r) => r.balance) / rows.length : 0)} icon={Receipt} tone="navy" />
      </div>
      <DataTable
        rows={rows}
        initialSort={{ key: 'balance', dir: 'desc' }}
        searchText={(r) => `${fullName(r.s)} ${L.parentName(r.s.parentId)}`}
        toolbar={
          <>
            <Select className="!w-auto" value={classId} onChange={(e) => setClassId(e.target.value)} options={sortedClasses(db.classes).map((c) => ({ value: c.id, label: c.name }))} placeholder="All classes" />
            <Button variant="danger" icon={Send} onClick={remind}>SMS reminders</Button>
          </>
        }
        columns={[
          { key: 'name', label: 'Student', sort: (r) => r.s.lastName, render: (r) => <div className="flex items-center gap-3"><Avatar name={fullName(r.s)} size="sm" /><div><p className="font-semibold">{fullName(r.s)}</p><p className="text-xs text-slate-500">{L.className(r.s.classId)}</p></div></div> },
          { key: 'parent', label: 'Parent', hideOnMobile: true, render: (r) => <div><p>{L.parentName(r.s.parentId)}</p><p className="text-xs text-slate-500">{L.parent(r.s.parentId)?.phone}</p></div> },
          { key: 'billed', label: 'Billed', hideOnMobile: true, render: (r) => money(r.billed) },
          { key: 'paid', label: 'Paid', hideOnMobile: true, render: (r) => <span className="text-emerald-600">{money(r.paid)}</span> },
          { key: 'balance', label: 'Balance', render: (r) => <span className="font-bold text-accent-600">{money(r.balance)}</span> },
          { key: 'act', label: '', nosort: true, render: (r) => <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); setPay(r.s.id); }}>Receive</Button> },
        ]}
      />
      <RecordPaymentModal open={!!pay} onClose={() => setPay(null)} studentId={pay} />
    </>
  );
}

function FeeStructures() {
  const db = useDB();
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(db.feeStructures)));
  const [boarding, setBoarding] = useState(db.boardingFee);
  const setItem = (fi, ii, patch) => setDraft(draft.map((f, i) => (i === fi ? { ...f, items: f.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : f)));
  const save = () => {
    db.setKey('feeStructures', draft.map((f) => ({ ...f, items: f.items.filter((i) => i.name).map((i) => ({ ...i, amount: Number(i.amount) || 0 })) })));
    db.setKey('boardingFee', Number(boarding) || 0);
    toast.success('Fee structures saved', 'New bills will use these amounts');
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">Boarding fee / term <Input type="number" className="!w-32" value={boarding} onChange={(e) => setBoarding(e.target.value)} /></label>
        <Button icon={Save} onClick={save}>Save changes</Button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {draft.map((f, fi) => (
          <Card key={f.id}>
            <CardHeader title={f.section} subtitle={`Per ${f.section === 'Diploma' ? 'semester' : 'term'} · total ${money(sum(f.items, (i) => i.amount))}`} icon={FileText} />
            <div className="space-y-2 p-5">
              {f.items.map((it, ii) => (
                <div key={ii} className="flex items-center gap-2">
                  <Input value={it.name} onChange={(e) => setItem(fi, ii, { name: e.target.value })} />
                  <Input type="number" className="!w-28" value={it.amount} onChange={(e) => setItem(fi, ii, { amount: e.target.value })} />
                  <IconButton icon={Trash2} label="Remove" onClick={() => setDraft(draft.map((x, i) => (i === fi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))} />
                </div>
              ))}
              <Button size="sm" variant="soft" icon={Plus} onClick={() => setDraft(draft.map((x, i) => (i === fi ? { ...x, items: [...x.items, { name: '', amount: 0 }] } : x)))}>Add item</Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Expenses() {
  const db = useDB();
  const L = useLookups();
  return (
    <CrudPage
      collection="expenses"
      noun="expense"
      initialSort={{ key: 'date', dir: 'desc' }}
      defaults={{ date: TODAY, method: 'Bank Transfer', category: 'Administration', approvedBy: 'stf_001' }}
      fields={[
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'category', label: 'Category', type: 'select', options: db.expenseCategories, required: true },
        { name: 'description', label: 'Description', required: true, span: 2 },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'payee', label: 'Payee / vendor' },
        { name: 'method', label: 'Payment method', type: 'select', options: ['Bank Transfer', 'Cheque', 'Mobile Money', 'Cash'] },
      ]}
      columns={[
        { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
        { key: 'category', label: 'Category', render: (e) => <Badge tone="blue">{e.category}</Badge> },
        { key: 'description', label: 'Description', render: (e) => <span className="font-medium">{e.description}</span> },
        { key: 'payee', label: 'Payee', hideOnMobile: true },
        { key: 'method', label: 'Method', hideOnMobile: true },
        { key: 'amount', label: 'Amount', render: (e) => <span className="font-bold text-accent-600">{money(e.amount)}</span> },
        { key: 'approvedBy', label: 'Approved', hideOnMobile: true, render: (e) => <span className="text-xs text-slate-500">{L.staffName(e.approvedBy)}</span> },
      ]}
    />
  );
}

export default function Finance() {
  const db = useDB();
  const bal = useBalances();
  const [tab, setTab] = useState('overview');
  const term = db.settings.currentTerm;
  const inv = db.invoices.filter((i) => i.termId === term);
  const ids = new Set(inv.map((i) => i.id));
  const billed = sum(inv, invoiceNet);
  const paid = sum(db.payments.filter((p) => ids.has(p.invoiceId)), (p) => p.amount);
  return (
    <>
      <PageHeader title="Fees & Finance" subtitle="Billing, payments, arrears, fee structures and expenditure" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed this term" value={moneyShort(billed)} icon={FileText} />
        <StatCard label="Collected this term" value={moneyShort(paid)} icon={Wallet} tone="green" sub={`${pct(paid, billed)}% collected`} />
        <StatCard label="All arrears" value={moneyShort(bal.totalBilled - bal.totalPaid)} icon={AlertCircle} tone="red" />
        <StatCard label="Expenses (term)" value={moneyShort(sum(db.expenses.filter((e) => e.date >= db.terms.find((t) => t.id === term).start), (e) => e.amount))} icon={Receipt} tone="amber" />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: 'overview', label: 'Overview' }, { value: 'invoices', label: 'Invoices' }, { value: 'payments', label: 'Payments' },
        { value: 'arrears', label: 'Arrears' }, { value: 'structures', label: 'Fee structures' }, { value: 'expenses', label: 'Expenses' },
      ]} />
      {tab === 'overview' && <Overview />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'payments' && <Payments />}
      {tab === 'arrears' && <Arrears />}
      {tab === 'structures' && <FeeStructures />}
      {tab === 'expenses' && <Expenses />}
    </>
  );
}

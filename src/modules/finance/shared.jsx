import { useState, useEffect } from 'react';
import { Receipt, Printer, CreditCard, Smartphone, CheckCircle2, Plus, Percent } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, invoiceNet, invoicePaid, TODAY } from '../../data/selectors';
import { money, fmtDate, fullName, sum, uid } from '../../lib/format';
import { LIVE } from '../../config';
import { Button, Badge, Card, CardHeader, Field, Input, Modal, Select, Textarea, Combo, toast, cx, EmptyState } from '../../components/ui';
import { SECTIONS } from '../../data/seed';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

export const METHODS = ['Mobile Money', 'Cash', 'Bank Transfer', 'Cheque', 'Card'];
export const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AT Money'];

// ---------------------------------------------------------------- billing rules
// General term fees come from each level's fee structure and go to every active student (Invoices → Generate bills).
// Everything else is billed only to the students it applies to:
//   • Admission fees: kept as a special fee structure (id fee_admission) and billed once to each new student.
//   • Transport / boarding: added to the term bill of bus riders and boarders only.
//   • Extra charges (excursion, exam fee, uniform…): billed to chosen students, a class, a level or everyone.
export const ADMISSION_ID = 'fee_admission';
export const CHARGE_SUGGESTIONS = ['Excursion', 'Examination fee', 'Mock exams', 'Uniform', 'Sports kit', 'Books & stationery', 'Lab fee', 'ICT fee', 'Graduation', 'Speech & prize day', 'Damages', 'Extra classes', 'PTA levy', 'Development levy'];

/** The new-admission fee items with an amount (demo keeps its old GHS 500 when none was set). */
export function admissionItems(db) {
  const st = (db.feeStructures || []).find((f) => f.id === ADMISSION_ID);
  if (!st) return LIVE ? [] : [{ name: 'Admission Fee', amount: 500 }];
  return st.items.filter((i) => i.name && Number(i.amount) > 0).map((i) => ({ name: i.name, amount: Number(i.amount) }));
}

/** A student's main bill for the term (not an admission fee, extra charge, store or canteen purchase). */
export const isTermBill = (inv) => inv.kind === 'term' || (!inv.kind && !/^(INV-(ST|CN)-|OB-)/.test(inv.invoiceNo || ''));

const nextInvoiceNo = (db, prefix, offset = 0) => `INV-${prefix}-${String(db.invoices.length + 1 + offset).padStart(4, '0')}`;

/** Bills the same items to each student as separate invoices. Returns the invoices made. */
export function chargeStudents(studentIds, items, { kind = 'extra', termId, dueDate, label } = {}) {
  const db = useDB.getState();
  const clean = items.filter((i) => i.name && Number(i.amount) > 0).map((i) => ({ name: i.name.trim(), amount: Number(i.amount) }));
  if (!studentIds.length || !clean.length) return [];
  const chargeId = uid('chg');
  const total = sum(clean, (i) => i.amount);
  const recs = studentIds.map((sid, n) => ({
    id: uid('inv'),
    invoiceNo: nextInvoiceNo(db, kind === 'admission' ? 'AD' : 'EX', n),
    studentId: sid,
    termId: termId ?? db.settings.currentTerm ?? '',
    date: TODAY,
    dueDate: dueDate || TODAY,
    items: clean,
    discount: 0,
    discountReason: '',
    total,
    kind,
    chargeId,
    label: label || clean.map((i) => i.name).join(', '),
  }));
  db.addMany('invoices', recs);
  return recs;
}

/** Admission fee for newly admitted students (nothing when no admission fee is set). */
export function billAdmission(studentIds) {
  const items = admissionItems(useDB.getState());
  return items.length ? chargeStudents(studentIds, items, { kind: 'admission', label: 'Admission fees' }) : [];
}

/** What a bill is for, in a few words. */
export function invoiceTitle(inv, terms) {
  const term = terms.find((t) => t.id === inv.termId)?.name;
  if (inv.kind === 'admission') return 'Admission fees';
  if (inv.kind === 'extra') return inv.label || inv.items?.[0]?.name || 'Extra charge';
  if (/^INV-ST-/.test(inv.invoiceNo || '')) return 'Store purchase';
  if (/^INV-CN-/.test(inv.invoiceNo || '')) return 'Canteen';
  if (/^OB-/.test(inv.invoiceNo || '')) return inv.items?.[0]?.name || 'Opening balance';
  return term ? `${term} fees` : 'School fees';
}

export function invoiceStatus(inv, payments) {
  const paid = invoicePaid(inv, payments);
  const net = invoiceNet(inv);
  if (paid >= net) return { label: 'Paid', tone: 'green', paid, due: 0 };
  if (paid > 0) return { label: 'Part paid', tone: 'amber', paid, due: net - paid };
  return { label: 'Unpaid', tone: 'red', paid, due: net };
}

/** Records a payment against a student's oldest open invoices. */
export function RecordPaymentModal({ open, onClose, studentId: initialStudent, onDone, selfService }) {
  const db = useDB();
  const L = useLookups();
  const [studentId, setStudentId] = useState(initialStudent || '');
  const [v, setV] = useState({ method: 'Mobile Money', network: 'MTN MoMo', amount: '', reference: '', note: '', phone: '' });
  const [step, setStep] = useState('form');

  const openInvoices = db.invoices
    .filter((i) => i.studentId === studentId)
    .map((i) => ({ inv: i, st: invoiceStatus(i, db.payments) }))
    .filter((x) => x.st.due > 0)
    .sort((a, b) => a.inv.date.localeCompare(b.inv.date));
  const due = sum(openInvoices, (x) => x.st.due);

  useEffect(() => {
    if (open) {
      setStudentId(initialStudent || '');
      setStep('form');
      setV({ method: 'Mobile Money', network: 'MTN MoMo', amount: '', reference: '', note: '', phone: L.parent(L.student(initialStudent)?.parentId)?.phone || '' });
    }
  }, [open, initialStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    let amount = Number(v.amount);
    if (!studentId || !amount || amount <= 0) return toast.error('Enter a student and a valid amount');
    if (selfService && v.method === 'Mobile Money' && step === 'form') {
      setStep('prompt');
      setTimeout(() => setStep('confirm'), 1800);
      return;
    }
    const created = [];
    const ref = v.reference || (v.method === 'Mobile Money' ? `MP${Date.now().toString().slice(-8)}` : '');
    let rcptSeq = db.payments.length + 1;
    for (const { inv, st } of openInvoices) {
      if (amount <= 0) break;
      const part = Math.min(amount, st.due);
      created.push({ id: uid('pay'), receiptNo: `RCT-${String(rcptSeq++).padStart(5, '0')}`, studentId, invoiceId: inv.id, amount: part, method: v.method, network: v.method === 'Mobile Money' ? v.network : '', reference: ref, date: TODAY, receivedBy: selfService ? 'online' : 'stf_003', note: v.note });
      amount -= part;
    }
    if (amount > 0) {
      // Overpayment kept as credit against the latest invoice.
      const latest = db.invoices.filter((i) => i.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date))[0];
      created.push({ id: uid('pay'), receiptNo: `RCT-${String(rcptSeq++).padStart(5, '0')}`, studentId, invoiceId: latest?.id, amount, method: v.method, network: v.method === 'Mobile Money' ? v.network : '', reference: ref, date: TODAY, receivedBy: selfService ? 'online' : 'stf_003', note: 'Advance / credit' });
    }
    db.addMany('payments', created);
    toast.success('Payment recorded', `${money(Number(v.amount))} for ${L.studentName(studentId)}`);
    onDone?.(created);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selfService ? 'Pay school fees' : 'Record payment'}
      subtitle={studentId ? `${L.studentName(studentId)} · outstanding ${money(due)}` : undefined}
      footer={
        step === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button icon={selfService ? Smartphone : CheckCircle2} onClick={submit}>{selfService ? `Pay ${v.amount ? money(v.amount) : ''}` : 'Save payment'}</Button>
          </>
        ) : step === 'confirm' ? (
          <Button icon={CheckCircle2} onClick={submit}>I have approved on my phone</Button>
        ) : null
      }
    >
      {step === 'prompt' || step === 'confirm' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div className={cx('flex h-16 w-16 items-center justify-center rounded-full', step === 'prompt' ? 'animate-pulse bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>
            <Smartphone className="h-7 w-7" />
          </div>
          <p className="mt-4 font-bold text-slate-900 dark:text-white">{step === 'prompt' ? `Sending ${v.network} prompt to ${v.phone}…` : 'Prompt sent'}</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">Approve the payment of {money(v.amount)} on your phone by entering your MoMo PIN. (Simulated in this demo.)</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {!initialStudent && (
            <Field label="Student *" className="sm:col-span-2">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Select student…" options={[...db.students].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)} · ${s.admissionNo}` }))} />
            </Field>
          )}
          {studentId && (
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Open invoices</p>
              {openInvoices.length === 0 ? (
                <p className="mt-1 text-sm text-emerald-600">No outstanding balance. Payment will be held as credit.</p>
              ) : (
                openInvoices.map(({ inv, st }) => (
                  <div key={inv.id} className="mt-2 flex justify-between text-sm">
                    <span>{inv.invoiceNo} · {db.terms.find((t) => t.id === inv.termId)?.name}</span>
                    <span className="font-semibold text-accent-600">{money(st.due)}</span>
                  </div>
                ))
              )}
              {due > 0 && (
                <button className="mt-3 text-xs font-semibold text-brand-600" onClick={() => setV({ ...v, amount: due })}>
                  Pay full balance ({money(due)})
                </button>
              )}
            </div>
          )}
          <Field label="Amount *">
            <Input type="number" min="1" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          </Field>
          <Field label="Method">
            <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} options={selfService ? ['Mobile Money', 'Card'] : METHODS} />
          </Field>
          {v.method === 'Mobile Money' && (
            <>
              <Field label="Network">
                <Select value={v.network} onChange={(e) => setV({ ...v, network: e.target.value })} options={NETWORKS} />
              </Field>
              <Field label="MoMo number">
                <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
              </Field>
            </>
          )}
          {!selfService && (
            <Field label="Reference / Txn ID">
              <Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} />
            </Field>
          )}
          {!selfService && (
            <Field label="Note" className="sm:col-span-2">
              <Textarea value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className="min-h-[60px]" />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}

export function ReceiptDoc({ payment }) {
  const L = useLookups();
  const db = useDB();
  const s = L.student(payment.studentId);
  const inv = db.invoices.find((i) => i.id === payment.invoiceId);
  const bal = sum(db.invoices.filter((i) => i.studentId === payment.studentId), invoiceNet) - sum(db.payments.filter((p) => p.studentId === payment.studentId), (p) => p.amount);
  return (
    <Paper>
      <Letterhead title="Official Receipt" right={<p className="mt-2 font-mono text-sm font-bold text-accent-700">{payment.receiptNo}</p>} />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-slate-400">Received from</p>
          <p className="font-bold">{L.parentName(s?.parentId)}</p>
          <p className="text-xs uppercase text-slate-400 mt-3">For student</p>
          <p className="font-bold">{fullName(s)}</p>
          <p className="text-slate-500">{s?.admissionNo} · {L.className(s?.classId)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-slate-400">Date</p>
          <p className="font-bold">{fmtDate(payment.date)}</p>
          <p className="text-xs uppercase text-slate-400 mt-3">Method</p>
          <p className="font-bold">{payment.method}{payment.network ? ` (${payment.network})` : ''}</p>
          {payment.reference && <p className="font-mono text-xs text-slate-500">Ref: {payment.reference}</p>}
        </div>
      </div>
      <div className="mt-6 rounded-xl border-2 border-brand-700 p-5 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500">Amount received</p>
        <p className="mt-1 text-3xl font-extrabold text-brand-800">{money(payment.amount)}</p>
        <p className="mt-1 text-sm text-slate-500">Being payment towards {inv ? `${inv.invoiceNo} · ${db.terms.find((t) => t.id === inv.termId)?.name}` : 'school fees'}</p>
      </div>
      <div className="mt-5 flex justify-between text-sm">
        <span>Balance outstanding after this payment:</span>
        <b className={bal > 0 ? 'text-accent-700' : 'text-emerald-700'}>{money(Math.max(0, bal))}</b>
      </div>
      <div className="mt-12 flex items-end justify-between text-xs text-slate-500">
        <p>Thank you for your payment. Keep this receipt for your records.</p>
        <div className="text-center">
          <div className="mb-1 h-8 w-40 border-b border-slate-400" />
          Accounts Officer
        </div>
      </div>
    </Paper>
  );
}

export function InvoiceDoc({ invoice }) {
  const L = useLookups();
  const db = useDB();
  const s = L.student(invoice.studentId);
  const st = invoiceStatus(invoice, db.payments);
  return (
    <Paper>
      <Letterhead title="Fee Bill / Invoice" right={<p className="mt-2 font-mono text-sm font-bold text-accent-700">{invoice.invoiceNo}</p>} />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-slate-400">Bill to</p>
          <p className="font-bold">{L.parentName(s?.parentId)}</p>
          <p className="text-slate-500">{L.parent(s?.parentId)?.phone}</p>
          <p className="mt-2">Student: <b>{fullName(s)}</b> ({s?.admissionNo})</p>
          <p className="text-slate-500">{L.className(s?.classId)}</p>
        </div>
        <div className="text-right">
          <p>For: <b>{invoiceTitle(invoice, db.terms)}</b></p>
          <p>Issued: <b>{fmtDate(invoice.date)}</b></p>
          <p>Due: <b>{fmtDate(invoice.dueDate)}</b></p>
          <p className="mt-2"><Badge tone={st.tone}>{st.label}</Badge></p>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left"><th className="py-2">#</th><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i} className="border-b border-slate-200"><td className="py-1.5">{i + 1}</td><td className="py-1.5">{it.name}</td><td className="py-1.5 text-right">{money(it.amount)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td /><td className="pt-3 text-right">Subtotal</td><td className="pt-3 text-right">{money(invoice.total)}</td></tr>
          {invoice.discount > 0 && <tr><td /><td className="text-right">Discount ({invoice.discountReason})</td><td className="text-right">−{money(invoice.discount)}</td></tr>}
          <tr><td /><td className="text-right">Paid</td><td className="text-right">−{money(st.paid)}</td></tr>
          <tr className="text-base font-extrabold text-brand-800"><td /><td className="pt-2 text-right">Balance due</td><td className="pt-2 text-right">{money(st.due)}</td></tr>
        </tfoot>
      </table>
      <div className="mt-8 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-bold text-slate-800">How to pay</p>
        <p>MTN MoMo merchant code <b>778899</b> · Telecel Cash <b>*110#</b> → School fees · GCB Bank A/C <b>1021 3040 5060</b> · Accounts office (Mon–Fri, 7:30am–4pm). Quote the invoice number as reference.</p>
      </div>
    </Paper>
  );
}

/** Invoices + payments for one student with print and pay actions. */
export function StudentStatement({ studentId, canRecord, selfService }) {
  const db = useDB();
  const [pay, setPay] = useState(false);
  const [charge, setCharge] = useState(false);
  const [discount, setDiscount] = useState(null);
  const [printInv, setPrintInv] = useState(null);
  const [printRcpt, setPrintRcpt] = useState(null);
  const invoices = db.invoices.filter((i) => i.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const payments = db.payments.filter((p) => p.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const billed = sum(invoices, invoiceNet);
  const paid = sum(payments, (p) => p.amount);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Total billed</p><p className="mt-1 text-2xl font-extrabold">{money(billed)}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Total paid</p><p className="mt-1 text-2xl font-extrabold text-emerald-600">{money(paid)}</p></Card>
        <Card className={cx('p-5', billed - paid > 0 && 'border-accent-200 bg-accent-50/50 dark:bg-accent-500/5')}>
          <p className="text-xs font-semibold uppercase text-slate-500">Balance</p>
          <p className={cx('mt-1 text-2xl font-extrabold', billed - paid > 0 ? 'text-accent-600' : 'text-emerald-600')}>{money(billed - paid)}</p>
          {(canRecord || selfService) && billed - paid > 0 && (
            <Button size="sm" className="mt-3" icon={selfService ? Smartphone : CreditCard} onClick={() => setPay(true)}>
              {selfService ? 'Pay now with MoMo' : 'Record payment'}
            </Button>
          )}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Bills" icon={Receipt} action={canRecord && <Button size="sm" variant="soft" icon={Plus} onClick={() => setCharge(true)}>Add charge</Button>} />
          <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
            {invoices.length === 0 && <EmptyState title="No invoices" />}
            {invoices.map((inv) => {
              const st = invoiceStatus(inv, db.payments);
              return (
                <div key={inv.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{invoiceTitle(inv, db.terms)}</p>
                    <p className="text-xs text-slate-500">{inv.invoiceNo} · {money(invoiceNet(inv))}{inv.discount > 0 ? ` (−${money(inv.discount)} ${inv.discountReason})` : ''}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {canRecord && <Button size="sm" variant="ghost" icon={Percent} aria-label="Discount" title="Discount / waiver" onClick={() => setDiscount(inv)} />}
                  <Button size="sm" variant="ghost" icon={Printer} onClick={() => setPrintInv(inv)} />
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments" icon={CreditCard} />
          <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
            {payments.length === 0 && <EmptyState title="No payments yet" />}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-600">{money(p.amount)}</p>
                  <p className="text-xs text-slate-500">{fmtDate(p.date)} · {p.method}{p.network ? ` · ${p.network}` : ''} · {p.receiptNo}</p>
                </div>
                <Button size="sm" variant="ghost" icon={Printer} onClick={() => setPrintRcpt(p)} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <RecordPaymentModal open={pay} onClose={() => setPay(false)} studentId={studentId} selfService={selfService} onDone={(ps) => setPrintRcpt(ps[0])} />
      {canRecord && <ChargeModal open={charge} onClose={() => setCharge(false)} studentIds={[studentId]} />}
      {canRecord && <DiscountModal invoice={discount} onClose={() => setDiscount(null)} />}
      <PrintView open={!!printInv} onClose={() => setPrintInv(null)} title="Invoice">{printInv && <InvoiceDoc invoice={printInv} />}</PrintView>
      <PrintView open={!!printRcpt} onClose={() => setPrintRcpt(null)} title="Receipt">{printRcpt && <ReceiptDoc payment={printRcpt} />}</PrintView>
    </div>
  );
}

/** Bill an extra charge to chosen students, a class, a level or every active student. */
export function ChargeModal({ open, onClose, studentIds: fixed }) {
  const db = useDB();
  const L = useLookups();
  const [v, setV] = useState({});
  const [who, setWho] = useState('students');
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    setV({ name: '', amount: '', termId: db.settings.currentTerm || '', dueDate: '' });
    setWho('students');
    setPicked([]);
    setQ('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = db.students.filter((x) => x.status === 'Active');
  const levels = SECTIONS.filter((sec) => db.classes.some((c) => c.section === sec));
  const targets = fixed
    ? fixed
    : who === 'students' ? picked
    : who === 'class' ? active.filter((x) => x.classId === v.classId).map((x) => x.id)
    : who === 'level' ? active.filter((x) => L.cls(x.classId)?.section === v.level).map((x) => x.id)
    : active.map((x) => x.id);
  const amount = Number(v.amount) || 0;
  const list = q.trim() ? active.filter((x) => `${fullName(x)} ${x.admissionNo} ${L.className(x.classId)}`.toLowerCase().includes(q.toLowerCase())) : active;
  const save = () => {
    if (!v.name?.trim()) return toast.error('Enter what the charge is for', 'e.g. Excursion to Cape Coast');
    if (amount <= 0) return toast.error('Enter the amount');
    if (!targets.length) return toast.error('Choose who pays', 'Tick at least one student');
    const recs = chargeStudents(targets, [{ name: v.name, amount }], { termId: v.termId, dueDate: v.dueDate || TODAY });
    toast.success('Charge added', `${v.name.trim()} · ${money(amount)} to ${recs.length} student${recs.length === 1 ? '' : 's'}`);
    onClose();
  };
  const set = (k) => (e) => setV({ ...v, [k]: e?.target ? e.target.value : e });
  return (
    <Modal open={open} onClose={onClose} title="Add a charge" subtitle={fixed?.length === 1 ? `For ${L.studentName(fixed[0])} only` : 'Billed only to the students you choose'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={CheckCircle2} onClick={save}>Bill {targets.length} student{targets.length === 1 ? '' : 's'}{amount ? ` · ${money(amount * targets.length)}` : ''}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is it for? *" className="sm:col-span-2"><Combo value={v.name || ''} onChange={set('name')} options={CHARGE_SUGGESTIONS} placeholder="e.g. Excursion, Exam fee, Uniform" /></Field>
        <Field label="Amount per student *"><Input type="number" min="0" value={v.amount ?? ''} onChange={set('amount')} placeholder="0.00" /></Field>
        <Field label="Due date"><Input type="date" value={v.dueDate || ''} onChange={set('dueDate')} /></Field>
        <Field label="Term" className="sm:col-span-2"><Select value={v.termId || ''} onChange={set('termId')} placeholder="No term" options={db.terms.map((t) => ({ value: t.id, label: t.name }))} /></Field>
      </div>
      {!fixed && (
        <div className="mt-5">
          <span className="label">Who pays?</span>
          <div className="mb-3 flex flex-wrap gap-2">
            {[['students', 'Chosen students'], ['class', 'A class'], ['level', 'A level'], ['all', 'Every active student']].map(([k, label]) => (
              <button type="button" key={k} onClick={() => setWho(k)} className={cx('rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset', who === k ? 'bg-brand-600 text-white ring-brand-600' : 'text-slate-600 ring-slate-200 dark:text-slate-300 dark:ring-white/10')}>{label}</button>
            ))}
          </div>
          {who === 'class' && <Select value={v.classId || ''} onChange={set('classId')} placeholder="Choose a class" options={db.classes.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => ({ value: c.id, label: c.name }))} />}
          {who === 'level' && <Select value={v.level || ''} onChange={set('level')} placeholder="Choose a level" options={levels} />}
          {who === 'students' && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 border-b border-slate-100 p-2 dark:border-white/5">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, admission no. or class" className="!py-2" />
                <span className="shrink-0 px-2 text-xs font-semibold text-slate-500">{picked.length} ticked</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {list.slice(0, 300).map((x) => (
                  <label key={x.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={picked.includes(x.id)} onChange={() => setPicked((p) => (p.includes(x.id) ? p.filter((y) => y !== x.id) : [...p, x.id]))} />
                    <span className="flex-1 font-medium">{fullName(x)}</span>
                    <span className="text-xs text-slate-400">{L.className(x.classId)} · {x.admissionNo}</span>
                  </label>
                ))}
                {!list.length && <p className="p-3 text-sm text-slate-500">No students found.</p>}
              </div>
            </div>
          )}
          {who !== 'students' && <p className="mt-2 text-sm text-slate-500">{targets.length} active student{targets.length === 1 ? '' : 's'} will be billed.</p>}
        </div>
      )}
    </Modal>
  );
}

/** Discount or waiver on one bill (scholarship, staff child, sibling discount…). */
export function DiscountModal({ invoice, onClose }) {
  const db = useDB();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (invoice) { setAmount(invoice.discount || ''); setReason(invoice.discountReason || ''); }
  }, [invoice]);
  const total = Number(invoice?.total) || 0;
  const save = () => {
    const d = Number(amount) || 0;
    if (d < 0 || d > total) return toast.error('Check the amount', `The discount must be between 0 and ${money(total)}`);
    if (d > 0 && !reason.trim()) return toast.error('Give a reason', 'e.g. Scholarship, staff child, sibling discount');
    db.update('invoices', invoice.id, { discount: d, discountReason: d ? reason.trim() : '' });
    toast.success(d ? 'Discount saved' : 'Discount removed', d ? `${money(d)} off ${invoice.invoiceNo}` : invoice.invoiceNo);
    onClose();
  };
  return (
    <Modal open={!!invoice} onClose={onClose} title="Discount / waiver" subtitle={invoice ? `${invoice.invoiceNo} · bill ${money(total)}` : ''} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={CheckCircle2} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Amount off"><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <div className="flex flex-wrap gap-2">
          {[25, 50, 100].map((p) => <Button key={p} size="sm" variant="secondary" onClick={() => setAmount(Math.round((total * p) / 100 * 100) / 100)}>{p === 100 ? 'Full waiver' : `${p}%`}</Button>)}
        </div>
        <Field label="Reason"><Combo value={reason} onChange={setReason} options={['Scholarship', 'Staff child', 'Sibling discount', 'Bursary', 'Management decision', 'Billing correction']} /></Field>
        <p className="text-xs text-slate-500">New amount due on this bill: <b>{money(Math.max(0, total - (Number(amount) || 0)))}</b> (before payments).</p>
      </div>
    </Modal>
  );
}

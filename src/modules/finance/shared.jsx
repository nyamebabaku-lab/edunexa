import { useState, useEffect } from 'react';
import { Receipt, Printer, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, invoiceNet, invoicePaid, TODAY } from '../../data/selectors';
import { money, fmtDate, fullName, sum, uid } from '../../lib/format';
import { Button, Badge, Card, CardHeader, Field, Input, Modal, Select, Textarea, toast, cx, EmptyState } from '../../components/ui';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

export const METHODS = ['Mobile Money', 'Cash', 'Bank Transfer', 'Cheque', 'Card'];
export const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AT Money'];

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
          <p>Term: <b>{db.terms.find((t) => t.id === invoice.termId)?.name}</b></p>
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
          <CardHeader title="Invoices" icon={Receipt} />
          <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
            {invoices.length === 0 && <EmptyState title="No invoices" />}
            {invoices.map((inv) => {
              const st = invoiceStatus(inv, db.payments);
              return (
                <div key={inv.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{db.terms.find((t) => t.id === inv.termId)?.name}</p>
                    <p className="text-xs text-slate-500">{inv.invoiceNo} · {money(invoiceNet(inv))}</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
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
      <PrintView open={!!printInv} onClose={() => setPrintInv(null)} title="Invoice">{printInv && <InvoiceDoc invoice={printInv} />}</PrintView>
      <PrintView open={!!printRcpt} onClose={() => setPrintRcpt(null)} title="Receipt">{printRcpt && <ReceiptDoc payment={printRcpt} />}</PrintView>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Download, Printer, GraduationCap, Wallet, ClipboardCheck, Award, BookOpen, Package, Receipt, Users, UtensilsCrossed } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, invoiceNet, loanStatus, sortedClasses, attendanceStats } from '../../data/selectors';
import { money, pct, sum, groupBy, fullName, fmtDate, downloadCSV } from '../../lib/format';
import { classResults } from '../../lib/results';
import { invoiceStatus } from '../finance/shared';
import { Card, PageHeader, Button, DataTable, cx } from '../../components/ui';

function useReports() {
  const db = useDB();
  return useMemo(() => {
    const term = db.settings.currentTerm;
    const classes = sortedClasses(db.classes);
    const stuIn = (cid) => db.students.filter((s) => s.classId === cid && s.status === 'Active');
    return {
      enrolment: { title: 'Enrolment by class', icon: GraduationCap, finance: false, rows: () => classes.map((c) => { const st = stuIn(c.id); return { Class: c.name, Section: c.section, Boys: st.filter((s) => s.gender === 'Male').length, Girls: st.filter((s) => s.gender === 'Female').length, Total: st.length, Boarders: st.filter((s) => s.boarding === 'Boarder').length, Capacity: c.capacity }; }) },
      fees: { title: 'Fee collection by class (this term)', icon: Wallet, finance: true, rows: () => classes.map((c) => { const ids = new Set(stuIn(c.id).map((s) => s.id)); const inv = db.invoices.filter((i) => i.termId === term && ids.has(i.studentId)); const billed = sum(inv, invoiceNet); const paid = sum(inv, (i) => invoiceStatus(i, db.payments).paid); return { Class: c.name, Bills: inv.length, Billed: money(billed), Collected: money(paid), Outstanding: money(billed - paid), 'Rate %': pct(paid, billed) }; }) },
      attendance: { title: 'Attendance by class', icon: ClipboardCheck, finance: false, rows: () => classes.map((c) => { const st = stuIn(c.id); const recs = db.attendance.filter((a) => a.classId === c.id); const stats = st.map((s) => attendanceStats(recs, s.id)); return { Class: c.name, Students: st.length, 'Avg rate %': stats.length ? Math.round(sum(stats, (x) => x.rate) / stats.length) : 0, Absences: sum(stats, (x) => x.A), Lates: sum(stats, (x) => x.L), 'Below 85%': stats.filter((x) => x.rate < 85).length }; }) },
      academics: { title: 'Academic performance by class', icon: Award, finance: false, rows: () => classes.map((c) => { const r = classResults(db, c.id, term); const avgs = r.rows.map((x) => x.average); const top = r.rows[0]; return { Class: c.name, Students: r.rows.length, 'Class avg %': avgs.length ? Math.round(sum(avgs) / avgs.length) : 0, 'Highest %': avgs.length ? Math.max(...avgs) : 0, 'Lowest %': avgs.length ? Math.min(...avgs) : 0, 'Top student': top ? fullName(top.student) : '—' }; }) },
      library: { title: 'Overdue library books', icon: BookOpen, finance: false, rows: () => db.loans.filter((l) => loanStatus(l).label === 'Overdue').map((l) => { const st = loanStatus(l, db.settings.libraryFinePerDay); const s = db.students.find((x) => x.id === l.memberId); const f = db.staff.find((x) => x.id === l.memberId); return { Book: db.books.find((b) => b.id === l.bookId)?.title, Borrower: s ? fullName(s) : `${f?.firstName} ${f?.lastName}`, Due: fmtDate(l.dueDate), 'Days late': st.late, Fine: money(st.fine) }; }) },
      stock: { title: 'Stock valuation', icon: Package, finance: true, rows: () => db.storeItems.map((i) => ({ Item: i.name, Category: i.category, Stock: i.stock, 'Unit cost': money(i.cost), 'Cost value': money(i.stock * i.cost), 'Retail value': money(i.stock * i.price) })) },
      expenses: { title: 'Expenditure by category', icon: Receipt, finance: true, rows: () => Object.entries(groupBy(db.expenses, (e) => e.category)).map(([k, v]) => ({ Category: k, Transactions: v.length, Total: money(sum(v, (e) => e.amount)), Largest: money(Math.max(...v.map((e) => e.amount))) })) },
      canteen: { title: 'Canteen income by day', icon: UtensilsCrossed, roles: ['admin', 'accountant', 'canteen'], rows: () => Object.entries(groupBy(db.canteenSales, (c) => c.date)).sort(([a], [b]) => b.localeCompare(a)).map(([date, list]) => { const purchases = sum(db.canteenStockMoves.filter((m) => m.type === 'Purchase' && m.date === date), (m) => m.cost); const rev = sum(list, (c) => c.total); return { Date: fmtDate(date, 'EEE d MMM yyyy'), Orders: list.length, Cash: money(sum(list.filter((c) => c.method === 'Cash'), (c) => c.total)), MoMo: money(sum(list.filter((c) => c.method === 'Mobile Money'), (c) => c.total)), 'Billed to fees': money(sum(list.filter((c) => c.method === 'Bill to fees'), (c) => c.total)), Revenue: money(rev), Purchases: money(purchases), Net: money(rev - purchases) }; }) },
      staff: { title: 'Staff establishment', icon: Users, finance: true, rows: () => Object.entries(groupBy(db.staff, (s) => s.role)).map(([k, v]) => ({ Role: k, Count: v.length, Male: v.filter((s) => s.gender === 'Male').length, Female: v.filter((s) => s.gender === 'Female').length, 'Monthly cost': money(sum(v, (s) => s.salary + (s.allowances || 0))) })) },
    };
  }, [db]);
}

export default function Reports() {
  const reports = useReports();
  const user = useCurrentUser();
  const allowed = (r) => (r.roles ? r.roles.includes(user.role) : user.role === 'admin' || user.role === 'headteacher' || (r.finance && user.role === 'accountant'));
  const keys = Object.keys(reports).filter((k) => allowed(reports[k]));
  const [key, setKey] = useState(keys[0]);
  const rep = reports[key];
  const rows = useMemo(() => rep.rows().map((r, i) => ({ id: i, ...r })), [rep]);
  const cols = rows[0] ? Object.keys(rows[0]).filter((k) => k !== 'id').map((k, i) => ({ key: k, label: k, render: i === 0 ? (r) => <span className="font-semibold">{r[k]}</span> : undefined })) : [];
  return (
    <>
      <PageHeader title="Reports" subtitle="Cross-module summaries — export to CSV or print"
        actions={<><Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button><Button icon={Download} onClick={() => downloadCSV(rep.title, rows.map(({ id, ...r }) => r))}>Export CSV</Button></>} />
      <div className="no-print mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {keys.map((k) => {
          const R = reports[k];
          return (
            <button key={k} onClick={() => setKey(k)} className={cx('card flex items-center gap-3 p-4 text-left transition hover:shadow-lift', k === key && '!border-brand-500 ring-4 ring-brand-500/10')}>
              <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', k === key ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15')}><R.icon className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{R.title}</span>
            </button>
          );
        })}
      </div>
      <h2 className="mb-3 text-lg font-extrabold text-slate-900 dark:text-white">{rep.title}</h2>
      {rows.length ? <DataTable rows={rows} columns={cols} pageSize={30} /> : <Card className="p-10 text-center text-slate-500">No data for this report.</Card>}
    </>
  );
}

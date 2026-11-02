import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { BookOpen, BookUp, AlertCircle, Wallet, Undo2, Library as LibIcon } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, loanStatus, TODAY } from '../../data/selectors';
import { fmtDate, money, fullName, sum } from '../../lib/format';
import { PageHeader, Tabs, Badge, Button, StatCard, Modal, Field, Select, DataTable, toast } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

export default function LibraryPage() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const isStudent = user.role === 'student';
  const [tab, setTab] = useState(isStudent ? 'mine' : 'loans');
  const [issue, setIssue] = useState(null);
  const fine = db.settings.libraryFinePerDay;
  const onLoan = (bid) => db.loans.filter((l) => l.bookId === bid && !l.returnDate).length;
  const memberName = (l) => (l.memberType === 'Staff' ? L.staffName(l.memberId) : L.studentName(l.memberId));
  const open = db.loans.filter((l) => !l.returnDate);
  const overdue = open.filter((l) => loanStatus(l, fine).label === 'Overdue');

  const doIssue = () => {
    if (!issue.bookId || !issue.memberId) return toast.error('Select a book and a borrower');
    const b = db.books.find((x) => x.id === issue.bookId);
    if (onLoan(b.id) >= b.copies) return toast.error('No copies available', b.title);
    db.add('loans', { ...issue, issueDate: TODAY, dueDate: format(addDays(parseISO(TODAY), db.settings.loanDays), 'yyyy-MM-dd'), returnDate: null, finePaid: 0 });
    toast.success('Book issued', `Due ${fmtDate(addDays(parseISO(TODAY), db.settings.loanDays))}`);
    setIssue(null);
  };
  const doReturn = (l) => {
    const st = loanStatus(l, fine);
    db.update('loans', l.id, { returnDate: TODAY, finePaid: st.fine });
    toast.success('Book returned', st.fine ? `Fine collected: ${money(st.fine)}` : 'No fine');
  };

  const catalogue = (
    <DataTable
      rows={db.books}
      searchText={(b) => `${b.title} ${b.author} ${b.category} ${b.isbn}`}
      columns={[
        { key: 'title', label: 'Title', render: (b) => <div><p className="font-semibold">{b.title}</p><p className="text-xs text-slate-500">{b.author}</p></div> },
        { key: 'category', label: 'Category', render: (b) => <Badge tone="blue">{b.category}</Badge> },
        { key: 'shelf', label: 'Shelf', hideOnMobile: true },
        { key: 'avail', label: 'Available', sort: (b) => b.copies - onLoan(b.id), render: (b) => { const a = b.copies - onLoan(b.id); return <Badge tone={a > 0 ? 'green' : 'red'}>{a}/{b.copies}</Badge>; } },
      ]}
    />
  );

  if (isStudent) {
    const mine = db.loans.filter((l) => l.memberId === user.linkedId);
    return (
      <>
        <PageHeader title="Library" subtitle="Browse the catalogue and track your loans" />
        <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'mine', label: 'My loans', count: mine.filter((l) => !l.returnDate).length }, { value: 'catalogue', label: 'Catalogue' }]} />
        {tab === 'mine' ? (
          <DataTable rows={mine} search={false} columns={[
            { key: 'book', label: 'Book', render: (l) => <span className="font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</span> },
            { key: 'issueDate', label: 'Issued', render: (l) => fmtDate(l.issueDate) },
            { key: 'dueDate', label: 'Due', render: (l) => fmtDate(l.dueDate) },
            { key: 'status', label: 'Status', render: (l) => { const s = loanStatus(l, fine); return <Badge tone={s.tone}>{s.label}{s.fine ? ` · ${money(s.fine)}` : ''}</Badge>; } },
          ]} />
        ) : catalogue}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Library" subtitle="Catalogue, borrowing, returns and fines" actions={<Button icon={BookUp} onClick={() => setIssue({ memberType: 'Student' })}>Issue book</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Titles / copies" value={`${db.books.length} / ${sum(db.books, (b) => b.copies)}`} icon={BookOpen} />
        <StatCard label="On loan" value={open.length} icon={LibIcon} tone="navy" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertCircle} tone="red" />
        <StatCard label="Fines (accruing / collected)" value={`${money(sum(overdue, (l) => loanStatus(l, fine).fine))}`} icon={Wallet} tone="amber" sub={`${money(sum(db.loans, (l) => l.finePaid))} collected`} />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'loans', label: 'Loans', count: open.length }, { value: 'catalogue', label: 'Catalogue' }, { value: 'books', label: 'Manage books' }]} />
      {tab === 'loans' && (
        <DataTable
          rows={db.loans}
          initialSort={{ key: 'status', dir: 'desc' }}
          searchText={(l) => `${db.books.find((b) => b.id === l.bookId)?.title} ${memberName(l)}`}
          columns={[
            { key: 'book', label: 'Book', sort: (l) => db.books.find((b) => b.id === l.bookId)?.title, render: (l) => <span className="font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</span> },
            { key: 'member', label: 'Borrower', sort: memberName, render: (l) => <div><p>{memberName(l)}</p><p className="text-xs text-slate-500">{l.memberType}{l.memberType === 'Student' ? ` · ${L.studentClass(l.memberId)?.name}` : ''}</p></div> },
            { key: 'issueDate', label: 'Issued', hideOnMobile: true, render: (l) => fmtDate(l.issueDate) },
            { key: 'dueDate', label: 'Due', render: (l) => fmtDate(l.dueDate) },
            { key: 'status', label: 'Status', sort: (l) => loanStatus(l, fine).late + (l.returnDate ? -1000 : 0), render: (l) => { const s = loanStatus(l, fine); return <Badge tone={s.tone}>{s.label}{s.late ? ` · ${s.late}d` : ''}{s.fine ? ` · ${money(s.fine)}` : ''}</Badge>; } },
            { key: 'act', label: '', nosort: true, render: (l) => !l.returnDate && <Button size="sm" variant="soft" icon={Undo2} onClick={() => doReturn(l)}>Return</Button> },
          ]}
        />
      )}
      {tab === 'catalogue' && catalogue}
      {tab === 'books' && (
        <CrudPage collection="books" noun="book" defaults={{ copies: 1, category: 'Literature' }}
          fields={[
            { name: 'title', label: 'Title', required: true, span: 2 }, { name: 'author', label: 'Author', required: true },
            { name: 'category', label: 'Category', type: 'select', options: ['Literature', "Children's", 'Textbook', 'Business', 'Computing', 'History', 'Reference', 'Science'] },
            { name: 'isbn', label: 'ISBN' }, { name: 'publisher', label: 'Publisher' }, { name: 'year', label: 'Year', type: 'number' },
            { name: 'copies', label: 'Copies', type: 'number', required: true }, { name: 'shelf', label: 'Shelf' },
          ]}
          columns={[
            { key: 'title', label: 'Title', render: (b) => <span className="font-semibold">{b.title}</span> },
            { key: 'author', label: 'Author' },
            { key: 'isbn', label: 'ISBN', hideOnMobile: true, render: (b) => <span className="font-mono text-xs">{b.isbn}</span> },
            { key: 'copies', label: 'Copies' },
            { key: 'shelf', label: 'Shelf', hideOnMobile: true },
          ]}
        />
      )}
      <Modal open={!!issue} onClose={() => setIssue(null)} title="Issue book" size="sm" footer={<><Button variant="secondary" onClick={() => setIssue(null)}>Cancel</Button><Button onClick={doIssue}>Issue for {db.settings.loanDays} days</Button></>}>
        {issue && (
          <div className="space-y-4">
            <Field label="Book"><Select value={issue.bookId || ''} onChange={(e) => setIssue({ ...issue, bookId: e.target.value })} placeholder="Select book…" options={db.books.map((b) => ({ value: b.id, label: `${b.title} (${b.copies - onLoan(b.id)} available)` }))} /></Field>
            <Field label="Borrower type"><Select value={issue.memberType} onChange={(e) => setIssue({ ...issue, memberType: e.target.value, memberId: '' })} options={['Student', 'Staff']} /></Field>
            <Field label="Borrower"><Select value={issue.memberId || ''} onChange={(e) => setIssue({ ...issue, memberId: e.target.value })} placeholder="Select…"
              options={issue.memberType === 'Staff' ? db.staff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` })) : [...db.students].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }))} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

// Derived data helpers shared across modules.
import { useMemo } from 'react';
import { useDB, useSession } from './store';
import { fullName, sum, daysBetween } from '../lib/format';
import { TODAY } from './seed';

export { TODAY };

export const useCurrentUser = () => {
  const userId = useSession((s) => s.userId);
  const users = useDB((s) => s.users);
  return users.find((u) => u.id === userId) || null;
};

export const useLookups = () => {
  const students = useDB((s) => s.students);
  const classes = useDB((s) => s.classes);
  const subjects = useDB((s) => s.subjects);
  const staff = useDB((s) => s.staff);
  const parents = useDB((s) => s.parents);
  return useMemo(() => {
    const m = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    const S = m(students);
    const C = m(classes);
    const SU = m(subjects);
    const ST = m(staff);
    const P = m(parents);
    return {
      student: (id) => S[id],
      cls: (id) => C[id],
      subject: (id) => SU[id],
      staff: (id) => ST[id],
      parent: (id) => P[id],
      studentName: (id) => fullName(S[id]),
      staffName: (id) => (ST[id] ? `${ST[id].title} ${ST[id].firstName} ${ST[id].lastName}` : '—'),
      className: (id) => C[id]?.name || '—',
      subjectName: (id) => SU[id]?.name || '—',
      parentName: (id) => (P[id] ? `${P[id].title} ${P[id].firstName} ${P[id].lastName}` : '—'),
      studentClass: (id) => C[S[id]?.classId],
    };
  }, [students, classes, subjects, staff, parents]);
};

/** Parent record ids of a student's guardians (up to two parent accounts). */
export const guardianIds = (s) => [s?.parentId, s?.parentId2].filter(Boolean);
export const isGuardianOf = (s, parentId) => !!parentId && (s.parentId === parentId || s.parentId2 === parentId);

export const sortedClasses = (classes) => [...classes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

/** Lesson periods and breaks in time order. */
export const sortedPeriods = (periods) => [...(periods || [])].sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

export const invoiceNet = (inv) => (inv.total || 0) - (inv.discount || 0);

/** Fee position per student: billed, paid, balance (all terms). */
export function useBalances() {
  const invoices = useDB((s) => s.invoices);
  const payments = useDB((s) => s.payments);
  return useMemo(() => {
    const billed = {};
    const paid = {};
    invoices.forEach((i) => (billed[i.studentId] = (billed[i.studentId] || 0) + invoiceNet(i)));
    payments.forEach((p) => (paid[p.studentId] = (paid[p.studentId] || 0) + Number(p.amount)));
    const get = (id) => ({ billed: billed[id] || 0, paid: paid[id] || 0, balance: (billed[id] || 0) - (paid[id] || 0) });
    return { get, totalBilled: sum(Object.values(billed)), totalPaid: sum(Object.values(paid)) };
  }, [invoices, payments]);
}

export const invoicePaid = (inv, payments) => sum(payments.filter((p) => p.invoiceId === inv.id), (p) => p.amount);

export function loanStatus(loan, finePerDay = 1) {
  if (loan.returnDate) {
    const late = Math.max(0, daysBetween(loan.dueDate, loan.returnDate));
    return { label: 'Returned', tone: 'slate', late, fine: late * finePerDay };
  }
  const late = Math.max(0, daysBetween(loan.dueDate, TODAY));
  return late > 0 ? { label: 'Overdue', tone: 'red', late, fine: late * finePerDay } : { label: 'On loan', tone: 'blue', late: 0, fine: 0 };
}

export function attendanceStats(attendance, studentId) {
  let p = 0;
  let total = 0;
  const marks = { P: 0, A: 0, L: 0, E: 0 };
  attendance.forEach((a) => {
    const v = a.records[studentId];
    if (!v) return;
    total++;
    marks[v]++;
    if (v === 'P' || v === 'L') p++;
  });
  return { ...marks, total, rate: total ? Math.round((p / total) * 100) : 0 };
}

/** The student a parent/student portal is focused on. */
export function usePortalStudent() {
  const user = useCurrentUser();
  const childId = useSession((s) => s.childId);
  const students = useDB((s) => s.students);
  if (!user) return { student: null, children: [] };
  if (user.role === 'student') return { student: students.find((s) => s.id === user.linkedId), children: [] };
  if (user.role === 'parent') {
    const children = students.filter((s) => isGuardianOf(s, user.linkedId));
    return { student: children.find((c) => c.id === childId) || children[0], children };
  }
  return { student: null, children: [] };
}

export const stockLevel = (item) =>
  item.stock <= 0 ? { label: 'Out of stock', tone: 'red' } : item.stock <= item.reorderLevel ? { label: 'Low stock', tone: 'amber' } : { label: 'In stock', tone: 'green' };

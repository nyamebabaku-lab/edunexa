import { format, parseISO, differenceInYears, differenceInCalendarDays } from 'date-fns';

const ghs = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Currency symbol follows the school's settings (set once per render in App).
let CUR = 'GH₵';
export const setCurrencySymbol = (sym) => {
  CUR = sym || 'GH₵';
};
export const currencySymbol = () => CUR;

export const money = (n) => `${CUR} ${ghs.format(Number(n) || 0)}`;
export const compactNum = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
};
export const moneyShort = (n) => `${CUR} ${compactNum(n)}`;

const toDate = (d) => (d instanceof Date ? d : parseISO(d));

export const fmtDate = (d, f = 'dd MMM yyyy') => {
  if (!d) return '—';
  try {
    return format(toDate(d), f);
  } catch {
    return String(d);
  }
};
export const fmtDateTime = (d) => fmtDate(d, 'dd MMM yyyy, HH:mm');
export const age = (dob) => (dob ? differenceInYears(new Date(), toDate(dob)) : '—');
export const daysBetween = (a, b) => differenceInCalendarDays(toDate(b), toDate(a));
export const today = () => format(new Date(), 'yyyy-MM-dd');
export const nowISO = () => new Date().toISOString();

export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const fullName = (p) => (p ? [p.firstName, p.otherNames, p.lastName].filter(Boolean).join(' ') : '—');
export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
export const groupBy = (arr, fn) =>
  arr.reduce((acc, x) => {
    const k = fn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

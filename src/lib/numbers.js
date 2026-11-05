// School numbering: admission numbers like BSA/26/0001 and staff numbers like BSA/ST/001,
// using each school's own initials (Settings → School profile).
import { TODAY } from '../data/seed';

const SMALL = new Set(['of', 'the', 'and', 'for', '&', 'de', 'la']);

/** "Bright Stars Academy" → "BSA"; "St. Mary's School of Nursing" → "SMSN" (max 5 letters). */
export function initialsFrom(name = '') {
  const words = String(name).replace(/[^A-Za-z0-9\s'-]/g, ' ').split(/\s+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
  const s = words.map((w) => w[0]).join('').toUpperCase().slice(0, 5);
  return s || 'SCH';
}

/** The school's prefix: what the owner typed in Settings, or the initials of the school name. */
export const schoolPrefix = (settings) => (settings?.initials || '').trim().toUpperCase() || initialsFrom(settings?.schoolName);

/** Next free admission number for the year a student joins (default: this year). */
export function nextAdmissionNo(db, year = TODAY.slice(2, 4)) {
  const pre = `${schoolPrefix(db.settings)}/${year}/`;
  const used = db.students.map((s) => s.admissionNo || '').filter((n) => n.toUpperCase().startsWith(pre.toUpperCase())).map((n) => parseInt(n.slice(pre.length), 10) || 0);
  return `${pre}${String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')}`;
}

export function nextStaffNo(db) {
  const pre = `${schoolPrefix(db.settings)}/ST/`;
  const used = db.staff.map((s) => s.staffNo || '').filter((n) => n.toUpperCase().startsWith(pre.toUpperCase())).map((n) => parseInt(n.slice(pre.length), 10) || 0);
  return `${pre}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
}

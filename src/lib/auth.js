// Sign-in, sign-up and verification rules. In this prototype everything runs in the browser;
// a production backend must re-check all of this server-side.
import { uid, nowISO } from './format';

export const DEFAULT_PASSWORD = 'demo1234';

/** Non-cryptographic hash, adequate only for the offline prototype. */
export function hashPassword(pw) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const s = `edunexa:${pw}`;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0;
  }
  return `h1$${h1.toString(16)}${h2.toString(16)}`;
}

export const checkPassword = (user, pw) => (user.passwordHash ? user.passwordHash === hashPassword(pw) : pw === DEFAULT_PASSWORD);

export function passwordProblems(pw, auth) {
  const out = [];
  if ((pw || '').length < auth.minPasswordLength) out.push(`at least ${auth.minPasswordLength} characters`);
  if (auth.requireNumber && !/\d/.test(pw || '')) out.push('at least one number');
  return out;
}

const digits = (s) => (s || '').replace(/\D/g, '');
const samePhone = (a, b) => digits(a) && digits(a).slice(-9) === digits(b).slice(-9);

const STAFF_ROLE = {
  Administrator: 'admin', Teacher: 'teacher', Accountant: 'accountant', Librarian: 'librarian', Storekeeper: 'storekeeper',
  'Transport Officer': 'transport', 'Canteen Manager': 'canteen', 'Head Teacher': 'headteacher', 'Hostel Manager': 'hostel',
};
export const portalRoleForStaff = (s) => STAFF_ROLE[s.role] || 'staff';

/**
 * Finds the account for an email, phone number or admission number.
 * Returns { user } for an existing account, { provision } for a staff member or student
 * who can sign in but has no account yet, or {} when nothing matches.
 */
export function findAccount(db, identifier) {
  const id = (identifier || '').trim();
  if (!id) return {};
  const lower = id.toLowerCase();
  const user = db.users.find((u) => (u.email && u.email.toLowerCase() === lower) || samePhone(u.phone, id));
  if (user) return { user };
  const student = db.students.find((s) => s.admissionNo.toLowerCase() === lower);
  if (student) {
    const existing = db.users.find((u) => u.role === 'student' && u.linkedId === student.id);
    if (existing) return { user: existing };
    if (!db.settings.auth.allowStudentLogin) return { blocked: 'Student sign-in is turned off for this school.' };
    return { provision: { role: 'student', linkedId: student.id, name: `${student.firstName} ${student.lastName}`, email: '', phone: '', username: student.admissionNo } };
  }
  const staff = db.staff.find((s) => (s.email || '').toLowerCase() === lower || samePhone(s.phone, id));
  if (staff) {
    const existing = db.users.find((u) => u.linkedId === staff.id);
    if (existing) return { user: existing };
    return { provision: { role: portalRoleForStaff(staff), linkedId: staff.id, name: `${staff.title} ${staff.firstName} ${staff.lastName}`, email: staff.email, phone: staff.phone } };
  }
  const parent = db.parents.find((p) => samePhone(p.phone, id) || (p.email || '').toLowerCase() === lower);
  if (parent) return { noAccount: 'parent', parent };
  return {};
}

export const newUserRecord = (p) => ({ id: uid('usr'), status: 'Active', lastLogin: null, createdAt: nowISO(), ...p });

export function needsOtp(role, auth) {
  if (auth.otp === 'all') return true;
  if (auth.otp === 'admins') return ['admin', 'superadmin', 'accountant'].includes(role);
  return false;
}

export const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const maskContact = (user) => {
  if (user.phone) return `${user.phone.slice(0, 3)}****${user.phone.slice(-3)}`;
  if (user.email) return user.email.replace(/^(.).*(@.*)$/, '$1•••$2');
  return 'your registered contact';
};

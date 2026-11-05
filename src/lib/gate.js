// Gate attendance: rotating gate QR codes, personal ID badges and clock-in/out rules.
import { format } from 'date-fns';
import { useDB } from '../data/store';
import { TODAY } from '../data/seed';
import { nowISO } from './format';

const PREFIX = 'EDX1';

function sig(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export const slotNow = (seconds) => Math.floor(Date.now() / 1000 / seconds);

/** The gate QR payload for a time slot. It changes every `rotateSeconds`. */
export function gateToken(gate, slot = slotNow(gate.rotateSeconds)) {
  return `${PREFIX}|GATE|${slot}|${sig(`${gate.secret}|${slot}`).toString(36)}`;
}
/** Six-digit code shown under the QR for people who can't scan. */
export function gateCode(gate, slot = slotNow(gate.rotateSeconds)) {
  return String(sig(`${gate.secret}|code|${slot}`) % 1000000).padStart(6, '0');
}

/** Accepts the current or previous slot, so a code is valid for up to two rotations. */
export function verifyGate(text, gate) {
  const now = slotNow(gate.rotateSeconds);
  const t = (text || '').trim();
  for (const slot of [now, now - 1]) {
    if (t === gateToken(gate, slot) || t === gateCode(gate, slot)) return { ok: true };
  }
  if (t.startsWith(`${PREFIX}|GATE|`)) return { ok: false, reason: 'This gate code has expired. Scan the code on the screen again.' };
  if (t.startsWith(`${PREFIX}|ID|`)) return { ok: false, reason: 'That is an ID badge. Scan the QR code shown on the gate screen instead.' };
  return { ok: false, reason: 'That is not a valid gate code.' };
}

export const badgeToken = (personType, id) => `${PREFIX}|ID|${personType === 'Student' ? 'S' : 'T'}|${id}`;
export function parseBadge(text) {
  const m = /^EDX1\|ID\|([ST])\|(.+)$/.exec((text || '').trim());
  return m ? { personType: m[1] === 'S' ? 'Student' : 'Staff', personId: m[2] } : null;
}

/** The person a signed-in user clocks in as, if any. */
export function personForUser(user) {
  if (!user?.linkedId) return null;
  if (user.role === 'student') return { personType: 'Student', personId: user.linkedId };
  if (user.role === 'parent' || user.role === 'superadmin') return null;
  return { personType: 'Staff', personId: user.linkedId };
}

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Records a gate scan. The first scan of the day clocks in, the next clocks out.
 * Returns { action: 'in' | 'out' | 'repeat' | 'done' | 'unknown', record, name, late }.
 */
export function clock(personType, personId, method) {
  const db = useDB.getState();
  const s = db.settings;
  const person = personType === 'Student' ? db.students.find((x) => x.id === personId) : db.staff.find((x) => x.id === personId);
  if (!person) return { action: 'unknown' };
  const name = `${person.firstName} ${person.lastName}`;
  const now = new Date();
  const time = format(now, 'HH:mm');
  const id = `${TODAY}|${personType}|${personId}`;
  const existing = db.clockings.find((c) => c.id === id);

  if (!existing) {
    const late = minutes(time) > minutes(s.gate.startTime);
    const record = { id, date: TODAY, personType, personId, in: time, out: null, inMethod: method, outMethod: null, late, gate: s.gate.name, inAt: nowISO() };
    db.add('clockings', record);
    if (personType === 'Student') {
      if (s.gate.autoRegister) markRegister(person, late ? 'L' : 'P');
      if (s.gate.notifyParents) {
        const parent = db.parents.find((p) => p.id === person.parentId);
        if (parent?.phone) db.add('smsLog', { date: nowISO(), audience: `Parent of ${name}`, message: `${s.schoolName}: ${person.firstName} arrived at school at ${time}${late ? ' (late)' : ''}.`, to: [parent.phone], recipients: 1, status: 'Delivered' });
      }
    }
    return { action: 'in', record, name, late };
  }
  if (existing.out) return { action: 'done', record: existing, name };
  if (existing.inAt && Date.now() - new Date(existing.inAt).getTime() < 60_000) return { action: 'repeat', record: existing, name };
  db.update('clockings', id, { out: time, outMethod: method });
  if (personType === 'Student' && s.gate.notifyParents) {
    const parent = db.parents.find((p) => p.id === person.parentId);
    if (parent?.phone) db.add('smsLog', { date: nowISO(), audience: `Parent of ${name}`, message: `${s.schoolName}: ${person.firstName} left school at ${time}.`, to: [parent.phone], recipients: 1, status: 'Delivered' });
  }
  return { action: 'out', record: { ...existing, out: time }, name };
}

/** Ticks the student present/late in today's class register, keeping marks a teacher already made. */
function markRegister(student, mark) {
  const db = useDB.getState();
  const rid = `${TODAY}|${student.classId}`;
  const reg = db.attendance.find((a) => a.id === rid);
  if (!reg) {
    db.add('attendance', { id: rid, date: TODAY, classId: student.classId, records: { [student.id]: mark }, takenBy: 'gate' });
    return;
  }
  const current = reg.records[student.id];
  if (current === 'P' || current === 'L' || current === 'E') return;
  db.update('attendance', rid, { records: { ...reg.records, [student.id]: mark } });
}

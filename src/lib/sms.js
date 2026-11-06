// Who an SMS goes to. Every smsLog record carries `to` (phone numbers); the live apps send it through
// mNotify (supabase/functions/edunexa-sms), the demo only pretends.

const norm = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('233')) d = `0${d.slice(3)}`;
  if (d.length === 9) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
};
const uniq = (list) => [...new Set(list.map(norm).filter(Boolean))];

/** Phones of each student's guardians (both parent accounts), or the phone the school noted until a parent joins. */
export function parentPhones(db, students) {
  const byId = new Map(db.parents.map((p) => [p.id, p]));
  return uniq(students.flatMap((s) => {
    const own = [s.parentId, s.parentId2].filter(Boolean).map((id) => byId.get(id)?.phone).filter(Boolean);
    return own.length ? own : [s.parentPhone];
  }));
}

export const staffPhones = (staff) => uniq(staff.filter((s) => s.status !== 'Exited').map((s) => s.phone));

/** Bulk SMS audiences for the Communication page: label → phone numbers. */
export function smsAudiences(db) {
  const active = db.students.filter((s) => s.status === 'Active');
  const out = {
    'All Parents': parentPhones(db, active),
    'All Staff': staffPhones(db.staff),
    Teachers: staffPhones(db.staff.filter((s) => /teacher/i.test(s.role))),
  };
  const sections = [...new Set(db.classes.map((c) => c.section))];
  sections.forEach((sec) => {
    const ids = new Set(db.classes.filter((c) => c.section === sec).map((c) => c.id));
    out[`${sec} Parents`] = parentPhones(db, active.filter((s) => ids.has(s.classId)));
  });
  [...db.classes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((c) => {
    out[`Parents · ${c.name}`] = parentPhones(db, active.filter((s) => s.classId === c.id));
  });
  out['Bus riders’ parents'] = parentPhones(db, active.filter((s) => s.busRouteId));
  out['Boarders’ parents'] = parentPhones(db, active.filter((s) => s.boarding === 'Boarder'));
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length));
}

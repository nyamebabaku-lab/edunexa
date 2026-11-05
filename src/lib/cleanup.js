// Deleting people cleanly: their own records go with them, and links to them are cleared.
import { useDB } from '../data/store';
import { removePhoto, photoKey } from '../data/photos';

const arrays = (db) => Object.keys(db).filter((k) => Array.isArray(db[k]) && db[k][0] && typeof db[k][0] === 'object');

/** Students plus their bills, payments, scores, loans, submissions and other records that belong only to them. */
export function deleteStudents(ids) {
  const db = useDB.getState();
  const drop = new Set(ids);
  arrays(db).forEach((col) => {
    if (col === 'students' || col === 'users') return;
    const mine = db[col].filter((r) => drop.has(r.studentId)).map((r) => r.id);
    if (mine.length) db.removeMany(col, mine);
  });
  db.removeMany('students', ids);
  ids.forEach((id) => removePhoto(photoKey('Student', id)).catch(() => {}));
}

/** What deleting these students also removes, for the confirmation message. */
export function studentFootprint(ids) {
  const db = useDB.getState();
  const drop = new Set(ids);
  const n = (col) => (db[col] || []).filter((r) => drop.has(r.studentId)).length;
  return { invoices: n('invoices'), payments: n('payments'), scores: n('scores') };
}

/** Staff plus their subject allocations and leave; they are taken off as class teacher. Lessons and materials they made stay. */
export function deleteStaff(ids) {
  const db = useDB.getState();
  const drop = new Set(ids);
  db.removeMany('allocations', db.allocations.filter((a) => drop.has(a.teacherId)).map((a) => a.id));
  db.removeMany('leaves', db.leaves.filter((l) => drop.has(l.staffId)).map((l) => l.id));
  db.classes.filter((c) => drop.has(c.classTeacherId)).forEach((c) => db.update('classes', c.id, { classTeacherId: null }));
  db.removeMany('staff', ids);
  ids.forEach((id) => removePhoto(photoKey('Staff', id)).catch(() => {}));
}

/** Parents; their children stay, with no parent linked until another is chosen. */
export function deleteParents(ids) {
  const db = useDB.getState();
  const drop = new Set(ids);
  db.students.filter((s) => drop.has(s.parentId)).forEach((s) => db.update('students', s.id, { parentId: '' }));
  db.removeMany('parents', ids);
}

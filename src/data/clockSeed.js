// Gate clock-in/out history, derived from the class registers so both agree.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export function buildClockings({ students, staff, classes, attendance, leaves, today }) {
  const r = rng(9090);
  const int = (a, b) => Math.floor(r() * (b - a + 1)) + a;
  const out = [];
  const early = new Set(classes.filter((c) => c.section === 'Early Years').map((c) => c.id));
  const dayStudents = students.filter((s) => s.boarding === 'Day' && s.status === 'Active');
  const dates = [...new Set(attendance.map((a) => a.date))].sort();
  const regFor = Object.fromEntries(attendance.map((a) => [`${a.date}|${a.classId}`, a.records]));

  const push = (date, personType, personId, inMin, outMin, method, lateAfter) =>
    out.push({
      id: `${date}|${personType}|${personId}`,
      date,
      personType,
      personId,
      in: hm(inMin),
      out: outMin == null ? null : hm(outMin),
      inMethod: method,
      outMethod: outMin == null ? null : method,
      late: inMin > lateAfter,
      gate: 'Main Gate',
    });

  [...dates, today].forEach((date) => {
    const isToday = date === today;
    dayStudents.forEach((s) => {
      const mark = isToday ? (r() < 0.86 ? (r() < 0.9 ? 'P' : 'L') : null) : regFor[`${date}|${s.classId}`]?.[s.id];
      if (mark !== 'P' && mark !== 'L') return;
      const inMin = mark === 'P' ? int(6 * 60 + 40, 7 * 60 + 29) : int(7 * 60 + 31, 8 * 60 + 10);
      const method = early.has(s.classId) || r() < 0.18 ? 'ID card' : 'Gate QR';
      push(date, 'Student', s.id, inMin, isToday ? null : int(14 * 60 + 35, 16 * 60 + 15), method, 7 * 60 + 30);
    });
    staff
      .filter((st) => st.status === 'Active')
      .forEach((st) => {
        const onLeave = leaves.some((l) => l.staffId === st.id && l.status === 'Approved' && l.from <= date && l.to >= date);
        if (onLeave || r() > (isToday ? 0.92 : 0.96)) return;
        const inMin = r() < 0.88 ? int(6 * 60 + 20, 7 * 60 + 28) : int(7 * 60 + 31, 8 * 60 + 15);
        push(date, 'Staff', st.id, inMin, isToday ? null : int(15 * 60 + 5, 17 * 60 + 40), r() < 0.85 ? 'Gate QR' : 'ID card', 7 * 60 + 30);
      });
  });
  return out;
}
